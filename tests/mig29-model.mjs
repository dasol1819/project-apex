import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
const root = path.resolve(process.argv[2] || "public"),
  load = (n) => import(pathToFileURL(path.join(root, n))),
  T = await load("vendor/three.module.js"),
  { decodeMig29Asset } = await load("mig29-asset.js"),
  { createMig29Model } = await load("mig29-model.js"),
  { createMig29CombatAircraft } = await load("mig29-combat-model.js");
const metadata = JSON.parse(
    fs.readFileSync(path.join(root, "assets/mig29/airframe.json")),
  ),
  b = fs.readFileSync(path.join(root, "assets/mig29/airframe.bin")),
  asset = {
    metadata,
    meshes: decodeMig29Asset(
      metadata,
      b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength),
    ),
  };
const model = createMig29Model(asset),
  v = new T.Vector3(),
  box = new T.Box3();
let triangles = 0;
const visible = (o) => {
  for (let n = o; n; n = n.parent) if (!n.visible) return false;
  return true;
};
model.group.updateMatrixWorld(true);
model.group.traverse((o) => {
  if (
    !o.isMesh ||
    !visible(o) ||
    o.userData.visualEffect ||
    o.material.isShaderMaterial
  )
    return;
  for (const a of Object.values(o.geometry.attributes))
    assert.ok(Array.from(a.array).every(Number.isFinite), o.name);
  const p = o.geometry.attributes.position;
  for (let i = 0; i < p.count; i++)
    box.expandByPoint(o.getVertexPosition(i, v).applyMatrix4(o.matrixWorld));
  triangles += (o.geometry.index?.count || p.count) / 3;
});
const size = box.getSize(new T.Vector3());
assert.ok(Math.abs(size.x - 11.36) < 0.02, "span");
assert.ok(Math.abs(size.z - 17.32) < 0.03, "length");
assert.ok(Math.abs(size.y - 4.73) < 0.05, "height");
// Close-up skin/glazing refinement plus modeled cockpit and RD-33 hardware.
assert.ok(triangles < 245000, `MiG-29 triangle budget: ${triangles}`);
model.update({ gear: 0, fod: 0 });
let underside = 0,
  inlets = 0;
for (const z of [-6, -4, -2, 0, 2, 4]) {
  const hits = new T.Raycaster(
    new T.Vector3(0, -4, z),
    new T.Vector3(0, 1, 0),
    0,
    5,
  )
    .intersectObject(model.group, true)
    .filter((h) => visible(h.object) && !h.object.userData.visualEffect);
  assert.ok(hits.length, "underside " + z);
  underside++;
}
for (const {
  center: [cx, cy, z],
} of model.group.userData.intakes)
  for (const dx of [-0.1, 0, 0.1])
    for (const dy of [-0.1, 0, 0.1]) {
      const hits = new T.Raycaster(
        new T.Vector3(cx + dx, cy + dy, z - 0.9),
        new T.Vector3(0, 0, 1),
        0,
        5,
      )
        .intersectObject(model.group, true)
        .filter((h) => visible(h.object));
      assert.ok(
        hits.length && hits[0].point.z > z + 0.4,
        "open inlet " + cx + "/" + dx + "/" + dy + " " + hits[0]?.point.z,
      );
      inlets++;
    }
