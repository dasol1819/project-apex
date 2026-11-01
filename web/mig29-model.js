// SPDX-License-Identifier: GPL-2.0-only
import * as T from "./vendor/three.module.js";
import { paint } from "./mig29-finish.js?v=visual-2";
import {
  cockpit,
  intakeDoor,
  rd33Nozzle,
  serviceMarkings,
} from "./mig29-details.js?v=visual-2";
import { createAirframeKit } from "./classic-airframe-kit.js";
const V = (...p) => new T.Vector3(...p),
  D = Math.PI / 180;
export const MIG29 = {
  id: 14,
  key: "mig29",
  name: "MiG-29 9.12",
  nickname: "Fulcrum-A",
  length: 17.32,
  span: 11.36,
  engines: 2,
  previewOnly: true,
  palette: [0x9aa79a, 0x536453, 0x828f7e, 0xa2b1b1],
};
function partition(asset) {
  const out = [];
  for (const m of asset.meshes) {
    if (!["fuselage", "Vstabs", "WingL", "WingR"].includes(m.name)) {
      out.push(m);
      continue;
    }
    const buckets = new Map(),
      p = m.attributes.position;
    for (let i = 0; i < p.count; i += 3) {
      let x = 0,
        y = 0,
        z = 0;
      for (let j = 0; j < 3; j++) {
        x += p.getX(i + j) / 3;
        y += p.getY(i + j) / 3;
        z += p.getZ(i + j) / 3;
      }
      const side = x > 0 ? 1 : 0,
        a = Math.abs(x);
      let part = m.part;
      if (m.name === "Vstabs") part = 5 + side;
      else if (m.name.startsWith("Wing")) part = (a > 3.75 ? 12 : 1) + side;
      else
        part =
          z < -5.4
            ? 10
            : z > 4
              ? 29
              : y < 0.15 && a > 0.33 && a < 1.65 && z > -2.65
                ? (z < 0.7 ? 27 : 7) + side
                : 0;
      if (!buckets.has(part)) buckets.set(part, []);
      buckets.get(part).push(i, i + 1, i + 2);
    }
    for (const [part, indices] of buckets) {
      const attributes = {};
      for (const [name, a] of Object.entries(m.attributes)) {
        const values = new Float32Array(indices.length * a.itemSize);
        indices.forEach((v, i) => {
          for (let k = 0; k < a.itemSize; k++)
            values[i * a.itemSize + k] = a.array[v * a.itemSize + k];
        });
        attributes[name] = new T.BufferAttribute(values, a.itemSize);
      }
      out.push({ ...m, part, attributes });
    }
  }
  return out;
}
export function createMig29Model(asset, { combat = false } = {}) {
  const k = createAirframeKit(MIG29),
    textures = asset.textures || {},
    motions = new Map(),
    integrity = Array.from({ length: 30 }, () => ({ value: 1 }));
  const skin = new T.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.albedo ?? null,
    roughness: 0.65,
    metalness: 0.07,
    aoMap: textures.ao ?? null,
    aoMapIntensity: 0.48,
    side: T.DoubleSide,
  });
  const skins = integrity.map((h) => paint(skin.clone(), h)),
    materials = {
      metal: new T.MeshStandardMaterial({
        color: 0x73817c,
        roughness: 0.5,
        metalness: 0.65,
        side: T.DoubleSide,
      }),
      duct: new T.MeshStandardMaterial({
        color: 0x3d4946,
        roughness: 0.79,
        metalness: 0.23,
        side: T.DoubleSide,
      }),
      dark: new T.MeshStandardMaterial({
        color: 0x12201c,
        roughness: 0.85,
        side: T.DoubleSide,
      }),
      rubber: new T.MeshStandardMaterial({ color: 0x111715, roughness: 0.95 }),
      glass: new T.MeshPhysicalMaterial({
        color: 0x91b0b5,
        roughness: 0.07,
        metalness: 0.06,
        transparent: true,
        opacity: 0.24,
        depthWrite: false,
        clearcoat: 1,
        side: T.DoubleSide,
      }),
    };
  const pivots = {
    canopy: [0, 1.04, -2.91],
    "tail-left": [-2.5, 0.08, 4.92],
    "tail-right": [2.5, 0.08, 4.92],
    "flap-left": [-2.55, 0.2, 2.36],
    "flap-right": [2.55, 0.2, 2.36],
    "aileron-left": [-4.2, 0.14, 3.05],
    "aileron-right": [4.2, 0.14, 3.05],
    "slat-left": [-3.3, 0.18, 0.35],
    "slat-right": [3.3, 0.18, 0.35],
    "rudder-left": [-1.8, 0.8, 5.3],
    "rudder-right": [1.8, 0.8, 5.3],
    "nose-gear": [0, -0.12, -2.72],
    "main-left": [-1.3, 0.08, 1.08],
    "main-right": [1.3, 0.08, 1.08],
    "airbrake-upper": [0, 0, 4.45],
    "airbrake-lower": [0, 0, 4.45],
    "screen-left": [-0.654, -0.1153, -2.548],
    "screen-right": [0.654, -0.1153, -2.548],
  };
  const parent = (motion, part) => {
    if (!pivots[motion]) return k.parts[part];
    if (!motions.has(motion)) {
      const g = new T.Group();
      g.name = "MiG-29 " + motion;
      g.position.set(...pivots[motion]);
      g.userData.pivot = pivots[motion];
      g.userData.keepGroup = true;
      k.parts[part].add(g);
      motions.set(motion, g);
    }
    return motions.get(motion);
  };
  for (const mesh of partition(asset)) {
    if (mesh.motion.startsWith("louver-")) {
      const a = mesh.attributes.position;
      let minZ = Infinity,
        cx = 0,
        cy = 0;
      for (let i = 0; i < a.count; i++) {
        cx += a.getX(i) / a.count;
        cy += a.getY(i) / a.count;
        minZ = Math.min(minZ, a.getZ(i));
      }
      pivots[mesh.motion] = [cx, cy, minZ];
    }
    const g = new T.BufferGeometry();
    for (const [n, a] of Object.entries(mesh.attributes))
      g.setAttribute(n, a.clone());
    g.setAttribute("liveryPosition", mesh.attributes.position.clone());
    g.setAttribute("uv1", mesh.attributes.uv.clone());
    const m = k.mesh(
      g,
      mesh.material === "skin"
        ? skins[mesh.part]
        : materials[mesh.material] || materials.metal,
      mesh.part,
      parent(mesh.motion, mesh.part),
    );
    m.name = "MiG-29 " + mesh.name;
  }
  // Recessed intake passages retain real depth and terminate at compressor disks.
  const inlets = [];
  for (const side of [-1, 1]) {
    const x = side * 0.73,
      y = -0.46,
      z = -1.85,
      part = side < 0 ? 27 : 28;
    const rows = 16,
      N = 48,
      p = [],
      ix = [];
    for (let j = 0; j <= rows; j++)
      for (let i = 0; i < N; i++) {
        const t = j / rows,
          a = (i / N) * Math.PI * 2,
          c = Math.cos(a),
          s = Math.sin(a),
          pow = 0.5 + t * 0.5;
        p.push(
          side *
            ((0.705 - Math.sign(s) * Math.abs(s) ** pow * 0.37 * 0.145) *
              (1 - t) +
              0.73 * t) +
            Math.sign(c) * Math.abs(c) ** pow * (0.295 + 0.005 * t),
          y + Math.sign(s) * Math.abs(s) ** pow * (0.37 - 0.07 * t),
          (-2.5 - 1.55 * Math.sign(s) * Math.abs(s) ** pow * 0.37) * (1 - t) +
            (z + 2.8) * t,
        );
      }
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < N; i++) {
        const a = j * N + i,
          b = j * N + ((i + 1) % N);
        ix.push(a, a + N, b, b, a + N, b + N);
      }
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(p, 3));
    g.setIndex(ix);
    g.computeVertexNormals();
    k.mesh(g, materials.duct, part).name = "MiG-29 recessed inlet duct";
    const lip = [];
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI * 2,
        dy = Math.sign(Math.sin(a)) * Math.abs(Math.sin(a)) ** 0.5 * 0.37;
      lip.push([
        side * (0.705 - dy * 0.145) +
          Math.sign(Math.cos(a)) * Math.abs(Math.cos(a)) ** 0.5 * 0.295,
        y + dy,
        -2.5 - 1.55 * dy,
      ]);
    }
    k.line(lip, part, materials.metal, 0.007).name =
      "MiG-29 rounded intake lip";
    const spinner = new T.ConeGeometry(0.085, 0.2, 32);
    spinner.rotateX(-Math.PI / 2);
    spinner.translate(x, y, z + 2.65);
    k.mesh(spinner, materials.metal, part).name = "MiG-29 compressor spinner";
    k.tube(0.3, 0.3, 0.03, [x, y, z + 2.8], part, materials.dark);
    for (let i = 0; i < 24; i++) {
      const a = (i / N) * Math.PI * 4;
      const blade = [];
      for (const [r, da, zz] of [
        [0.075, 0.26, 2.7],
        [0.285, 0, 2.74],
        [0.285, 0.115, 2.77],
        [0.075, 0.44, 2.74],
      ])
        blade.push([
          x + r * Math.cos(a + da),
          y + r * Math.sin(a + da),
          z + zz,
        ]);
      k.solid(blade, part, materials.metal, 0.003);
    }
    inlets.push({ center: [x, y, z], part });
    const door = intakeDoor(k, side, materials);
    motions.set(side < 0 ? "screen-left" : "screen-right", door);
    rd33Nozzle(k, side);
  }
  const hub = new T.MeshStandardMaterial({
    color: 0x45674d,
    roughness: 0.68,
    metalness: 0.23,
  });
  for (const side of [-1, 1]) {
    const main = motions.get(side < 0 ? "main-left" : "main-right"),
      nose = motions.get("nose-gear");
    k.tube(
      0.267,
      0.267,
      0.027,
      [side * 1.748, -1.386, 1.103],
      side < 0 ? 25 : 26,
      hub,
      { axis: "x", parent: main, sides: 40 },
    );
    k.tube(
      0.106,
      0.106,
      0.035,
      [side * 1.77, -1.386, 1.103],
      side < 0 ? 25 : 26,
      materials.metal,
      { axis: "x", parent: main },
    );
    k.tube(0.15, 0.15, 0.018, [side * 0.212, -1.52, -2.452], 24, hub, {
      axis: "x",
      parent: nose,
    });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      k.tube(
        0.014,
        0.014,
        0.015,
        [side * 1.768, -1.386 + Math.sin(a) * 0.2, 1.103 + Math.cos(a) * 0.2],
        side < 0 ? 25 : 26,
        materials.metal,
        { axis: "x", parent: main, sides: 8 },
      );
    }
  }
  cockpit(k, materials);
  markings(k);
  serviceMarkings(k);
  k.animations.push((s) => {
    const gear = T.MathUtils.clamp(s.gear ?? 1, 0, 1),
      fod = s.fod ?? (gear > 0.95 && (s.tas ?? 0) < 55 ? 1 : 0);
    integrity.forEach((h, i) => (h.value = s.health?.[i] ?? 1));
    for (const [key, g] of motions) {
      const side = key.endsWith("right") ? 1 : -1,
        word = side < 0 ? "left" : "right";
      if (key === "canopy") g.rotation.x = s.canopy || 0;
      else if (key.startsWith("tail-"))
        g.rotation.x = -(s[word + "Tail"] ?? 0.3 * (s.pitchInput || 0));
      else if (key.startsWith("flap-"))
        g.rotation.x = s[word + "Flap"] ?? gear * 25 * D;
      else if (key.startsWith("aileron-"))
        g.rotation.x = -(
          s[word + "Aileron"] ?? side * 0.25 * (s.rollInput || 0)
        );
      else if (key.startsWith("slat-"))
        g.rotation.x = -(s[word + "LEF"] ?? Math.max(0, (s.alpha || 0) * 0.45));
      else if (key.startsWith("rudder-"))
        g.rotation.y = s[word + "Rudder"] ?? 0.35 * (s.yawInput || 0);
      else if (key.startsWith("main-")) {
        g.rotation.z = side * (1 - gear) * 1.5;
        g.visible = gear > 0.01;
      } else if (key === "nose-gear") {
        g.rotation.x = (1 - gear) * 1.5;
        g.visible = gear > 0.01;
      } else if (key.startsWith("airbrake-"))
        g.rotation.x =
          (key.endsWith("upper") ? -0.977 : 1.047) * (s.airbrake || 0);
      else if (key.startsWith("louver-")) g.rotation.x = -fod * 0.7;
      else if (key.startsWith("screen-"))
        g.quaternion.setFromAxisAngle(V(1, 0, 0), (-(1 - fod) * Math.PI) / 2);
    }
  });
  for (const g of motions.values()) k.batch(g);
  const model = k.finish({
    gunMount: [-0.65, 0.6, -4.3],
    gunPart: 0,
    wingTips: [
      [-5.68, 0.15, 2.8],
      [5.68, 0.15, 2.8],
    ],
  });
  model.group.userData.intakes = inlets;
  model.group.userData.gearContacts = [
    [0, -1.86, -2.45],
    [-1.6, -1.86, 1.1],
    [1.6, -1.86, 1.1],
  ];
  const update = model.update;
  model.update = (s = {}, dt = 1 / 60) =>
    update({ gear: 1, ...s, afterburner: s.afterburner }, dt);
  model.update = (
    (fn) =>
    (s = {}, dt = 1 / 60) => {
      fn(s, dt);
      if (!combat)
        model.group.traverse((o) => {
          if (o.isMesh && o.material.isShaderMaterial) o.visible = false;
        });
    }
  )(model.update);
  model.update();
  return model;
}
function markings(k) {
  const red = new T.MeshStandardMaterial({
      color: 0x9b2320,
      roughness: 0.8,
      side: T.DoubleSide,
    }),
    white = new T.MeshStandardMaterial({
      color: 0xbfc5bc,
      roughness: 0.8,
      side: T.DoubleSide,
    });
  k.group.updateMatrixWorld(true);
  for (const side of [-1, 1]) {
    const wing = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5,
        r = i % 2 ? 0.12 : 0.3;
      wing.push([side * 4.6 + Math.cos(a) * r, 0.22, 2.0 + Math.sin(a) * r]);
    }
    k.solid(wing, side < 0 ? 12 : 13, red, 0.002);
    const part = side < 0 ? 5 : 6,
      surfaces = [];
    k.parts[part].traverse((o) => {
      if (o.isMesh) surfaces.push(o);
    });
    for (const [scale, mat, offset] of [
      [0.34, white, 0.004],
      [0.29, red, 0.007],
    ]) {
      const points = [];
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5,
          r = i % 2 ? scale * 0.43 : scale,
          y = 1.99 - Math.sin(a) * r,
          z = 5.2 + Math.cos(a) * r;
        const hit = new T.Raycaster(
          V(side * 3, y, z),
          V(-side, 0, 0),
          0,
          3,
        ).intersectObjects(surfaces, false)[0];
        if (!hit) {
          points.length = 0;
          break;
        }
        points.push([hit.point.x + side * offset, y, z]);
      }
      if (points.length === 10) k.solid(points, part, mat, 0.001);
    }
  }
}
