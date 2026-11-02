// SPDX-License-Identifier: GPL-2.0-only
// Supplemental UVs leave original paint coordinates and flight geometry unchanged.
export function attachSurfaceUv(T, meshes, metadata, buffer) {
  if (
    metadata.version !== 1 ||
    metadata.channel !== 1 ||
    !Array.isArray(metadata.meshes)
  )
    throw Error("Unsupported surface UV atlas");
  const seen = new Set();
  for (const e of metadata.meshes) {
    const m = meshes[e.index];
    if (
      !Number.isInteger(e.index) ||
      !m ||
      m.name !== e.name ||
      m.material !== "skin" ||
      seen.has(e.index)
    )
      throw Error("Invalid surface UV mesh");
    if (
      !Number.isInteger(e.offset) ||
      e.offset < 0 ||
      e.offset % 4 ||
      !Number.isInteger(e.count) ||
      e.count !== m.attributes.position.count * 2 ||
      e.offset + e.count * 4 > buffer.byteLength
    )
      throw Error("Invalid surface UV buffer");
    const a = new Float32Array(buffer, e.offset, e.count);
    if (!a.every((v) => Number.isFinite(v) && v >= -0.00001 && v <= 1.00001))
      throw Error("Invalid surface UV coordinate");
    m.attributes.detailUv = new T.BufferAttribute(a, 2);
    seen.add(e.index);
  }
  if (meshes.some((m, i) => m.material === "skin" && !seen.has(i)))
    throw Error("Missing surface UV mesh");
  return meshes;
}