// Open and closed FOD states must change actual ray intersections; the door
// stays inside the nacelle throughout its sweep, rather than rotating outside.
for (const side of [-1, 1]) {
  const door = model.group.getObjectByName(
    "MiG-29 screen-" + (side < 0 ? "left" : "right"),
  );
  for (const fod of [0, 0.25, 0.5, 0.75, 1]) {
    model.update({ gear: 0, fod });
    const b = new T.Box3().setFromObject(door);
    assert.ok(
      b.min.y > -0.81 && b.max.y < -0.085,
      "FOD sweep stays inside intake height",
    );
    assert.ok(
      b.min.z > -1.88 && b.max.z < -1.15,
      "FOD sweep stays inside intake depth",
    );
  }
  model.update({ gear: 0, fod: 1 });
  const h = new T.Raycaster(
    new T.Vector3(side * 0.73, -0.46, -2.7),
    new T.Vector3(0, 0, 1),
    0,
    3,
  ).intersectObject(door, true)[0];
  assert.ok(h && h.point.z < -1.8, "closed FOD blocks the passage");
}
model.update({ gear: 0, fod: 0, afterburner: 0 });
const nozzleMeshes = [];
model.group.traverse((o) => {
  if (o.name === "MiG-29 RD-33 18 overlapping feathers") nozzleMeshes.push(o);
});
assert.equal(nozzleMeshes.length, 2);
for (const petals of nozzleMeshes) {
  const g = petals.geometry,
    exit = [],
    side = Math.sign(g.attributes.position.getX(0));
  for (let i = 0; i < g.attributes.position.count; i++)
    if (g.attributes.uv.getY(i) > 0.999) exit.push(i);
  const radius = () =>
    exit.reduce((sum, i) => {
      petals.getVertexPosition(i, v);
      return sum + Math.hypot(v.x - side * 0.949, v.y + 0.188);
    }, 0) / exit.length;
  const dry = radius();
  model.update({ gear: 0, fod: 0, afterburner: 1 });
  assert.ok(radius() > dry + 0.08, "physical nozzle aperture opens");
  model.update({ gear: 0, fod: 0, afterburner: 0 });
}
const flap = model.group.getObjectByName("MiG-29 flap-left");
model.update({ gear: 0, leftFlap: 0, fod: 0 });
const y = flap.localToWorld(new T.Vector3(0, 0, 0.4)).y;
model.update({ gear: 0, leftFlap: 0.4, fod: 0 });
assert.ok(
  flap.localToWorld(new T.Vector3(0, 0, 0.4)).y < y - 0.1,
  "flap trailing edge down",
);
const canopy = model.group.getObjectByName("MiG-29 canopy");
model.update({ gear: 1, canopy: 0 });
const closed = new T.Box3().setFromObject(canopy).max.y;
model.update({ gear: 1, canopy: 0.8, airbrake: 1, fod: 1 });
assert.ok(
  new T.Box3().setFromObject(canopy).max.y > closed + 0.3,
  "canopy opens",
);
assert.ok(
  model.group.getObjectByName("MiG-29 airbrake-upper").rotation.x < -0.9,
);
assert.ok(model.group.getObjectByName("MiG-29 airbrake-lower").rotation.x > 1);
assert.ok(
  model.group.getObjectByName("MiG-29 louver-LouversR1").rotation.x < -0.6,
  "right auxiliary louver opens",
);
model.update({ gear: 1, canopy: 0 });
const combiner = model.group.getObjectByName("MiG-29 HUD combiner"),
  windshield = model.group.getObjectByName("MiG-29 Windscreen");
for (let i = 0; i < combiner.geometry.attributes.position.count; i++) {
  v.fromBufferAttribute(combiner.geometry.attributes.position, i).applyMatrix4(
    combiner.matrixWorld,
  );
  const hits = new T.Raycaster(
    new T.Vector3(v.x, 4, v.z),
    new T.Vector3(0, -1, 0),
    0,
    5,
  ).intersectObject(windshield);
  assert.ok(
    hits.length && hits[0].point.y > v.y + 0.02,
    "HUD under fixed windshield",
  );
}
const combat = createMig29CombatAircraft({ asset }),
  health = Array(30).fill(1),
  enabled = Array(30).fill(1);
combat.update({ gear: 1, health, enabled });
assert.equal(combat.definition.id, 14);
assert.equal(combat.group.userData.previewOnly, false);
const station = combat.group.getObjectByName("MiG-29 rf station 1");
assert.equal(station.parent, combat.damageParts[1]);
assert.ok(
  station
    .getWorldPosition(new T.Vector3())
    .distanceTo(new T.Vector3(-2.62, -0.44, 0.65)) < 1e-6,
);
health[1] = 0;
combat.update({ gear: 1, health, enabled });
assert.equal(station.visible, false);
const shapes = JSON.parse(fs.readFileSync("assets/mig29-combat/shapes.json"));
for (const p of shapes.parts) {
  if (p.id === 9) continue;
  const actual = combat.group.userData.damagePartBounds[p.id];
  for (let i = 0; i < 3; i++)
    assert.ok(
      Math.abs(actual.center[i] - p.pivot[i]) < 1e-6,
      "collision part " + p.id,
    );
}
console.log(
  JSON.stringify({
    result: "PASS",
    visibleDimensions: size.toArray(),
    triangles,
    undersideSamples: underside,
    inletSamples: inlets,
    mechanisms: true,
    combatStores: true,
    collisionRegions: 30,
  }),
);

const { createWreckageFactory } = await load("wreckage-mesh.js"),
  factory = createWreckageFactory(combat);
const part = combat.group.userData.damagePartBounds[1],
  wreck = factory.create(1, 0, part.center, part.half);
let pieces = 0;
wreck.traverse((o) => {
  if (o.isMesh) {
    pieces++;
    for (const a of Object.values(o.geometry.attributes))
      assert.ok(Array.from(a.array).every(Number.isFinite));
    if (o.geometry.attributes.liveryPosition)
      assert.equal(
        o.geometry.attributes.liveryPosition.count,
        o.geometry.attributes.position.count,
      );
  }
});
assert.ok(pieces > 0);
factory.release(wreck);

for (const part of [5, 6]) {
  let red = false;
  model.damageParts[part].traverse((o) => {
    if (o.isMesh && o.material.color?.getHex() === 0x9b2320) red = true;
  });
  assert.ok(red, "projected star lies on fin " + part);
}
