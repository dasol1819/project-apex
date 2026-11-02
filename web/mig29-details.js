// SPDX-License-Identifier: GPL-2.0-only
import * as T from "./vendor/three.module.js";
import { heatSteel } from "./mig29-finish.js?v=surface-1";
const V = (...p) => new T.Vector3(...p);
export function cockpit(k, m) {
  const panel = new T.MeshStandardMaterial({ color: 0x344745, roughness: 0.8 }),
    black = m.dark,
    seat = new T.MeshStandardMaterial({ color: 0x394139, roughness: 0.95 });
  bevelBox(k, [0.63, 0.55, 0.12], [0, 0.65, -4.63], 11, panel);
  bevelBox(k, [0.48, 0.78, 0.18], [0, 0.76, -3.44], 11, seat);
  bevelBox(k, [0.37, 0.25, 0.24], [0, 1.21, -3.44], 11, black);
  bevelBox(k, [0.48, 0.12, 0.48], [0, 0.41, -3.72], 11, seat);
  const needles = [];
  for (let i = 0; i < 6; i++) {
    const x = ((i % 3) - 1) * 0.19,
      y = 0.79 - Math.floor(i / 3) * 0.2;
    const texture = gaugeTexture(i),
      face = new T.Mesh(
        new T.CircleGeometry(0.078, 48),
        texture
          ? new T.MeshStandardMaterial({
              map: texture,
              roughness: 0.85,
              emissive: 0x283628,
              emissiveMap: texture,
              emissiveIntensity: 0.15,
            })
          : black,
      );
    face.position.set(x, y, -4.55);
    k.parts[11].add(face);
    const bezel = new T.Mesh(new T.TorusGeometry(0.081, 0.007, 8, 32), m.metal);
    bezel.position.copy(face.position);
    k.parts[11].add(bezel);
    const dialGlass = new T.Mesh(
      new T.CircleGeometry(0.076, 48),
      new T.MeshPhysicalMaterial({
        color: 0xc4d8d5,
        transparent: true,
        opacity: 0.1,
        roughness: 0.08,
        depthWrite: false,
      }),
    );
    dialGlass.position.set(x, y, -4.537);
    k.parts[11].add(dialGlass);
    for (const dx of [-0.067, 0.067])
      for (const dy of [-0.067, 0.067])
        k.tube(0.0038, 0.0038, 0.004, [x + dx, y + dy, -4.542], 11, m.metal, {
          sides: 8,
        });
    const needle = new T.Mesh(
      new T.BoxGeometry(0.005, 0.058, 0.002),
      new T.MeshBasicMaterial({ color: 0xe2dec3 }),
    );
    needle.geometry.translate(0, 0.025, 0);
    needle.position.set(x, y, -4.543);
    k.parts[11].add(needle);
    needles.push(needle);
  }
  const hud = new T.Mesh(
    new T.PlaneGeometry(0.22, 0.19),
    new T.MeshPhysicalMaterial({
      color: 0x6ca49a,
      transparent: true,
      opacity: 0.27,
      side: T.DoubleSide,
      depthWrite: false,
    }),
  );
  hud.position.set(0, 0.98, -5.12);
  hud.rotation.x = -0.2;
  hud.name = "MiG-29 HUD combiner";
  k.parts[11].add(hud);
  const green = new T.LineBasicMaterial({
    color: 0x71c38d,
    transparent: true,
    opacity: 0.65,
  });
  const hudLines = [];
  for (const y of [-0.045, 0, 0.045])
    hudLines.push(
      -0.055,
      y,
      0.002,
      -0.018,
      y,
      0.002,
      0.018,
      y,
      0.002,
      0.055,
      y,
      0.002,
    );
  hudLines.push(
    0,
    -0.015,
    0.002,
    0,
    0.015,
    0.002,
    -0.012,
    0,
    0.002,
    0.012,
    0,
    0.002,
  );
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(hudLines, 3));
  hud.add(new T.LineSegments(g, green));
  for (const side of [-1, 1]) {
    k.tube(0.016, 0.016, 0.73, [side * 0.24, 0.83, -3.43], 11, m.metal, {
      axis: "y",
    });
    bevelBox(k, [0.025, 0.075, 0.08], [side * 0.23, 1.21, -3.29], 11, black);
    k.line(
      [
        [side * 0.35, 0.59, -4.3],
        [side * 0.34, 0.66, -4.05],
        [side * 0.34, 0.56, -3.73],
      ],
      11,
      m.metal,
      0.012,
    );
  }
  k.ellipsoid([0.18, 0.11, 0.1], [0, 1.23, -3.36], 11, seat, undefined, 24);
  k.line(
    [
      [0.02, 0.46, -4.06],
      [0.02, 0.67, -4.13],
    ],
    11,
    black,
    0.021,
  );
  k.ellipsoid(
    [0.035, 0.055, 0.035],
    [0.02, 0.71, -4.13],
    11,
    black,
    undefined,
    16,
  );

  for (const side of [-1, 1])
    bevelBox(k, [0.13, 0.11, 0.86], [side * 0.32, 0.54, -3.95], 11, panel);
  const alloy = new T.MeshStandardMaterial({
    color: 0x7f8780,
    roughness: 0.48,
    metalness: 0.65,
  });
  const fabric = new T.MeshStandardMaterial({
    color: 0x8d9177,
    roughness: 0.96,
  });
  const red = new T.MeshStandardMaterial({ color: 0x782e24, roughness: 0.67 });
  const yellow = new T.MeshStandardMaterial({
    color: 0xb5a147,
    roughness: 0.7,
  });
  // Rounded glareshield and instrument panel fasteners.
  bevelBox(k, [0.66, 0.065, 0.17], [0, 0.948, -4.64], 11, black, 0.024);
  bevelBox(k, [0.42, 0.48, 0.105], [0, 0.79, -3.328], 11, seat, 0.038);
  for (const side of [-1, 1]) {
    bevelBox(
      k,
      [0.09, 0.09, 0.38],
      [side * 0.215, 0.455, -3.72],
      11,
      seat,
      0.035,
    );
    // Flat webbing with a metal adjuster, rather than cylindrical rope harnesses.
    k.solid(
      [
        [side * 0.13, 1.12, -3.25],
        [side * 0.18, 1.12, -3.25],
        [side * 0.15, 0.76, -3.25],
        [side * 0.1, 0.76, -3.25],
      ],
      11,
      fabric,
      0.004,
    );
    bevelBox(
      k,
      [0.065, 0.055, 0.014],
      [side * 0.13, 0.87, -3.236],
      11,
      alloy,
      0.005,
    );
    k.solid(
      [
        [side * 0.2, 0.51, -3.53],
        [side * 0.2, 0.49, -3.67],
        [side * 0.035, 0.49, -3.78],
        [side * 0.025, 0.51, -3.71],
      ],
      11,
      fabric,
      0.004,
    );
    // Side console switch strips, capped toggles and rotary controls.
    bevelBox(
      k,
      [0.115, 0.018, 0.72],
      [side * 0.32, 0.608, -3.95],
      11,
      black,
      0.006,
    );
    for (let row = 0; row < 6; row++)
      for (let col = 0; col < 2; col++) {
        const x = side * 0.32 + (col - 0.5) * 0.055,
          z = -4.23 + row * 0.1;
        k.tube(0.012, 0.012, 0.008, [x, 0.622, z], 11, alloy, {
          axis: "y",
          sides: 12,
        });
        k.line(
          [
            [x, 0.627, z],
            [x, 0.653, z + 0.009],
          ],
          11,
          alloy,
          0.004,
        );
        if (row === 1 || row === 4)
          bevelBox(
            k,
            [0.016, 0.009, 0.02],
            [x, 0.657, z + 0.009],
            11,
            row === 1 ? red : black,
            0.003,
          );
      }
    for (let i = 0; i < 3; i++)
      bevelBox(
        k,
        [0.032, 0.015, 0.019],
        [side * 0.25, 0.927, -4.56 + i * 0.028],
        11,
        i === 0 ? red : yellow,
        0.003,
      );
    k.line(
      [
        [side * 0.245, 1.13, -3.28],
        [side * 0.26, 1.03, -3.27],
        [side * 0.265, 0.94, -3.29],
      ],
      11,
      black,
      0.016,
    );
    // Seat emergency handle at the head box.
    k.line(
      [
        [side * 0.1, 1.32, -3.29],
        [side * 0.15, 1.35, -3.29],
        [side * 0.18, 1.31, -3.29],
      ],
      11,
      yellow,
      0.009,
    );
  }
  bevelBox(k, [0.075, 0.025, 0.065], [0, 0.5, -3.72], 11, alloy, 0.008);
  k.line(
    [
      [-0.065, 0.48, -3.99],
      [-0.075, 0.55, -4.01],
      [0, 0.58, -4.015],
      [0.075, 0.55, -4.01],
      [0.065, 0.48, -3.99],
    ],
    11,
    yellow,
    0.011,
  );
  // HUD projector housing remains below the fixed windshield.
  bevelBox(k, [0.18, 0.06, 0.14], [0, 0.855, -4.99], 11, black, 0.012);
  k.animations.push((s) => {
    const values = [
      (s.tas ?? 0) / 340,
      (s.altitude ?? 0) / 10000,
      (s.verticalSpeed ?? 0) / 50,
      s.fuel ?? 1,
      (s.g ?? 1) / 9,
      s.engine ?? 0.7,
    ];
    needles.forEach((n, i) => (n.rotation.z = 0.75 - values[i] * 4.6));
  });
}
function gaugeTexture(index) {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const c = canvas.getContext("2d");
  if (!c) return null;
  c.fillStyle = "#101a17";
  c.fillRect(0, 0, 256, 256);
  c.strokeStyle = "#d3dbc5";
  c.fillStyle = "#d3dbc5";
  c.textAlign = "center";
  c.textBaseline = "middle";
  for (let i = 0; i <= 40; i++) {
    const a = ((-225 + i * 6.75) * Math.PI) / 180,
      r = i % 5 === 0 ? 89 : 96;
    c.lineWidth = i % 5 === 0 ? 3 : 1.5;
    c.beginPath();
    c.moveTo(128 + Math.cos(a) * r, 128 + Math.sin(a) * r);
    c.lineTo(128 + Math.cos(a) * 106, 128 + Math.sin(a) * 106);
    c.stroke();
    if (i % 10 === 0) {
      c.font = "18px sans-serif";
      c.fillText(String(i / 5), 128 + Math.cos(a) * 73, 128 + Math.sin(a) * 73);
    }
  }
  c.font = "bold 21px sans-serif";
  c.fillText(["V", "ALT", "V/S", "FUEL", "G", "RPM"][index], 128, 158);
  c.font = "15px sans-serif";
  c.fillText(["km/h", "m", "m/s", "kg", "G", "%"][index], 128, 184);
  const t = new T.CanvasTexture(canvas);
  t.colorSpace = T.SRGBColorSpace;
  return t;
}

