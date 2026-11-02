// SPDX-License-Identifier: MIT
// CompressedTexture fields follow Three.js r180, MIT, see vendor/basis/THREE-LICENSE.txt.
// The trimmed game vendor exports Texture, so retain its renderer and class identity.
import * as T from "./vendor/three.module.js";
class SurfaceTexture extends T.Texture {
  constructor(mipmaps, width, height, format) {
    super();
    this.isCompressedTexture = true;
    this.image = { width, height };
    this.mipmaps = mipmaps;
    this.format = format;
    this.type = T.UnsignedByteType;
    this.flipY = false;
    this.generateMipmaps = false;
    this.colorSpace = T.NoColorSpace;
    this.minFilter = T.LinearMipmapLinearFilter;
    this.magFilter = T.LinearFilter;
    this.needsUpdate = true;
  }
}
function target(renderer) {
  const gl = renderer?.getContext();
  if (!gl) return null;
  // Alpha is occlusion data, so always retain all four independent channels.
  for (const [extension, transcoder, format, name] of [
    ["WEBGL_compressed_texture_astc", 10, 37808, "astc-4x4"],
    ["EXT_texture_compression_bptc", 7, 36492, "bc7"],
    ["WEBGL_compressed_texture_etc", 1, 37496, "etc2-rgba"],
    ["WEBGL_compressed_texture_s3tc", 3, 33779, "bc3"],
  ])
    if (gl.getExtension(extension)) return { transcoder, format, name };
  return null;
}
export async function loadGpuSurface({
  renderer,
  url,
  fallbackUrl,
  forceFallback = false,
}) {
  const selected =
    !forceFallback &&
    typeof Worker !== "undefined" &&
    typeof DecompressionStream !== "undefined"
      ? target(renderer)
      : null;
  let failure;
  if (selected) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw Error("Surface download " + res.status);
      const buffer = await new Response(
        res.body.pipeThrough(new DecompressionStream("gzip")),
      ).arrayBuffer();
      const worker = new Worker(
        new URL("./surface-transcoder.worker.js?v=1", import.meta.url),
      );
      const result = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          worker.terminate();
          reject(Error("Surface transcode timed out"));
        }, 45000);
        const done = (fn) => (value) => {
          clearTimeout(timer);
          worker.terminate();
          fn(value);
        };
        worker.onmessage = done(({ data }) =>
          data.error ? reject(Error(data.error)) : resolve(data),
        );
        worker.onerror = done((e) =>
          reject(Error(e.message || "Surface worker failed")),
        );
        worker.postMessage({ buffer, transcoder: selected.transcoder }, [
          buffer,
        ]);
      });
      const texture = new SurfaceTexture(
        result.mipmaps,
        result.width,
        result.height,
        selected.format,
      );
      texture.anisotropy = Math.min(
        8,
        renderer.capabilities.getMaxAnisotropy(),
      );
      texture.name = "Su-35 shared 4K surface / " + selected.name;
      texture.userData.surfaceBackend = selected.name;
      texture.userData.gpuBytes = result.mipmaps.reduce(
        (n, m) => n + m.data.byteLength,
        0,
      );
      return texture;
    } catch (error) {
      failure = error.message;
    }
  }
  const texture = await new T.TextureLoader().loadAsync(fallbackUrl);
  texture.colorSpace = T.NoColorSpace;
  texture.anisotropy = 8;
  texture.name = "Su-35 shared 2K surface fallback";
  texture.userData.surfaceBackend = "rgba8-2k";
  texture.userData.gpuBytes = (2048 * 2048 * 4 * 4) / 3;
  if (failure) texture.userData.surfaceFallbackReason = failure;
  return texture;
}
