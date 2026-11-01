// SPDX-License-Identifier: GPL-2.0-only
import * as T from "./vendor/three.module.js";
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
function paint(m, health) {
  m.userData.airframeSurface = true;
  m.onBeforeCompile = (s) => {
    s.uniforms.migIntegrity = health;
    s.vertexShader =
      "attribute vec3 liveryPosition; varying vec3 migP;\n" + s.vertexShader;
    s.vertexShader = s.vertexShader.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\nmigP=liveryPosition;",
    );
    s.fragmentShader =
      "varying vec3 migP;uniform float migIntegrity;\nfloat migBox(vec2 p,vec2 b){vec2 q=abs(p)-b;return length(max(q,0.))+min(max(q.x,q.y),0.); }\n" +
      s.fragmentShader;
    s.fragmentShader = s.fragmentShader.replace(
      "#include <color_fragment>",
      `#include <color_fragment>
 vec3 p=migP;float field=min(length((p.xz-vec2(-1.4,-1.3))/vec2(1.5,2.8)),length((p.xz-vec2(2.7,1.6))/vec2(2.3,1.5)));field=min(field,length((p.xz-vec2(-3.5,2.2))/vec2(2.0,1.5)));field=min(field,length((p.xz-vec2(.3,5.2))/vec2(1.3,1.6)));
 vec3 coat=mix(vec3(.32,.37,.32),vec3(.13,.19,.14),1.-smoothstep(.94,1.03,field));coat=mix(vec3(.34,.41,.43),coat,smoothstep(-.25,.2,p.y));if(p.z<-6.5)coat=vec3(.13,.19,.16);float seam=10.;
 if(p.y>.15&&p.z>-.8&&p.z<4.0){seam=min(seam,abs(migBox(vec2(abs(p.x)-.60,p.z-1.25),vec2(.22,.76))));seam=min(seam,abs(migBox(vec2(abs(p.x)-.54,p.z-3.02),vec2(.18,.60))));}
 if(p.y<-.30&&p.z>.3&&p.z<4.6&&abs(p.x)<1.5)seam=min(seam,abs(migBox(vec2(abs(p.x)-.95,p.z-2.2),vec2(.31,1.05))));
 coat*=mix(.76,1.,smoothstep(.003,.012,seam));
 float detail=mix(.68,1.08,clamp(dot(diffuseColor.rgb,vec3(.2126,.7152,.0722)),0.,1.));diffuseColor.rgb=mix(coat*.46,coat,clamp(migIntegrity,0.,1.))*detail;`,
    );
  };
  m.customProgramCacheKey = () => "mig29-grey-green-v1";
  return m;
}
export function createMig29Model(asset, { combat = false } = {}) {
  const k = createAirframeKit(MIG29),
    textures = asset.textures || {},
    motions = new Map(),
    integrity = Array.from({ length: 30 }, () => ({ value: 1 }));
  const skin = new T.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.albedo ?? null,
    roughness: 0.75,
    metalness: 0.07,
    aoMap: textures.ao ?? null,
    aoMapIntensity: 0.35,
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
        opacity: 0.38,
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
          x + Math.sign(c) * Math.abs(c) ** pow * (0.34 - 0.04 * t),
          y + Math.sign(s) * Math.abs(s) ** pow * (0.38 - 0.08 * t),
          z + t * 2.8,
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
    k.mesh(g, materials.dark, part).name = "MiG-29 recessed inlet duct";
    k.tube(0.3, 0.3, 0.03, [x, y, z + 2.8], part, materials.dark);
    for (let i = 0; i < 24; i++) {
      const a = (i / N) * Math.PI * 4;
      k.solid(
        [
          [x, y, z + 2.73],
          [x + 0.28 * Math.cos(a), y + 0.28 * Math.sin(a), z + 2.75],
          [
            x + 0.28 * Math.cos(a + 0.14),
            y + 0.28 * Math.sin(a + 0.14),
            z + 2.72,
          ],
        ],
        part,
        materials.metal,
        0.003,
      );
    }
    inlets.push({ center: [x, y, z], part });
    // Continuous outer nacelle sleeve joins the original shell to the moving petals.
    k.loft(
      [
        [4.1, 0.5, 0.48, -0.188, side * 0.949],
        [4.5, 0.51, 0.49, -0.188, side * 0.949],
        [4.88, 0.48, 0.46, -0.188, side * 0.949],
        [5.1, 0.445, 0.435, -0.188, side * 0.949],
      ],
      side < 0 ? 7 : 8,
      materials.metal,
      { segments: 64, samples: 4 },
    );
    k.nozzle({
      x: side * 0.949,
      y: -0.188,
      z: 5.13,
      radius: 0.42,
      length: 0.85,
      enginePart: side < 0 ? 7 : 8,
      nozzlePart: side < 0 ? 22 : 23,
      darkInterior: true,
    });
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
        g.quaternion.setFromAxisAngle(
          V(1, side * 0.2, 0).normalize(),
          -(1 - fod) * 0.823,
        );
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
function cockpit(k, m) {
  const panel = new T.MeshStandardMaterial({ color: 0x163c38, roughness: 0.8 }),
    black = m.dark,
    seat = new T.MeshStandardMaterial({ color: 0x394139, roughness: 0.95 });
  k.box([0.63, 0.55, 0.12], [0, 0.65, -4.63], 11, panel);
  k.box([0.48, 0.78, 0.18], [0, 0.76, -3.44], 11, seat);
  k.box([0.37, 0.25, 0.24], [0, 1.21, -3.44], 11, black);
  k.box([0.48, 0.12, 0.48], [0, 0.41, -3.72], 11, seat);
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
    k.line(
      [
        [side * 0.15, 1.13, -3.34],
        [side * 0.12, 0.74, -3.29],
        [side * 0.22, 0.48, -3.61],
      ],
      11,
      new T.MeshStandardMaterial({ color: 0x9c9d7c, roughness: 0.95 }),
      0.022,
    );
    k.box([0.025, 0.075, 0.08], [side * 0.23, 1.21, -3.29], 11, black);
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
    k.box([0.13, 0.11, 0.86], [side * 0.32, 0.54, -3.95], 11, panel);
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