// Bevels are actual geometry: the seat and panel retain highlights at close range.
function bevelBox(k, size, pos, part, mat, r = 0.012, parent) {
  r = Math.min(r, ...size.map((n) => n * 0.45));
  const p = [],
    n = [],
    uv = [],
    ix = [];
  const coordinates = (h) =>
    r > 0.02
      ? [
          -h,
          -h + r * (1 - Math.sqrt(0.75)),
          -h + r * 0.5,
          -h + r,
          h - r,
          h - r * 0.5,
          h - r * (1 - Math.sqrt(0.75)),
          h,
        ]
      : [
          -h,
          -h + r * (1 - Math.SQRT1_2),
          -h + r,
          h - r,
          h - r * (1 - Math.SQRT1_2),
          h,
        ];
  for (let axis = 0; axis < 3; axis++)
    for (const side of [-1, 1]) {
      const axes = [0, 1, 2].filter((a) => a !== axis),
        as = coordinates(size[axes[0]] / 2),
        bs = coordinates(size[axes[1]] / 2),
        base = p.length / 3;
      for (let i = 0; i < as.length; i++)
        for (let j = 0; j < bs.length; j++) {
          const q = V();
          q.setComponent(axis, (side * size[axis]) / 2);
          q.setComponent(axes[0], as[i]);
          q.setComponent(axes[1], bs[j]);
          const core = q.clone();
          for (let a = 0; a < 3; a++)
            core.setComponent(
              a,
              T.MathUtils.clamp(
                q.getComponent(a),
                -size[a] / 2 + r,
                size[a] / 2 - r,
              ),
            );
          const norm = q.clone().sub(core).normalize();
          q.copy(core)
            .addScaledVector(norm, r)
            .add(V(...pos));
          p.push(...q.toArray());
          n.push(...norm.toArray());
          uv.push(i / (as.length - 1), j / (bs.length - 1));
        }
      for (let i = 0; i < as.length - 1; i++)
        for (let j = 0; j < bs.length - 1; j++) {
          const a = base + i * bs.length + j,
            b = a + bs.length;
          const tri =
            axis === 1
              ? [a, a + 1, b, a + 1, b + 1, b]
              : [a, b, a + 1, a + 1, b, b + 1];
          if (side < 0)
            for (let t = 0; t < tri.length; t += 3)
              [tri[t], tri[t + 1]] = [tri[t + 1], tri[t]];
          ix.push(...tri);
        }
    }
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(p, 3));
  g.setAttribute("normal", new T.Float32BufferAttribute(n, 3));
  g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
  g.setIndex(ix);
  return k.mesh(g, mat, part, parent);
}

