// SPDX-License-Identifier: GPL-2.0-only
import * as T from "./vendor/three.module.js";
import { decodeSu35Asset } from "./su35-asset.js";
import { loadGpuSurface } from "./gpu-surface-texture.js?v=2";
import { attachSurfaceUv } from "./airframe-surface-uv.js?v=1";
let cache, pending;
export const cachedMig29Asset = () => cache;
export const decodeMig29Asset = decodeSu35Asset;
export function preloadMig29Asset(onProgress = () => {}, renderer) {
  return cache
    ? Promise.resolve(cache)
    : (pending ??= load(onProgress, renderer)
        .then((a) => (cache = a))
        .catch((e) => {
          pending = undefined;
          throw e;
        }));
}
async function load(onProgress, renderer) {
  onProgress("MiG-29 곡면 모델을 불러오는 중…");
  const base = new URL("./assets/mig29/", import.meta.url),
    [meta, res] = await Promise.all([
      fetch(new URL("airframe.json?v=visual-2", base)),
      fetch(
        new URL(
          typeof DecompressionStream === "function"
            ? "airframe.bin.gz?v=visual-2"
            : "airframe.bin?v=visual-2",
          base,
        ),
      ),
    ]);
  if (!meta.ok || !res.ok) throw Error("MiG-29 geometry download failed");
  const metadata = await meta.json();
  let buffer = await res.arrayBuffer();
  if (new Uint8Array(buffer)[0] === 31)
    buffer = await new Response(
      new Blob([buffer]).stream().pipeThrough(new DecompressionStream("gzip")),
    ).arrayBuffer();
  onProgress("MiG-29 표면 디테일을 불러오는 중…");
  const loader = new T.TextureLoader();
  const [albedo, micro, surface, chartMeta, chartResponse] = await Promise.all([
    loader.loadAsync(new URL("albedo.webp?v=surface-1", base).href),
    loader.loadAsync(new URL("micro-surface.webp?v=surface-1", base).href),
    loadGpuSurface({
      renderer,
      label: "MiG-29",
      url: new URL("surface.ktx2.gz?v=surface-1", base),
      fallbackUrl: new URL("surface-fallback.webp?v=surface-1", base).href,
    }),
    fetch(new URL("surface-uv.json?v=surface-1", base)).then((r) => {
      if (!r.ok) throw Error("Surface UV metadata download failed");
      return r.json();
    }),
    fetch(
      new URL(
        (typeof DecompressionStream === "function"
          ? "surface-uv.bin.gz"
          : "surface-uv.bin") + "?v=surface-1",
        base,
      ),
    ),
  ]);
  albedo.colorSpace = T.SRGBColorSpace;
  micro.colorSpace = T.NoColorSpace;
  micro.wrapS = micro.wrapT = T.RepeatWrapping;
  for (const t of [albedo, micro]) t.anisotropy = 8;
  if (!chartResponse.ok) throw Error("Surface UV download failed");
  let chartBuffer = await chartResponse.arrayBuffer();
  if (new Uint8Array(chartBuffer)[0] === 31)
    chartBuffer = await new Response(
      new Blob([chartBuffer])
        .stream()
        .pipeThrough(new DecompressionStream("gzip")),
    ).arrayBuffer();
  const meshes = attachSurfaceUv(
    T,
    decodeMig29Asset(metadata, buffer),
    chartMeta,
    chartBuffer,
  );
  surface.channel = 1;
  return { metadata, meshes, textures: { albedo, micro, surface } };
}
