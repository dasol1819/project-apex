import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
const root = path.resolve(process.argv[2] || "public"),
  load = (n) => import(pathToFileURL(path.join(root, n)));
const T = await load("vendor/three.module.js"),
  { decodeMig29Asset } = await load("mig29-asset.js"),
  { attachSurfaceUv } = await load("airframe-surface-uv.js");
const dir = path.join(root, "assets/mig29"),
  read = (n) => fs.readFileSync(path.join(dir, n)),
  array = (b) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
const meta = JSON.parse(read("airframe.json")),
  binary = read("airframe.bin"),
  chart = JSON.parse(read("surface-uv.json")),
  uv = read("surface-uv.bin");
const fresh = () => decodeMig29Asset(meta, array(binary)),
  meshes = attachSurfaceUv(T, fresh(), chart, array(uv));
let count = 0;
for (const m of meshes)
  if (m.material === "skin") {
    assert.equal(m.attributes.detailUv.count, m.attributes.position.count);
    count++;
    assert.ok(
      m.attributes.detailUv.array.every(
        (v) => Number.isFinite(v) && v >= -0.00001 && v <= 1.00001,
      ),
    );
  }
assert.ok(
  meshes.some((m) =>
    m.attributes.detailUv?.array.some(
      (v, i) => Math.abs(v - m.attributes.uv.array[i]) > 0.01,
    ),
  ),
  "second chart must differ from overlapping paint UV",
);
assert.throws(
  () => attachSurfaceUv(T, fresh(), chart, array(uv.subarray(0, 16))),
  /Invalid surface UV buffer/,
);
assert.throws(
  () => attachSurfaceUv(T, fresh(), { ...chart, meshes: [] }, array(uv)),
  /Missing surface UV mesh/,
);
assert.throws(
  () =>
    attachSurfaceUv(
      T,
      fresh(),
      { ...chart, meshes: [chart.meshes[0], chart.meshes[0]] },
      array(uv),
    ),
  /Invalid surface UV mesh/,
);
const summary = JSON.stringify({
  result: "PASS",
  skinMeshes: count,
  uvBytes: uv.length,
  independentUv: true,
  invalidDownloadsRejected: true,
});

const sha = (b) => createHash("sha256").update(b).digest("hex");
assert.equal(chart.geometrySha256, sha(binary));
assert.equal(chart.binarySha256, sha(uv));
const surface = JSON.parse(read("surface.json"));
assert.equal(surface.geometrySha256, sha(binary));
for (const [name, entry] of Object.entries(surface.files))
  assert.equal(sha(read(name)), entry.sha256);

console.log(summary);