export function intakeDoor(k, side, m) {
  const part = side < 0 ? 27 : 28,
    pivot = [side * 0.73, -0.12, -1.85],
    door = new T.Group();
  door.position.set(...pivot);
  door.userData.pivot = pivot;
  door.userData.keepGroup = true;
  door.name = "MiG-29 screen-" + (side < 0 ? "left" : "right");
  k.parts[part].add(door);
  const plate = new T.MeshStandardMaterial({
    color: 0x5b6865,
    metalness: 0.35,
    roughness: 0.66,
  });
  bevelBox(
    k,
    [0.63, 0.65, 0.018],
    [pivot[0], pivot[1] - 0.325, pivot[2]],
    part,
    plate,
    0.007,
    door,
  ).name = "MiG-29 fitted FOD ramp";
  for (const x of [-0.22, -0.075, 0.075, 0.22])
    bevelBox(
      k,
      [0.014, 0.54, 0.012],
      [pivot[0] + x, pivot[1] - 0.325, pivot[2] - 0.014],
      part,
      m.metal,
      0.004,
      door,
    );
  k.tube(0.021, 0.021, 0.65, [...pivot], part, m.metal, {
    axis: "x",
    parent: door,
    sides: 16,
  });
  return door;
}

// RD-33: overlapping feathers, inner corrugated liner and fixed-axis aperture.
export function rd33Nozzle(k, side) {
  const x = side * 0.949,
    y = -0.188,
    z = 5.4,
    R = 0.5,
    ep = side < 0 ? 7 : 8,
    np = side < 0 ? 22 : 23;
  const old = new Set();
  for (const part of [ep, np]) k.parts[part].traverse((o) => old.add(o));
  const frame = k.nozzle({
    x,
    y,
    z,
    radius: R,
    length: 0.85,
    enginePart: ep,
    nozzlePart: np,
    darkInterior: true,
  });
  const petals = k.parts[np].children.find(
    (o) => !old.has(o) && o.morphTargetInfluences,
  );
  for (const part of [ep, np])
    for (const o of [...k.parts[part].children])
      if (!old.has(o) && o !== petals && o !== frame) {
        o.removeFromParent();
        o.geometry?.dispose();
      }
  const steel = heatSteel(T),
    inner = heatSteel(T, { liner: true }),
    black = new T.MeshStandardMaterial({
      color: 0x111414,
      roughness: 0.9,
      side: T.DoubleSide,
    });
  k.loft(
    [
      [4.1, 0.53, 0.55, y, x],
      [4.72, 0.55, 0.575, y, x],
      [5.115, 0.54, 0.575, y, x],
      [5.145, 0.521, 0.521, y, x],
    ],
    ep,
    steel,
    { segments: 96, samples: 5 },
  ).name = "MiG-29 RD-33 continuous heat shield";
  const build = (inward = false) => {
    const p = [],
      open = [],
      uv = [],
      ix = [];
    const rows = 8,
      cols = 6;
    for (let blade = 0; blade < 18; blade++) {
      const base = p.length / 3;
      for (let row = 0; row <= rows; row++)
        for (let col = 0; col <= cols; col++) {
          const f = row / rows,
            u = col / cols,
            a = ((blade + u * 1.035) / 18) * Math.PI * 2;
          // Shallow stamped ridge and a convergent/divergent throat profile.
          let r =
            R * (1.04 - 0.17 * Math.sin(f * Math.PI * 0.78)) +
            (inward ? -0.012 : 0) +
            0.004 * Math.sin(u * Math.PI);
          const zz = z - 0.27 + f * 0.64;
          p.push(x + Math.cos(a) * r, y + Math.sin(a) * r, zz);
          r += R * 0.21 * Math.pow(f, 1.35);
          open.push(x + Math.cos(a) * r, y + Math.sin(a) * r, zz);
          uv.push(u, f);
        }
      for (let row = 0; row < rows; row++)
        for (let col = 0; col < cols; col++) {
          const a = base + row * (cols + 1) + col,
            b = a + cols + 1;
          ix.push(a, a + 1, b, a + 1, b + 1, b);
        }
    }
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(p, 3));
    g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
    g.setIndex(ix);
    g.computeVertexNormals();
    const og = g.clone();
    og.setAttribute("position", new T.Float32BufferAttribute(open, 3));
    og.computeVertexNormals();
    g.morphAttributes.position = [og.attributes.position.clone()];
    g.morphAttributes.normal = [og.attributes.normal.clone()];
    og.dispose();
    return g;
  };
  petals.geometry.dispose();
  petals.geometry = build();
  petals.material = steel;
  petals.updateMorphTargets();
  petals.name = "MiG-29 RD-33 18 overlapping feathers";
  const liner = k.mesh(build(true), inner, np);
  liner.userData.keepDynamic = true;
  liner.name = "MiG-29 moving inner nozzle liner";
  // Recessed flame holder with radial arms, not a cap at the exit.
  k.loft(
    [
      [4.34, 0.35, 0.35, y, x],
      [4.85, 0.37, 0.37, y, x],
      [5.13, 0.505, 0.505, y, x],
    ],
    ep,
    inner,
    { segments: 96, samples: 5 },
  ).name = "MiG-29 continuous inner exhaust passage";
  k.tube(0.352, 0.352, 0.018, [x, y, 4.34], ep, black, { sides: 64 });
  for (const zz of [4.45, 4.58, 4.71, 4.84]) {
    const tor = new T.TorusGeometry(0.349, 0.009, 6, 72);
    tor.translate(x, y, zz);
    k.mesh(tor, inner, ep);
  }
  const tor = new T.TorusGeometry(0.19, 0.013, 8, 64);
  tor.translate(x, y, 4.39);
  k.mesh(tor, inner, ep);
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    k.line(
      [
        [x + 0.1 * Math.cos(a), y + 0.1 * Math.sin(a), 4.38],
        [x + 0.32 * Math.cos(a + 0.07), y + 0.32 * Math.sin(a + 0.07), 4.41],
      ],
      ep,
      inner,
      0.008,
    );
    // External hinge collar, rod and heat shield fastener.
    k.line(
      [
        [x + 0.541 * Math.cos(a), y + 0.575 * Math.sin(a), 5.09],
        [x + 0.522 * Math.cos(a), y + 0.522 * Math.sin(a), 5.14],
      ],
      ep,
      steel,
      0.009,
    );
    const b = new T.SphereGeometry(0.013, 8, 6);
    b.translate(x + 0.543 * Math.cos(a), y + 0.575 * Math.sin(a), 5.09);
    k.mesh(b, steel, ep);
  }
  k.animations.push((s) => {
    liner.morphTargetInfluences[0] = T.MathUtils.clamp(
      s.afterburner ?? 0,
      0,
      1,
    );
  });
}

