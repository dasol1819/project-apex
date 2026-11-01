// SPDX-License-Identifier: GPL-2.0-only
import * as T from "./vendor/three.module.js";
import { decodeSu35Asset } from "./su35-asset.js";
let cache, pending;
export const cachedMig29Asset = () => cache;
export const decodeMig29Asset = decodeSu35Asset;
export function preloadMig29Asset() {
  return cache
    ? Promise.resolve(cache)
    : (pending ??= load()
        .then((a) => (cache = a))
        .catch((e) => {
          pending = undefined;
          throw e;
        }));
}
async function load() {
  const base = new URL("./assets/mig29/", import.meta.url),
    [meta, res] = await Promise.all([
      fetch(new URL("airframe.json", base)),
      fetch(
        new URL(
          typeof DecompressionStream === "function"
            ? "airframe.bin.gz"
            : "airframe.bin",
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
  const loader = new T.TextureLoader(),
    [albedo, ao] = await Promise.all(
      ["albedo.png", "ao.png"].map((n) =>
        loader.loadAsync(new URL(n, base).href),
      ),
    );
  albedo.colorSpace = T.SRGBColorSpace;
  ao.colorSpace = T.NoColorSpace;
  ao.channel = 0;
  for (const t of [albedo, ao]) t.anisotropy = 8;
  return {
    metadata,
    meshes: decodeMig29Asset(metadata, buffer),
    textures: { albedo, ao },
  };
}