function labelTexture(text, color = "#c8ccc0", border = false) {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 256;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.clearRect(0, 0, 512, 256);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold " + (text === "24" ? 245 : 80) + "px sans-serif";
  if (border) {
    ctx.strokeStyle = "#d5d9ce";
    ctx.lineWidth = 13;
    ctx.strokeText(text, 256, 130, 460);
  }
  ctx.fillStyle = color;
  ctx.fillText(text, 256, 130, 460);
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  return t;
}
export function serviceMarkings(k) {
  // Ray-project a tessellated decal: it follows the curved shell and never floats.
  k.group.updateMatrixWorld(true);
  for (const side of [-1, 1]) {
    const surfaces = [];
    for (const id of [0, 10])
      k.parts[id].traverse((o) => {
        if (o.isMesh && o.material.userData.airframeSurface) surfaces.push(o);
      });
    const project = (cy, cz, w, h, texture, name) => {
      const p = [],
        uv = [],
        ix = [],
        cols = 16,
        rows = 8;
      let valid = true;
      for (let j = 0; j <= rows; j++)
        for (let i = 0; i <= cols; i++) {
          const yy = cy + (j / rows - 0.5) * h,
            zz = cz - side * (i / cols - 0.5) * w;
          const hit = new T.Raycaster(
            V(side * 3, yy, zz),
            V(-side, 0, 0),
            0,
            3,
          ).intersectObjects(surfaces, false)[0];
          if (!hit) {
            valid = false;
            p.push(0, yy, zz);
          } else p.push(hit.point.x + side * 0.003, yy, zz);
          uv.push(i / cols, j / rows);
        }
      if (!valid) return;
      for (let j = 0; j < rows; j++)
        for (let i = 0; i < cols; i++) {
          const a = j * (cols + 1) + i,
            b = a + cols + 1;
          ix.push(a, a + 1, b, a + 1, b + 1, b);
        }
      const g = new T.BufferGeometry();
      g.setAttribute("position", new T.Float32BufferAttribute(p, 3));
      g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
      g.setIndex(ix);
      g.computeVertexNormals();
      const m = new T.MeshStandardMaterial({
        map: texture,
        transparent: true,
        opacity: texture ? 1 : 0,
        depthWrite: false,
        roughness: 0.8,
        side: T.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      });
      k.mesh(g, m, 0).name = name;
    };
    project(
      0.36,
      -5.22,
      0.68,
      0.35,
      labelTexture("24", "#a62f29", true),
      "MiG-29 authored red 24",
    );
    project(
      0.52,
      -4.4,
      0.34,
      0.11,
      labelTexture("ОПАСНО", "#b36a2d"),
      "MiG-29 rescue stencil",
    );
  }
}
