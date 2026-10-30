import {createSu35CombatAircraft} from './su35-combat-model.js?v=5';
import {createClassicAircraft} from './classic-aircraft.js';
import {nozzlePose,NOZZLE_LENGTH,NOZZLE_HINGE} from './nozzle-kinematics.js';
import {enableWorldDepthIn} from './world-depth.js';
import * as THREE from './vendor/three.module.js';
import { applyAirframeSurface, bakeAirframeSurfaceCoordinates } from './airframe-surface.js';
import { partitionGeometry, fractureCapGeometry } from './airframe-geometry.js';
import { PART_NAMES } from './airframe-parts.js';
import { createAirframeDamageOverlay } from './airframe-damage-overlay.js';
import {createWeaponBays} from './weapon-bays.js';
import {createMainWeaponBay} from './main-weapon-bay.js';

// Original procedural exterior. Metres; +X starboard, +Y up, -Z nose.
// Geometry is based on the public F-22 outline, not production CAD.
export function createAircraft(type=0,options={}) {
  if(Number(type)===13)return createSu35CombatAircraft(options);
  if(Number(type)>0)return createClassicAircraft(Number(type),options);
  const group = new THREE.Group();
  group.name = 'F-22 Raptor';
  const clamp = THREE.MathUtils.clamp;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const bodyMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .62, metalness: .22, envMapIntensity: .85 });
  const metalMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .55, metalness: .58, envMapIntensity: .90 });
  const nozzleMat = new THREE.MeshStandardMaterial({vertexColors:true,roughness:.66,metalness:.25,envMapIntensity:.65});
  const darkMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .87, metalness: .08 });
  const lineMat = new THREE.LineBasicMaterial({ color: 0x25292b, transparent: true, opacity: .25 });
  const paleLineMat = new THREE.LineBasicMaterial({ color: 0xb9bdbb, transparent: true, opacity: .19 });
  const batches = new Map();
  const lines = [], paleLines = [];
  const matrix = new THREE.Matrix4();
  const colors = { body: '#899090', upper: '#969c9c', pale: '#a5abaa', dark: '#737b7d', edge: '#9da5a4', belly: '#7e8789' };
  const partNames = PART_NAMES;
  const damageParts = partNames.map((name, index) => {
    const part = new THREE.Group(); part.name = name; part.userData.damageIndex = index; group.add(part); return part;
  });
  let activePart = 0;
  const partLines = partNames.map(() => [[], []]);
  const materialVariants = new Map();
  const healthUniforms = partNames.map(() => ({ value: 1 }));
  const damageState = new Float32Array(partNames.length).fill(1);
  function materialFor(mat, part = activePart) {
    if (![bodyMat, metalMat, nozzleMat, darkMat].includes(mat)) return mat;
    const key = `${mat.id}:${part}`;
    if (materialVariants.has(key)) return materialVariants.get(key);
    const m = mat.clone(), isSkin = mat === bodyMat, isMetal = mat === metalMat || mat === nozzleMat;
    m.name = `${partNames[part]} ${isSkin ? 'RAM coating' : isMetal ? 'heat treated metal' : 'recess'}`;
    m.userData.damageIndex = part;
    m.userData.surfaceBase = isSkin ? 'body' : isMetal ? 'metal' : 'dark';
    applyAirframeSurface(m, isSkin ? 'ram' : isMetal ? 'metal' : 'recess', part, healthUniforms[part]);
    materialVariants.set(key, m); return m;
  }

  function paint(g, color) {
    const c = new THREE.Color(color), a = new Float32Array(g.getAttribute('position').count * 3);
    for (let i = 0; i < a.length; i += 3) { a[i] = c.r; a[i + 1] = c.g; a[i + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    if (!g.getAttribute('normal')) g.computeVertexNormals();
    return g;
  }
  function staticGeo(g, color = colors.body, mat = bodyMat, transform = null) {
    if (g.index) g = g.toNonIndexed();
    if (!g.getAttribute('color')) paint(g, color);
    if (transform) g.applyMatrix4(transform);
    const resolved = materialFor(mat);
    if (!batches.has(resolved)) batches.set(resolved, []);
    batches.get(resolved).push(g);
  }
  function mesh(g, color, mat = bodyMat, parent = damageParts[activePart]) {
    if (!g.getAttribute('color')) paint(g, color);
    const m = new THREE.Mesh(g, materialFor(mat)); m.castShadow = true; m.receiveShadow = true;
    parent.add(m); return m;
  }
  function triGeometry(tris) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(tris.flat(), 3));
    g.computeVertexNormals(); return g;
  }
  function orientedTri(out, a, b, c, normal) {
    const ab = V(...b).sub(V(...a)), ac = V(...c).sub(V(...a));
    if (ab.cross(ac).dot(normal) < 0) out.push(a, c, b); else out.push(a, b, c);
  }
  function polygonGeometry(points, normal = V(0, 1, 0)) {
    const n = normal.clone().normalize(), ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
    const projected = points.map(p => ay >= ax && ay >= az ? new THREE.Vector2(p[0], p[2]) : ax >= az ? new THREE.Vector2(p[1], p[2]) : new THREE.Vector2(p[0], p[1]));
    const triangles = THREE.ShapeUtils.triangulateShape(projected, []), out = [];
    for (const t of triangles) orientedTri(out, points[t[0]], points[t[1]], points[t[2]], n);
    return triGeometry(out);
  }
  function plateGeometry(points, thickness = .09, normal = V(0, 1, 0)) {
    const n = normal.clone().normalize(), top = points.map(p => V(...p).addScaledVector(n, thickness / 2).toArray()), bottom = points.map(p => V(...p).addScaledVector(n, -thickness / 2).toArray());
    const upper = polygonGeometry(top, n), lower = polygonGeometry(bottom, n.clone().negate());
    const result = Array.from(upper.attributes.position.array).concat(Array.from(lower.attributes.position.array));
    const center = points.reduce((sum, p) => sum.add(V(...p)), V(0, 0, 0)).divideScalar(points.length);
    const side = [];
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length, outward = V(...points[i]).add(V(...points[j])).multiplyScalar(.5).sub(center);
      orientedTri(side, top[i], bottom[i], bottom[j], outward);
      orientedTri(side, top[i], bottom[j], top[j], outward);
    }
    result.push(...side.flat());
    upper.dispose(); lower.dispose();
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(result, 3)); g.computeVertexNormals(); return g;
  }
  // A closed tapered section gives a narrow leading-edge highlight and a
  // rounded surface normal. It replaces the old constant-thickness slabs.
  function airfoilGeometry(points, thickness = .11, normal = V(0, 1, 0)) {
    const n = normal.clone().normalize(), tangent = V(0, 0, 1), span = tangent.clone().cross(n).normalize();
    const uv = points.map(p => new THREE.Vector2(V(...p).dot(span), V(...p).dot(tangent)));
    const source = THREE.ShapeUtils.triangulateShape(uv, []), positions = [], indices = [], vertexMap = new Map();
    const edgeDistance = p => {
      const q = new THREE.Vector2(p.dot(span), p.dot(tangent)); let distance = Infinity;
      for (let i = 0; i < uv.length; i++) {
        const a = uv[i], b = uv[(i + 1) % uv.length], ab = b.clone().sub(a);
        const t = clamp(q.clone().sub(a).dot(ab) / Math.max(ab.lengthSq(), 1e-10), 0, 1);
        distance = Math.min(distance, q.distanceTo(a.clone().addScaledVector(ab, t)));
      }
      return distance;
    };
    const add = (p, side) => {
      const d = edgeDistance(p), bulge = .006 + (thickness * .5 - .006) * (1 - Math.exp(-d / .23));
      const v = p.clone().addScaledVector(n, side * bulge), key = `${side}:${v.x.toFixed(5)},${v.y.toFixed(5)},${v.z.toFixed(5)}`;
      if (vertexMap.has(key)) return vertexMap.get(key);
      const id = positions.length / 3; positions.push(v.x, v.y, v.z); vertexMap.set(key, id); return id;
    };
    const push = (a, b, c, side) => {
      const av = V(...positions.slice(a * 3, a * 3 + 3)), bv = V(...positions.slice(b * 3, b * 3 + 3)), cv = V(...positions.slice(c * 3, c * 3 + 3));
      if (bv.sub(av).cross(cv.sub(av)).dot(n) * side < 0) indices.push(a, c, b); else indices.push(a, b, c);
    };
    const subdivisions = 6;
    for (const side of [1, -1]) for (const ids of source) {
      const a = V(...points[ids[0]]), b = V(...points[ids[1]]), c = V(...points[ids[2]]), nodes = [];
      for (let i = 0; i <= subdivisions; i++) {
        nodes[i] = [];
        for (let j = 0; j <= subdivisions - i; j++) nodes[i][j] = add(a.clone().multiplyScalar(1 - (i + j) / subdivisions).addScaledVector(b, i / subdivisions).addScaledVector(c, j / subdivisions), side);
      }
      for (let i = 0; i < subdivisions; i++) for (let j = 0; j < subdivisions - i; j++) {
        push(nodes[i][j], nodes[i + 1][j], nodes[i][j + 1], side);
        if (j < subdivisions - i - 1) push(nodes[i + 1][j], nodes[i + 1][j + 1], nodes[i][j + 1], side);
      }
    }
    const center = points.reduce((a, p) => a.add(V(...p)), V(0, 0, 0)).divideScalar(points.length);
    for (let i = 0; i < points.length; i++) {
      const a = V(...points[i]), b = V(...points[(i + 1) % points.length]);
      for (let j = 0; j < subdivisions; j++) {
        const pa = a.clone().lerp(b, j / subdivisions), pb = a.clone().lerp(b, (j + 1) / subdivisions);
        const ia = add(pa, 1), ib = add(pb, 1), ic = add(pb, -1), id = add(pa, -1);
        const aa = V(...positions.slice(ia * 3, ia * 3 + 3)), bb = V(...positions.slice(ib * 3, ib * 3 + 3)), cc = V(...positions.slice(ic * 3, ic * 3 + 3));
        if (bb.sub(aa).cross(cc.sub(aa)).dot(pa.clone().add(pb).multiplyScalar(.5).sub(center)) > 0) indices.push(ia, ib, ic, ia, ic, id);
        else indices.push(ia, ic, ib, ia, id, ic);
      }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); g.setIndex(indices); g.computeVertexNormals(); return g;
  }
  function path(points, collection = lines, close = false) {
    if (collection === lines) collection = partLines[activePart][0];
    else if (collection === paleLines) collection = partLines[activePart][1];
    for (let i = 1; i < points.length; i++) collection.push(...points[i - 1], ...points[i]);
    if (close && points.length > 1) collection.push(...points[points.length - 1], ...points[0]);
  }
  function localPath(parent, points, material = lineMat, close = true) {
    const a = []; path(points, a, close);
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(a, 3));
    const m = new THREE.LineSegments(geo, material); parent.add(m); return m;
  }
  function box(w, h, d, pos, color, mat = bodyMat, parent = null, rotation = null) {
    const g = new THREE.BoxGeometry(w, h, d);
    if (parent) { const m = mesh(g, color, mat, parent); m.position.set(...pos); if (rotation) m.rotation.set(...rotation); return m; }
    const q = new THREE.Quaternion(); if (rotation) q.setFromEuler(new THREE.Euler(...rotation));
    matrix.compose(V(...pos), q, V(1, 1, 1)); staticGeo(g, color, mat, matrix); return null;
  }
  function strut(parent, a, b, radius, color, mat = metalMat) {
    const delta = V(...b).sub(V(...a));
    const g = new THREE.CylinderGeometry(radius, radius * 1.02, delta.length(), 10);
    const m = mesh(g, color, mat, parent); m.position.copy(V(...a).add(V(...b)).multiplyScalar(.5));
    m.quaternion.setFromUnitVectors(V(0, 1, 0), delta.normalize()); return m;
  }
  function batchRigidDetails(parent) {
    const buckets = new Map();
    for (const child of parent.children) if (child.isMesh && child.material.isMeshStandardMaterial && !child.children.length) {
      if (!buckets.has(child.material)) buckets.set(child.material, []); buckets.get(child.material).push(child);
    }
    for (const [material, children] of buckets) {
      if (children.length < 2) continue;
      const p=[],n=[],c=[];
      for(const child of children){
        child.updateMatrix();const g=child.geometry.index?child.geometry.toNonIndexed():child.geometry.clone();g.applyMatrix4(child.matrix);
        p.push(...g.attributes.position.array);n.push(...g.attributes.normal.array);c.push(...g.attributes.color.array);g.dispose();
        parent.remove(child);child.geometry.dispose();
      }
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(n,3));g.setAttribute('color',new THREE.Float32BufferAttribute(c,3));
      const m=new THREE.Mesh(g,material);m.castShadow=true;m.receiveShadow=true;m.name='batched refractory petals and ribs';parent.add(m);
    }
  }

  // The upper/lower chine is an actual break in the skin, not a drawn edge.
  function loft(sections, centerX = 0, tint = colors.body, mat = bodyMat) {
    const vertices = [], indices = [], cc = [];
    const palette = [1.04, 1.02, .96, .79, .77, .79, .96, 1.02];
    const c = new THREE.Color(tint);
    for (const s of sections) {
      const [z, w, top, bottom, chine = 0] = s;
      const ring = [[0, top], [.58 * w, top - (top - chine) * .12], [w, chine], [.82 * w, bottom + (chine - bottom) * .19], [0, bottom], [-.82 * w, bottom + (chine - bottom) * .19], [-w, chine], [-.58 * w, top - (top - chine) * .12]];
      for (let i = 0; i < 8; i++) { vertices.push(centerX + ring[i][0], ring[i][1], z); cc.push(c.r * palette[i], c.g * palette[i], c.b * palette[i]); }
    }
    for (let j = 0; j < sections.length - 1; j++) for (let i = 0; i < 8; i++) {
      const a = j * 8 + i, b = j * 8 + (i + 1) % 8, d = (j + 1) * 8 + i, c1 = (j + 1) * 8 + (i + 1) % 8;
      indices.push(a, c1, b, a, d, c1);
    }
    for (let i = 1; i < 7; i++) { indices.push(0, i, i + 1); const o = (sections.length - 1) * 8; indices.push(o, o + i + 1, o + i); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(cc, 3)); g.setIndex(indices); g.computeVertexNormals(); staticGeo(g, tint, mat);
  }
  loft([
    [-10, .008, .008, -.008, 0], [-9.70, .14, .078, -.096, -.017], [-9.20, .33, .185, -.204, -.022],
    [-8.62, .52, .32, -.32, -.025], [-8.05, .65, .44, -.40, -.017], [-7.50, .74, .54, -.48, -.005],
    [-6.80, .83, .63, -.57, .013], [-5.95, .91, .69, -.66, .032], [-4.95, .99, .72, -.75, .052],
    [-3.65, 1.10, .74, -.83, .066], [-2.7, 1.15, .69, -.86, .07]
  ], 0, '#7c898e');
  // A single loft integrates the dorsal spine, engine shoulders and chine. In
  // particular there are no independent cylindrical engine tubes on the back.
  const skinSections = [
    [-4.35,1.88,.72,.19,.043,-.70], [-3.55,1.94,.81,.43,.052,-.86],
    [-2.00,2.09,.86,.51,.071,-.92], [-.45,2.17,.78,.57,.089,-.925],
    [1.20,2.17,.67,.61,.091,-.87], [2.80,2.03,.54,.60,.085,-.77],
    [4.22,1.79,.43,.54,.061,-.65], [5.15,1.55,.33,.45,.035,-.49],
    [5.75,1.44,.20,.33,.020,-.38]
  ];
  const skinCross = [-1,-.91,-.72,-.54,-.32,-.15,0,.15,.32,.54,.72,.91,1];
  function sectionAt(z) {
    for(let i=1;i<skinSections.length;i++) if(z<=skinSections[i][0]) {
      const a=skinSections[i-1],b=skinSections[i],t=clamp((z-a[0])/(b[0]-a[0]),0,1);return a.map((v,k)=>v+(b[k]-v)*t);
    }
    return skinSections[skinSections.length-1];
  }
  function crossHeight(f, sec) {
    const [,w,spine,engine,chine]=sec, a=Math.abs(f);
    const nodes=[[0,spine],[.15,spine*.965],[.32,spine*.52+engine*.48],[.54,engine],[.72,engine*.80+chine*.20],[.91,engine*.30+chine*.70],[1,chine]];
    for(let i=1;i<nodes.length;i++)if(a<=nodes[i][0]){const p=nodes[i-1],q=nodes[i],t=(a-p[0])/(q[0]-p[0]);return p[1]+(q[1]-p[1])*t;}
    return chine;
  }
  function skinY(x,z){const sec=sectionAt(z);return crossHeight(Math.abs(x)/sec[1],sec);}
  const up=[],upIndex=[],bottom=[],bottomIndex=[];
  const rows=(skinSections.length-1)*4+1;
  for(let row=0;row<rows;row++){
    const k=Math.min(skinSections.length-2,Math.floor(row/4)),f=(row-k*4)/4;
    const z=skinSections[k][0]+(skinSections[k+1][0]-skinSections[k][0])*f,sec=sectionAt(z);
    for(const x of skinCross)up.push(x*sec[1],crossHeight(x,sec),z);
    for(const [f,y]of [[-1,sec[4]],[-.83,sec[5]+.12],[0,sec[5]],[.83,sec[5]+.12],[1,sec[4]]])bottom.push(f*sec[1],y,z);
  }
  for(let row=0;row<rows-1;row++){
    for(let i=0;i<skinCross.length-1;i++){const a=row*skinCross.length+i,b=a+1,d=a+skinCross.length,c=d+1;upIndex.push(a,d,b,b,d,c);}
    for(let i=0;i<4;i++){const a=row*5+i,b=a+1,d=a+5,c=d+1;bottomIndex.push(a,b,d,b,c,d);}
  }
  for(const [positions,indices,col] of [[up,upIndex,colors.body],[bottom,bottomIndex,colors.belly]]){
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();staticGeo(g,col);
  }
  const skinPts=(poly,lift=.012)=>poly.map(([x,z])=>[x,skinY(x,z)+lift,z]);
  function skinPanel(poly,col=colors.body){staticGeo(polygonGeometry(skinPts(poly)),col);path(skinPts(poly,.017),lines,true);}
  // Saw-tooth access panel borders are small flush strips, not raised camouflage slabs.
  function toothEdge(x0,x1,z,depth=.065,steps=12){const p=[];for(let i=0;i<=steps;i++)p.push([x0+(x1-x0)*i/steps,z+(i%2?depth:0)]);return p;}
  for(const side of [-1,1]){
    skinPanel([[side*.39,-3.18],[side*.85,-3.06],[side*.97,-2.45],[side*.47,-2.57]],'#879297');
    skinPanel([[side*.74,-1.94],[side*1.31,-1.78],[side*1.37,-.99],[side*.78,-1.06]],'#818e94');
    skinPanel([[side*1.48,.44],[side*1.69,.60],[side*1.68,.93],[side*1.48,1.10],[side*1.29,.85],[side*1.31,.60]],'#818e94');
    const service=[...toothEdge(side*.37,side*1.23,3.29,.073,12),[side*1.21,4.08],...toothEdge(side*1.20,side*.35,4.08,.07,12).slice(1)];
    skinPanel(service,'#7a878e');
    path(skinPts([[side*.38,-2.1],[side*.37,-.55],[side*.30,1.55],[side*.28,3.13],[side*.22,4.73]],.017),paleLines);
    path(skinPts([[side*1.39,-1.08],[side*1.56,.04],[side*1.51,1.95],[side*1.30,3.27],[side*1.20,4.74]],.017),lines);
    // Flush auxiliary vent slots at the cockpit fairing shoulders.
    for(let i=0;i<8;i++){
      const z=-2.65+i*.048;staticGeo(polygonGeometry(skinPts([[side*.98,z],[side*1.28,z+.095],[side*1.28,z+.114],[side*.98,z+.019]],.02)),'#45535a',darkMat);
    }
  }
  skinPanel([[-.11,-.55],[.11,-.55],[.15,.44],[0,.62],[-.15,.44]],'#909ba0');
  skinPanel([[-.12,1.49],[.12,1.49],[.12,1.93],[0,2.08],[-.12,1.93]],'#8a969b');
  // Recessed starboard shoulder gun port. No external gun pod or protruding barrels.
  activePart=0;
  const gunMount=V(1.48,.43,-3.10),gunOutline=[[1.22,-3.42],[1.70,-3.28],[1.66,-2.51],[1.20,-2.62]];
  const gunRecess=mesh(polygonGeometry(skinPts(gunOutline,.025)),'#172023',darkMat,damageParts[0]);gunRecess.name='M61A2 recessed gun port';
  const gunDoor=new THREE.Group();gunDoor.name='retracting gun muzzle cover';damageParts[0].add(gunDoor);
  mesh(polygonGeometry(skinPts(gunOutline,.035)),colors.body,bodyMat,gunDoor);
  const gunBarrels=new THREE.Group();gunBarrels.position.copy(gunMount);gunBarrels.name='six recessed M61A2 muzzle ends';damageParts[0].add(gunBarrels);
  for(let i=0;i<6;i++){const angle=i*Math.PI/3,g=new THREE.CylinderGeometry(.013,.013,.16,7);g.rotateX(-Math.PI/2);const barrel=mesh(g,'#454e50',metalMat,gunBarrels);barrel.position.set(Math.cos(angle)*.036,Math.sin(angle)*.036,.08);}
  const gunFlash=new THREE.Mesh(new THREE.ConeGeometry(.13,.82,7,1,true),new THREE.MeshBasicMaterial({color:0xffb454,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));
  gunFlash.name='brief cannon muzzle flash';gunFlash.rotation.x=-Math.PI/2;gunFlash.position.copy(gunMount).add(V(0,0,-.34));group.add(gunFlash);
  // Flat rear beaver-tail between the engines; the stabilators are the aft extremity.
  loft([[4.65,.21,.28,-.28,0],[5.55,.21,.15,-.22,-.01],[6.70,.15,.03,-.12,-.04],[7.40,.013,-.04,-.08,-.06]],0,'#79868a');
  // Actual nose chines and radar-cover perimeter.
  const radomeRing=[[0,.411,-8.18],[.38,.369,-8.18],[.621,-.020,-8.18],[.51,-.309,-8.18],[0,-.383,-8.18],[-.51,-.309,-8.18],[-.621,-.020,-8.18],[-.38,.369,-8.18]];
  path(radomeRing,lines,true);
  for(const side of [-1,1]){
    path([[side*.18,.044,-9.55],[side*.64,-.013,-8.06],[side*.83,.022,-6.81],[side*.99,.06,-4.95],[side*1.22,.085,-3.54]],paleLines);
    path([[side*.59,.411,-7.50],[side*.70,.46,-6.73],[side*.78,.50,-5.62],[side*.87,.48,-4.76]],lines);
    staticGeo(polygonGeometry([[side*.88,.082,-5.18],[side*1.87,.078,-4.32],[side*2.09,.112,-1.86],[side*1.35,.214,-2.25],[side*1.05,.262,-3.98]]),'#89969b');
  }
  // Finely sampled curved canopy shell, closed and opaque with a restrained
  // gold/blue interference coating. No cockpit geometry is present.
  activePart = 11;
  const canopyMat=new THREE.MeshPhysicalMaterial({color:0xffffff,vertexColors:true,metalness:.48,roughness:.115,clearcoat:1,clearcoatRoughness:.065,iridescence:.43,iridescenceIOR:1.30,iridescenceThicknessRange:[110,210],envMapIntensity:1.25});
  canopyMat.userData.damageIndex = 11;
  const canopyControls=[[-7.55,.025,.550,.566],[-7.23,.23,.590,.88],[-6.80,.40,.632,1.20],[-6.26,.51,.671,1.41],[-5.72,.54,.703,1.43],[-5.16,.49,.723,1.27],[-4.61,.34,.737,1.02],[-4.19,.045,.745,.770]];
  const profile=new THREE.CatmullRomCurve3(canopyControls.map(p=>V(p[1],p[2],p[3])),false,'centripetal');
  const canopyZ=new THREE.CatmullRomCurve3(canopyControls.map(p=>V(p[0],0,0)),false,'centripetal');
  const cp=[],ci=[],cc=[],canopyRim=[],arcSteps=32,canopyRows=58;
  for(let k=0;k<=canopyRows;k++){
    const t=k/canopyRows,s=profile.getPoint(t),z=canopyZ.getPoint(t).x;
    canopyRim.push([s.x+.018,s.y+.005,z]);
    for(let j=0;j<=arcSteps;j++){
      const a=Math.PI*j/arcSteps,sa=Math.sin(a);cp.push(Math.cos(a)*s.x,s.y+Math.pow(sa,.92)*(s.z-s.y),z);
      const c=new THREE.Color().setRGB(.135+.025*sa,.122+.059*sa,.090+.092*sa);cc.push(c.r,c.g,c.b);
    }
  }
  for(let k=0;k<canopyRows;k++)for(let j=0;j<arcSteps;j++){const a=k*(arcSteps+1)+j,b=a+1,d=a+arcSteps+1,c=d+1;ci.push(a,b,c,a,c,d);}
  const canopyGeo=new THREE.BufferGeometry();canopyGeo.setAttribute('position',new THREE.Float32BufferAttribute(cp,3));canopyGeo.setAttribute('color',new THREE.Float32BufferAttribute(cc,3));canopyGeo.setIndex(ci);canopyGeo.computeVertexNormals();
  const canopy=new THREE.Mesh(canopyGeo,canopyMat);canopy.name='curved gold-smoke canopy';canopy.castShadow=true;canopy.receiveShadow=true;damageParts[11].add(canopy);
  canopyRim.push(...canopyRim.slice().reverse().map(([x,y,z])=>[-x,y,z]));path(canopyRim,lines,true);
  path(canopyRim.map(([x,y,z])=>[x*1.052,y-.019,z]),paleLines,true);
  const bow=[];for(let j=0;j<=24;j++){const a=Math.PI*j/24;bow.push([Math.cos(a)*.37,.621+Math.pow(Math.sin(a),.92)*.50,-6.885]);}path(bow,lines);
  staticGeo(plateGeometry([[-.20,.555,-7.34],[.20,.555,-7.34],[.54,.71,-5.62],[.35,.745,-4.43],[0,.757,-4.15],[-.35,.745,-4.43],[-.54,.71,-5.62]],.025),'#47565e',darkMat);
  // Recessed trapezoidal inlet mouths and thin, integrated variable-ramp lips.
  for(const side of [-1,1]){
    activePart = side < 0 ? 27 : 28;
    const rim=[[side*.87,.142,-4.48],[side*1.90,.079,-4.28],[side*1.54,-.855,-3.98],[side*.67,-.881,-4.15]];
    const center=rim.reduce((a,p)=>a.add(V(...p)),V(0,0,0)).multiplyScalar(.25);
    const inner=rim.map(p=>V(...p).lerp(center,.074).add(V(0,0,.09)).toArray());
    const recess=inner.map(p=>[p[0]*.91,p[1]+.025,p[2]+.92]);
    const n=V(side*.06,-.04,-1).normalize();
    staticGeo(polygonGeometry(recess,n),'#020406',darkMat);
    for(let i=0;i<4;i++){
      staticGeo(polygonGeometry([rim[i],rim[(i+1)%4],inner[(i+1)%4],inner[i]],n),'#919ea5');
      staticGeo(polygonGeometry([inner[i],inner[(i+1)%4],recess[(i+1)%4],recess[i]],n),i===0?'#465052':'#11181b',darkMat);
    }
    path(rim,lines,true);
    staticGeo(polygonGeometry([[side*.87,.142,-4.48],[side*1.90,.079,-4.28],[side*1.94,.070,-3.46],[side*1.07,.337,-3.75]]),'#829198');
    staticGeo(polygonGeometry([[side*1.90,.079,-4.28],[side*1.54,-.855,-3.98],[side*1.70,-.78,-2.85],[side*2.03,.057,-2.87]],V(side,0,0)),'#77858d');
    path([[side*.87,.19,-4.38],[side*1.33,.31,-3.68],[side*1.70,.37,-2.70]],paleLines);
  }

  const wingY = x => .105 - .019 * (Math.abs(x) - 2.1);
  const wingPoints = (s, poly, lift = 0) => poly.map(([x, z]) => [s * x, wingY(x) + lift, z + 1.10]);
  const ailerons = [], flaperons = [], leadingFlaps = [], stabilators = [], rudders = [];
  function hingedPlate(points, pivot, axis, thickness, color, normal = V(0, 1, 0)) {
    const p = V(...pivot), local = points.map(v => V(...v).sub(p).toArray()), g = new THREE.Group(); g.position.copy(p); damageParts[activePart].add(g);
    mesh(airfoilGeometry(local, thickness, normal), color, bodyMat, g);
    localPath(g, local.map(v => V(...v).addScaledVector(normal, thickness / 2 + .008).toArray()));
    return { group: g, axis: axis.clone().normalize() };
  }
  for (const s of [-1, 1]) {
    activePart = s < 0 ? 1 : 2;
    const wing = [[1.23,-3.63],[2.12,-2.81],[2.12,-2.30],[6.65,1.88],[6.73,1.44],[6.78,1.49], [6.43, 2.69], [5.99, 2.89], [5.99, 1.89], [2.16, 3.43], [2.16, 4.59], [1.91, 4.70], [1.43, 2.16]];
    staticGeo(airfoilGeometry(wingPoints(s, wing), .102), colors.upper);
    // Radar-absorbent edge strips and large, restrained tonal panel regions.
    const lefPoints=wingPoints(s,[[2.12,-2.81],[6.73,1.44],[6.65,1.88],[2.12,-2.30]]);
    activePart = s < 0 ? 18 : 19;
    const lf=hingedPlate(lefPoints,lefPoints[3],V(...lefPoints[2]).sub(V(...lefPoints[3])),.062,'#96a2a9');lf.side=s;lf.part=activePart;lf.group.name=s>0?'right leading-edge flap':'left leading-edge flap';leadingFlaps.push(lf);
    activePart = s < 0 ? 1 : 2;
    const innerLip=wingPoints(s,[[1.23,-3.63],[2.10,-2.83],[2.10,-2.65],[1.30,-3.39]],.053);staticGeo(polygonGeometry(innerLip),colors.edge);
    staticGeo(polygonGeometry(wingPoints(s, [[1.78, -2.34], [4.64, .30], [4.20, 1.23], [2.15, 2.65], [1.76, 1.84]], .053)), '#838f96');
    staticGeo(polygonGeometry(wingPoints(s, [[4.78, .44], [6.50, 1.91], [6.32, 2.39], [4.58, 1.60]], .054)), '#8e9aa1');
    path(wingPoints(s, [[6.73, 1.53], [6.31, 2.52], [6.12, 2.60]], .062), paleLines);
    path(wingPoints(s, [[2.10, -1.80], [3.70, -.34], [2.78, 1.45], [2.17, 1.70]], .065), lines, true);
    path(wingPoints(s, [[3.92, -.03], [5.38, 1.31], [4.00, 1.86], [3.39, 1.15]], .065), lines, true);
    path(wingPoints(s, [[1.70, 2.04], [2.16, 2.72], [3.82, 2.05], [5.94, 1.22]], .065), paleLines);
    const hingeZ = x => 3.43 - (x - 2.16) * (1.54 / 3.83), trailingZ = x => 4.59 - (x - 2.16) * (1.70 / 3.83);
    for (const [lo, hi, store] of [[2.18, 3.89, flaperons], [3.92, 5.96, ailerons]]) {
      activePart = (store === flaperons ? 16 : 14) + (s > 0 ? 1 : 0);
      const points = wingPoints(s, [[lo, hingeZ(lo)], [hi, hingeZ(hi)], [hi, trailingZ(hi)], [lo, trailingZ(lo)]]);
      const pivot = points[0], axis = V(...points[1]).sub(V(...points[0]));
      const control = hingedPlate(points, pivot, axis, .082, '#808b8e'); control.side = s; control.part=activePart;control.group.name=(s>0?'right ':'left ')+(store===flaperons?'flaperon':'aileron'); store.push(control);
    }
    // Small low-visibility formation strips along the leading wing root.
    activePart = lf.part;
    mesh(polygonGeometry(wingPoints(s, [[2.20,-2.56],[2.68,-2.12],[2.62,-2.04],[2.13,-2.48]],.04).map(p=>V(...p).sub(lf.group.position).toArray())), '#a8b39d', bodyMat, lf.group);
    // All-moving horizontal stabilator, with a short narrow fixed root fairing.
    activePart = s < 0 ? 3 : 4;
    const tail=[[1.30,5.03],[2.77,5.67],[4.42,7.05],[4.42,8.34],[2.80,8.88],[1.15,7.36]];
    const points=tail.map(([x,z])=>[s*x,.063-.017*(x-1.5),z]);
    const st=hingedPlate(points,[s*2.08,.052,6.72],V(1,0,0),.075,'#89959b');st.side=s;st.part=activePart;st.group.name=s>0?'right stabilator':'left stabilator';stabilators.push(st);
    const stripe=[[1.35,5.14],[2.74,5.77],[4.34,7.12],[4.33,7.25],[2.67,5.94],[1.39,5.32]].map(([x,z])=>[s*x-s*2.08,.063-.017*(x-1.5)-.052+.043,z-6.72]);
    mesh(polygonGeometry(stripe),colors.edge,bodyMat,st.group);
    localPath(st.group,[[s*.18,.036,-.37],[s*1.99,.005,1.13],[s*.73,.026,1.88],[s*.02,.038,1.04]],paleLineMat);

    // Canted twin fins. The separate trailing rudder rotates about its sloped hinge.
    activePart = s < 0 ? 5 : 6;
    const n = V(s * .90, -.43, 0).normalize();
    const fin = [[s * 1.38, .43, 2.58], [s * 2.68, 2.93, 4.42], [s * 2.70, 2.97, 5.31], [s * 1.67, .65, 5.93], [s * 1.59, .43, 6.74]];
    staticGeo(airfoilGeometry(fin, .10, n), '#889296');
    const rudderPoints = [[s * 2.70, 2.965, 5.35], [s * 2.70, 2.95, 5.94], [s * 1.64, .47, 7.18], [s * 1.67, .65, 5.98]];
    activePart = s < 0 ? 20 : 21;
    const ru = hingedPlate(rudderPoints, [s * 1.67, .65, 5.98], V(s * 1.03, 2.315, -.63), .076, '#7a898e', n); ru.side = s; ru.part=activePart;ru.group.name=s>0?'right rudder':'left rudder'; rudders.push(ru);
    activePart = s < 0 ? 5 : 6;
    // RAM leading strip and subdued rectangular tail panels.
    staticGeo(polygonGeometry([[s * 1.43, .46, 2.72], [s * 2.73, 2.92, 4.46], [s * 2.73, 2.92, 4.62], [s * 1.50, .61, 2.96]], n), '#a0abad');
    path([[s * 1.72, 1.07, 3.55], [s * 2.22, 2.08, 4.28], [s * 2.31, 2.25, 5.13], [s * 1.90, 1.40, 5.35]], paleLines, true);
    path([[s * 1.92, 1.40, 4.56], [s * 2.33, 2.29, 4.77]], lines);
  }

  // Low-visibility national insignia, geometrically generated rather than a texture.
  activePart = 1;
  const star = [], sx = -4.94, sz = 2.80;
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? .13 : .31; star.push([sx + Math.cos(a) * r, wingY(sx) + .059, sz + Math.sin(a) * r]); }
  staticGeo(polygonGeometry(star), '#68777e');
  for (const sign of [-1, 1]) staticGeo(polygonGeometry([[sx + sign * .25, wingY(sx) + .060, sz - .065], [sx + sign * .51, wingY(sx) + .060, sz - .065], [sx + sign * .51, wingY(sx) + .060, sz + .065], [sx + sign * .25, wingY(sx) + .060, sz + .065]]), '#68777e');
  // Flush underside service seams.
  activePart = 0;
  for(const side of [-1,1])path([[side*.20,-.931,-.75],[side*1.21,-.878,-.47],[side*1.20,-.849,1.53],[side*.21,-.83,2.17]],lines,true);

  // Wheel wells and landing gear. Extended wheel contact plane is exactly Y = -2.10 m.
  activePart = 9;
  const gearGroups = [], gearDoors = [], gearWells = [];
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x111820, roughness: .95, metalness: .04 });
  const rubber = (g, parent) => { const m = new THREE.Mesh(g, tireMat); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };
  function wheel(parent, center, radius, width) {
    const tire = rubber(new THREE.CylinderGeometry(radius, radius, width, 20, 1), parent); tire.position.set(...center); tire.rotation.z = Math.PI / 2;
    // Recessed rims expose a dark sidewall and a compact silver hub.
    for (const s of [-1, 1]) {
      const rim = mesh(new THREE.CylinderGeometry(radius * .50, radius * .50, .012, 14), '#a2a6a3', metalMat, parent); rim.rotation.z = Math.PI / 2; rim.position.set(center[0] + s * (width / 2 + .006), center[1], center[2]);
      const hub = mesh(new THREE.CylinderGeometry(radius * .16, radius * .16, .020, 10), '#525d64', metalMat, parent); hub.rotation.z = Math.PI / 2; hub.position.set(center[0] + s * (width / 2 + .016), center[1], center[2]);
    }
    return tire;
  }
  for (const s of [-1, 1]) {
    activePart = s < 0 ? 25 : 26;
    const gg = new THREE.Group(); gg.name = s > 0 ? 'starboard main gear' : 'port main gear'; gg.position.set(s * 1.38, -.58, 1.36); damageParts[activePart].add(gg); gearGroups.push({ group: gg, side: s, nose: false });
    strut(gg, [0, 0, 0], [s * .25, -.77, .18], .068, '#c8cac6');
    strut(gg, [s * .25, -.64, .14], [s * .32, -1.10, .24], .043, '#d8dedc');
    strut(gg, [-s * .34, .08, -.36], [s * .17, -.67, .15], .037, '#aab1b0');
    strut(gg, [s * .14, -.75, .24], [s * .32, -1.10, .24], .043, '#a6acaa');
    strut(gg, [s * .14, -1.10, .24], [s * .42, -1.10, .24], .059, '#979f9f');
    wheel(gg, [s * .32, -1.10, .24], .42, .26);
    activePart = 9;
    const well = mesh(polygonGeometry([[s * .80, -.862, .74], [s * 1.92, -.809, .74], [s * 1.91, -.752, 2.68], [s * .80, -.808, 2.68]], V(0, -1, 0)), '#17232b', darkMat); gearWells.push(well);
    const door = new THREE.Group(); door.position.set(s * 1.91, -.806, .74); damageParts[9].add(door);
    mesh(plateGeometry([[0, 0, 0], [-s * 1.06, -.046, 0], [-s * 1.06, .008, 1.94], [0, .054, 1.94]], .042, V(0, -1, 0)), '#768288', bodyMat, door); gearDoors.push({ group: door, side: s, nose: false });
  }
  activePart = 24;
  const ng = new THREE.Group(); ng.name = 'nose gear'; ng.position.set(0, -.51, -5.50); damageParts[24].add(ng); gearGroups.push({ group: ng, side: 0, nose: true });
  strut(ng, [0, 0, 0], [0, -.83, -.20], .055, '#c9cdca');
  strut(ng, [0, -.70, -.18], [0, -1.21, -.28], .034, '#e0e4df');
  strut(ng, [0, -.04, .48], [0, -.86, -.20], .031, '#aab3b3');
  strut(ng, [0, -1.06, -.24], [0, -1.28, -.30], .045, '#a8b1b3');
  wheel(ng, [0, -1.28, -.30], .31, .18);
  activePart = 9;
  const nw = mesh(polygonGeometry([[-.23, -.602, -6.36], [.23, -.602, -6.36], [.24, -.687, -4.87], [-.24, -.687, -4.87]], V(0, -1, 0)), '#15232c', darkMat); gearWells.push(nw);
  for (const s of [-1, 1]) {
    const door = new THREE.Group(); door.position.set(s * .245, -.638, -6.30); damageParts[9].add(door);
    mesh(plateGeometry([[0, 0, 0], [-s * .24, 0, 0], [-s * .24, -.07, 1.41], [0, -.07, 1.41]], .032, V(0, -1, 0)), colors.belly, bodyMat, door); gearDoors.push({ group: door, side: s, nose: true });
  }

  const nozzles = [], exhaustFrames=[], flames = [], glowMaterials = [], engineUniforms = [];
  // A rectangular F119 exit relaxes into an oval plume. Shock-cell intensity is
  // deliberately weak in daylight, and visible combustion is confined to AB.
  // This is an optical approximation, not a compressible-flow solver.
  const plumeUniforms = { power: { value: 0 }, clock: { value: 0 } };
  const flameMat = new THREE.ShaderMaterial({
    uniforms: plumeUniforms, transparent: true, depthWrite: false,
    side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    vertexShader: `varying vec3 vP; varying vec2 vUV;
      void main(){vP=position;vUV=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `uniform float power;uniform float clock;varying vec3 vP;varying vec2 vUV;
      void main(){float z=vP.z;float t=clamp(z/5.4,0.,1.);
        float cell=pow(.5+.5*cos(z*7.7-.30),7.);
        float turbulent=sin(z*26.-clock*57.+sin(vUV.x*32.+clock*7.))*sin(vUV.x*19.-clock*9.);
        float edge=pow(1.-t,1.65)*smoothstep(0.,.08,t);
        vec3 colour=mix(vec3(1.,.38,.12),vec3(.38,.34,1.),smoothstep(.02,.30,t));
        colour=mix(colour,vec3(.92,.73,.97),cell*.58);
        float alpha=power*edge*(.045+cell*.088)*(1.+turbulent*.24);
        gl_FragColor=vec4(colour*(.75+cell*.65),alpha);}`
  });
  const coreMat = new THREE.ShaderMaterial({
    uniforms: plumeUniforms, transparent: true, depthWrite: false,
    side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    vertexShader: `varying vec2 vUV;void main(){vUV=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `uniform float power;uniform float clock;varying vec2 vUV;
      void main(){float t=vUV.y,z=t*5.4;
        float cells=pow(.5+.5*cos(z*7.7-.30),3.5);
        float width=(.22+.39*pow(1.-t,.55))*(.58+.42*cells);
        float transverse=abs(vUV.x*2.-1.);float core=exp(-5.5*transverse*transverse/(width*width));
        float grain=.89+.11*sin(z*89.-clock*109.+vUV.x*16.);
        float fade=pow(1.-t,1.9)*smoothstep(0.,.025,t);
        vec3 c=mix(vec3(1.,.34,.085),vec3(.52,.36,1.),smoothstep(.06,.34,t));
        c=mix(c,vec3(1.,.89,.68),cells*.42);
        gl_FragColor=vec4(c,core*fade*grain*power*(.06+.23*cells));}`
  });
  function plumeGeometry() {
    const p=[],uv=[],idx=[],rings=72,seg=28;
    for(let j=0;j<=rings;j++){
      const t=j/rings,z=t*5.4,r=(1-.80*t)*(1+.075*Math.sin(z*7.7));
      const shape=1.0-.43*Math.exp(-t*18.);
      for(let k=0;k<=seg;k++){
        const a=k/seg*Math.PI*2,c=Math.cos(a),sn=Math.sin(a);
        p.push(Math.sign(c)*Math.pow(Math.abs(c),shape)*.52*r,Math.sign(sn)*Math.pow(Math.abs(sn),shape)*(.235+.14*t)*r,z);uv.push(k/seg,t);
      }
    }
    for(let j=0;j<rings;j++)for(let k=0;k<seg;k++){const a=j*(seg+1)+k,b=a+1,d=a+seg+1,c=d+1;idx.push(a,b,c,a,c,d);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);return g;
  }
  function plumeCoreGeometry(){
    const p=[],uv=[];
    for(let i=0;i<3;i++){
      const a=i*Math.PI/3,c=Math.cos(a)*.57,s=Math.sin(a)*.28;
      const verts=[[-c,-s,0],[c,s,0],[c,s,5.4],[-c,-s,5.4]],tex=[[0,0],[1,0],[1,1],[0,1]];
      for(const k of [0,1,2,0,2,3]){p.push(...verts[k]);uv.push(...tex[k]);}
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));return g;
  }
  const outerPlumeGeometry=plumeGeometry(),corePlumeGeometry=plumeCoreGeometry();
  for(const side of [-1,1]){
    activePart = side < 0 ? 7 : 8;
    // The external case is a shallow tapered fairing, integrated under the
    // aft fuselage. There is no freestanding rectangular box or black exit card.
    const frame=new THREE.Group();frame.position.set(side*.76,-.04,5.25);damageParts[activePart].add(frame);frame.name='fixed exhaust shroud';
    for(const sign of [-1,1]){
      mesh(plateGeometry([[-.66,sign*.48,-.76],[.66,sign*.48,-.76],[.63,sign*.42,-.14],[.60,sign*.395,.15],[-.60,sign*.395,.15],[-.63,sign*.42,-.14]],.024,V(0,sign,0)),'#929b9d',nozzleMat,frame);
      mesh(plateGeometry([[sign*.66,.48,-.76],[sign*.60,.395,.15],[sign*.60,-.395,.15],[sign*.66,-.48,-.76]],.022,V(sign,0,0)),'#879194',nozzleMat,frame);
    }
    // Recessed, three-dimensional duct walls reveal depth behind the flaps.
    // Thin cooling louvers sit well upstream, rather than covering the mouth.
    const duct=new THREE.Group();duct.name='recessed exhaust duct';frame.add(duct);
    for(const sign of [-1,1]){
      mesh(plateGeometry([[-.51,sign*.27,-1.04],[.51,sign*.27,-1.04],[.585,sign*.36,.04],[-.585,sign*.36,.04]],.012,V(0,-sign,0)),'#697579',nozzleMat,duct);
      mesh(plateGeometry([[sign*.51,.27,-1.04],[sign*.585,.36,.04],[sign*.585,-.36,.04],[sign*.51,-.27,-1.04]],.012,V(-sign,0,0)),'#636e73',nozzleMat,duct);
    }
    for(let j=-2;j<=2;j++)mesh(plateGeometry([[-.50,j*.10,-.91],[.50,j*.10,-.91],[.50,j*.10+.045,-.75],[-.50,j*.10+.045,-.75]],.012,V(0,1,.25).normalize()),'#606b70',nozzleMat,duct);
    batchRigidDetails(duct);batchRigidDetails(frame);
    activePart=side<0?22:23;
    const nozzle=new THREE.Group();nozzle.name=side>0?'right vectoring nozzle':'left vectoring nozzle';nozzle.position.copy(frame.position);damageParts[activePart].add(nozzle);
    const flaps=[];
    for(const sign of [1,-1]){
      const flap=new THREE.Group();flap.name=sign>0?'upper hinged vector flap':'lower hinged vector flap';flap.position.y=sign*NOZZLE_HINGE;nozzle.add(flap);flaps.push(flap);
      const points=[[-.615,0,-.34],[.615,0,-.34],[.535,0,1.37],[.40,0,1.47],[.27,0,1.37],[.13,0,1.47],[0,0,1.37],[-.13,0,1.47],[-.27,0,1.37],[-.40,0,1.47],[-.535,0,1.37]];
      const outer=mesh(plateGeometry(points,.026,V(0,sign,0)),'#959ea1',nozzleMat,flap);outer.name='tapered silver vector flap';
      mesh(plateGeometry(points.map(([x,y,z])=>[x*.96,-sign*.024,z-.035]),.012,V(0,-sign,0)),'#6c777c',nozzleMat,flap);
      const seam=[];
      for(let i=-3;i<=3;i++){
        const x=i*.156;path([[x,sign*.018,-.20],[x*.87,sign*.018,1.32]],seam);
        mesh(plateGeometry([[x-.070,sign*.017,-.16],[x+.070,sign*.017,-.16],[x*.87+.058,sign*.017,1.31],[x*.87,sign*.017,1.39],[x*.87-.058,sign*.017,1.31]],.006,V(0,sign,0)),i%2?'#8e999c':'#9aa4a6',nozzleMat,flap);
      }
      const seamGeo=new THREE.BufferGeometry();seamGeo.setAttribute('position',new THREE.Float32BufferAttribute(seam,3));flap.add(new THREE.LineSegments(seamGeo,paleLineMat));batchRigidDetails(flap);
    }
    // Sliding side seals preserve a closed duct while the top and bottom flaps
    // articulate independently. Their upstream edges stay inside the fixed cheeks.
    const seals=[];
    for(const sign of [-1,1]){
      const points=[[sign*.606,NOZZLE_HINGE,-.22],[sign*.535,.145,1.45],[sign*.535,-.145,1.45],[sign*.606,-NOZZLE_HINGE,-.22]];
      const seal=mesh(plateGeometry(points,.022,V(sign,0,0)),'#879397',nozzleMat,nozzle);seal.name='overlapping nozzle side seal';
      seal.geometry.attributes.position.setUsage(THREE.DynamicDrawUsage);seals.push({mesh:seal,original:seal.geometry.attributes.position.array.slice()});
    }
    for(const sign of [1,-1]){
      const rearY=sign*(NOZZLE_HINGE+(.145-NOZZLE_HINGE)*.35/NOZZLE_LENGTH+.025);
      const cover=mesh(plateGeometry([[-.65,sign*.415,-.25],[.65,sign*.415,-.25],[.612,rearY,.35],[-.612,rearY,.35]],.018,V(0,sign,0)),'#909b9e',nozzleMat,nozzle);cover.name='overlapping root fairing';
      cover.geometry.attributes.position.setUsage(THREE.DynamicDrawUsage);seals.push({mesh:cover,original:cover.geometry.attributes.position.array.slice(),rootCover:sign});
    }
    const socket=new THREE.Group();socket.name='vectored exhaust exit';nozzle.add(socket);exhaustFrames.push(socket);
    const glowMat=new THREE.ShaderMaterial({uniforms:{heat:{value:0},afterburner:{value:0}},transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,
      vertexShader:`varying vec2 vUV;void main(){vUV=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader:`uniform float heat;uniform float afterburner;varying vec2 vUV;void main(){vec2 d=abs(vUV*2.-1.);float rim=smoothstep(.25,.92,max(d.x,d.y));float detail=.65+.35*pow(.5+.5*cos(vUV.x*65.),2.);vec3 c=mix(vec3(.62,.075,.015),vec3(1.,.45,.11),afterburner);gl_FragColor=vec4(c,heat*(.035+rim*.095)*detail+afterburner*.36);}`
    });glowMaterials.push(glowMat);
    const glow=new THREE.Mesh(new THREE.PlaneGeometry(.96,.12),glowMat);glow.position.z=-.36;glow.name='recessed augmentor glow';socket.add(glow);
    const plume=new THREE.Group();plume.position.z=.015;socket.add(plume);flames.push(plume);
    const uniforms = { power: { value: 0 }, clock: { value: 0 } }; engineUniforms.push(uniforms);
    const shellMaterial = flameMat.clone(); shellMaterial.uniforms = uniforms;
    const coreMaterial = coreMat.clone(); coreMaterial.uniforms = uniforms;
    const shell=new THREE.Mesh(outerPlumeGeometry,shellMaterial);shell.renderOrder=3;plume.add(shell);
    const core=new THREE.Mesh(corePlumeGeometry,coreMaterial);core.renderOrder=3;plume.add(core);
    nozzles.push({group:nozzle,flaps,seals,socket,glow,angle:0,opening:-1});
  }

  // Navigation/formation lights use emissive materials; they introduce no dynamic lights.
  const navMats = [new THREE.MeshBasicMaterial({ color: 0xff3b25 }), new THREE.MeshBasicMaterial({ color: 0x49ffa3 })];
  const strobeMat = new THREE.MeshBasicMaterial({ color: 0xe9faff });
  const navLights = [], strobes = [];
  for (let i = 0; i < 2; i++) {
    const s = i === 0 ? -1 : 1;
    const nav = new THREE.Mesh(new THREE.SphereGeometry(.043, 7, 5), navMats[i]); nav.position.set(s * 6.68, .053, 2.73); damageParts[12+i].add(nav); navLights.push(nav);
    const strobe = new THREE.Mesh(new THREE.SphereGeometry(.048, 7, 5), strobeMat); strobe.position.set(s * 6.63, .044, 3.15); damageParts[12+i].add(strobe); strobes.push(strobe);
  }
  const tailLight = new THREE.Mesh(new THREE.SphereGeometry(.035, 7, 5), strobeMat); tailLight.position.set(0, .25, 7.35); damageParts[29].add(tailLight);

  // Batch fixed geometry per component and material, so damage does not leave
  // detached panels, lights, markings or hinge lines floating in mid-air.
  for (const [mat, geometries] of batches) {
    let count = 0; for (const g of geometries) count += g.attributes.position.count;
    const p = new Float32Array(count * 3), n = new Float32Array(count * 3), c = new Float32Array(count * 3); let offset = 0;
    for (const g of geometries) {
      const len = g.attributes.position.array.length; p.set(g.attributes.position.array, offset); n.set(g.attributes.normal.array, offset); c.set(g.attributes.color.array, offset); offset += len; g.dispose();
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(p, 3)); geometry.setAttribute('normal', new THREE.BufferAttribute(n, 3)); geometry.setAttribute('color', new THREE.BufferAttribute(c, 3)); geometry.computeBoundingSphere();
    const m = new THREE.Mesh(geometry, mat); m.castShadow = true; m.receiveShadow = true; m.name = 'batched ' + mat.name; damageParts[mat.userData.damageIndex ?? 0].add(m);
  }
  for (let i=0;i<partLines.length;i++) for (const [a, mat] of [[partLines[i][0], lineMat], [partLines[i][1], paleLineMat]]) {
    if (!a.length) continue;
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(a, 3)); damageParts[i].add(new THREE.LineSegments(g, mat));
  }
  const fractureMat = new THREE.MeshStandardMaterial({color:0x4b4c47,roughness:.78,metalness:.45,side:THREE.DoubleSide});
  function splitFixedPart(sourceIndex,targetIndex,axis,value,targetLess){
    const source=damageParts[sourceIndex],target=damageParts[targetIndex],cutPoints=[];
    for(const node of source.children.slice()){
      if(!node.isMesh&&!node.isLineSegments)continue;
      // Fixed skin batches are authored directly in aircraft coordinates. All
      // movable controls were assigned their own roots before this partition.
      const kept=partitionGeometry(node.geometry,axis,value,!targetLess,node.isLineSegments);
      const moved=partitionGeometry(node.geometry,axis,value,targetLess,node.isLineSegments);
      if(node.isMesh)cutPoints.push(...moved.intersections);
      for(const [result,parent,part]of [[kept,source,sourceIndex],[moved,target,targetIndex]]){
        if(!result.geometry.attributes.position.count){result.geometry.dispose();continue;}
        const base=node.material.userData.surfaceBase;
        const material=node.isMesh&&base?materialFor(base==='body'?bodyMat:base==='metal'?metalMat:darkMat,part):node.material;
        const section=node.isMesh?new THREE.Mesh(result.geometry,material):new THREE.LineSegments(result.geometry,material);
        section.name=`${partNames[part]} / ${node.name||'surface'}`;section.castShadow=node.castShadow;section.receiveShadow=node.receiveShadow;parent.add(section);
      }
      source.remove(node);node.geometry.dispose();
    }
    for(const [part,direction]of [[sourceIndex,targetLess?-1:1],[targetIndex,targetLess?1:-1]]){
      const geometry=fractureCapGeometry(cutPoints,axis,direction);if(!geometry)continue;
      const cap=new THREE.Mesh(geometry,fractureMat);cap.name='structural station fracture face';cap.userData.fractureFace=true;cap.castShadow=cap.receiveShadow=true;damageParts[part].add(cap);
    }
  }
  // The cut surface belongs to each section, but no exterior triangle is
  // duplicated across damage roots. Local controls remain separate pieces.
  splitFixedPart(0,10,2,-6.4,true);
  splitFixedPart(0,29,2,2.3,false);
  splitFixedPart(1,12,0,-4.6,true);
  splitFixedPart(2,13,0,4.6,false);
  const brokenEdges = [];
  for (const side of [-1, 1]) {
    // Structural caps remain on the fuselage when a major surface is lost.
    // Their small sawtooth silhouette avoids the appearance of a clean toggle.
    for (const spec of [
      { index:side<0?1:2,x:side*1.72,y:.06,z0:-.95,z1:4.96,height:.14 },
      { index:side<0?3:4,x:side*1.43,y:.06,z0:5.58,z1:7.34,height:.10 },
      { index:side<0?5:6,x:side*1.49,y:.46,z0:2.96,z1:6.40,height:.13 }
    ]) {
      const p=[];
      for(let i=0;i<=16;i++)p.push([spec.x+side*(i%2?.075:0),spec.y+spec.height*(i%2?.40:1),spec.z0+(spec.z1-spec.z0)*i/16]);
      p.push([spec.x,spec.y-spec.height,spec.z1],[spec.x,spec.y-spec.height,spec.z0]);
      const cap=new THREE.Mesh(polygonGeometry(p,V(side,0,0)),fractureMat);cap.name='fracture '+partNames[spec.index];cap.userData.fractureFace=true;cap.castShadow=true;cap.visible=false;damageParts[spec.index<=2?0:29].add(cap);brokenEdges.push({mesh:cap,index:spec.index});
    }
  }
  const weaponBays=createWeaponBays(group,damageParts[0]);
  const mainWeaponBay=createMainWeaponBay(damageParts[0]);
  group.userData.damagePartNames = partNames.slice();
  group.userData.dimensions = { length: 18.9, wingspan: 13.56, heightWithGear: 5.10 };
  group.userData.contactPoints = [[0, -2.10, -5.80], [-1.70, -2.10, 1.60], [1.70, -2.10, 1.60]];
  // Body-local emission points at the actual revised geometry. A moving exhaust
  // endpoint is obtained by rotating exhaustLocal about its nozzlePivots entry.
  group.userData.effectsAnchors = {
    exhaust: [[-.76,-.04,6.70],[.76,-.04,6.70]],
    nozzlePivots: [[-.76,-.04,5.25],[.76,-.04,5.25]],
    exhaustLocal: [0,0,1.45],
    wingTips: [[-6.60,.04,3.72],[6.60,.04,3.72]],
    vaporRoots: [[-1.92,.30,-2.23],[1.92,.30,-2.23]],
    leadingEdges: [[[-2.12,.18,-1.71],[-6.70,.08,2.54]],[[2.12,.18,-1.71],[6.70,.08,2.54]]]
  };
  const damageOverlay=createAirframeDamageOverlay(group,damageParts);
  const q = new THREE.Quaternion();
  function update(state = {}, dt = 1 / 60) {
    const finite=(value,fallback=0)=>Number.isFinite(value)?value:fallback;
    const pitch=clamp(finite(state.pitchInput),-1,1),roll=clamp(finite(state.rollInput),-1,1),yaw=clamp(finite(state.yawInput),-1,1);
    const gear=clamp(finite(state.gear),0,1),brake=clamp(finite(state.airbrake),0,1),t=finite(state.time);
    const engine=clamp(finite(state.engine,finite(state.throttle,.6)),0,1.2),ab=clamp(finite(state.afterburner,(engine-1)/.20),0,1);
    const enabled=part=>state.enabled?.[part]!==false&&state.enabled?.[part]!==0;
    for(let i=0;i<damageParts.length;i++){
      const integrity=clamp(finite(state.health?.[i],1),0,1);damageState[i]=integrity;healthUniforms[i].value=integrity;
      damageParts[i].visible=integrity>=.08;
      damageParts[i].userData.health=integrity;
      damageParts[i].userData.enabled=enabled(i);
    }
    weaponBays.update(state.missiles);
    mainWeaponBay.update(state.amraam,state.bombs);
    const gunOpen=clamp(finite(state.gunDoor),0,1),gunFire=finite(state.gunFiring)>0&&damageState[0]>=.08;
    gunDoor.position.set(0,-.055*gunOpen,.74*gunOpen);gunDoor.visible=gunOpen<.99;gunBarrels.visible=gunOpen>.80;
    gunFlash.visible=gunFire;gunFlash.material.opacity=gunFire?.48+.35*Math.abs(Math.sin(t*137)):0;gunFlash.scale.setScalar(.72+.28*Math.abs(Math.sin(t*91)));
    for(const edge of brokenEdges)edge.mesh.visible=damageState[edge.index]<.08;
    // Loss of coating and local crushing precede complete surface separation.
    for(const [wing,parts,sign]of [[1,[1,12,14,16,18],-1],[2,[2,13,15,17,19],1]]){
      const rotation=sign*Math.pow(1-damageState[wing],2)*.095;
      for(const part of parts)damageParts[part].rotation.z=rotation;
    }
    damageParts[5].rotation.z=Math.pow(1-damageState[5],2)*.055;
    damageParts[6].rotation.z=-Math.pow(1-damageState[6],2)*.055;
    damageParts[20].rotation.z=damageParts[5].rotation.z;damageParts[21].rotation.z=damageParts[6].rotation.z;
    const sideField=(state,side,left,right,fallback)=>finite(state[side<0?left:right],fallback);
    for(const c of stabilators){
      if(!enabled(c.part))continue;
      const angle=sideField(state,c.side,'leftTail','rightTail',.24*pitch-c.side*.075*roll-.065*brake);
      c.group.rotation.x=-clamp(angle,-.52,.52);
    }
    for(const c of ailerons){
      if(!enabled(c.part))continue;
      const angle=sideField(state,c.side,'leftAileron','rightAileron',c.side*.26*roll+.04*pitch-.035*gear+.19*brake);
      q.setFromAxisAngle(c.axis,-c.side*clamp(angle,-.55,.55));c.group.quaternion.copy(q);
    }
    for(const c of flaperons){
      if(!enabled(c.part))continue;
      const angle=sideField(state,c.side,'leftFlap','rightFlap',finite(state.flaperon,.22*gear-.035*pitch+.12*brake)-c.side*.055*roll);
      q.setFromAxisAngle(c.axis,c.side*clamp(angle,-.52,.65));c.group.quaternion.copy(q);
    }
    for(const c of leadingFlaps){
      if(!enabled(c.part))continue;
      const angle=clamp(sideField(state,c.side,'leftLEF','rightLEF',finite(state.lef,Math.max(0,finite(state.alpha)*.42)+gear*.12)),-.07,.61);
      q.setFromAxisAngle(c.axis,-c.side*angle);c.group.quaternion.copy(q);
    }
    for(const c of rudders){
      if(!enabled(c.part))continue;
      const angle=sideField(state,c.side,'leftRudder','rightRudder',.21*yaw+c.side*.18*brake);
      q.setFromAxisAngle(c.axis,clamp(angle,-.6,.6));c.group.quaternion.copy(q);
    }
    for(const g of gearGroups){
      g.group.visible=gear>.014;
      if(g.nose){g.group.rotation.x=(1-gear)*1.48;g.group.rotation.y=-yaw*.24*gear;}
      else g.group.rotation.z=-g.side*(1-gear)*1.49;
    }
    for(const d of gearDoors)d.group.rotation.z=d.side*gear*(d.nose?1.38:1.15);
    for(const well of gearWells)well.visible=gear>.05;
    for(let i=0;i<nozzles.length;i++){
      const factor=clamp(finite(state[i===0?'leftEngineFactor':'rightEngineFactor'],Math.pow(damageState[7+i],1.6)),0,1);
      const output=ab*factor;
      const n=nozzles[i];
      if(enabled(22+i)&&damageState[22+i]>=.08){
        const angle=clamp(finite(state[i===0?'leftNozzle':'rightNozzle'],finite(state.nozzle)),-Math.PI/9,Math.PI/9),opening=.145+.10*output;
        if(angle!==n.angle||opening!==n.opening){
          const pose=nozzlePose(angle,opening);n.angle=pose.angle;n.opening=pose.opening;
          for(const [flap,part]of [[n.flaps[0],pose.upper],[n.flaps[1],pose.lower]]){flap.rotation.x=part.angle;flap.scale.z=part.length;}
          n.socket.position.set(0,pose.y,pose.z);n.socket.rotation.x=-pose.angle;n.glow.scale.y=pose.opening/.145;
          for(const seal of n.seals){const attr=seal.mesh.geometry.attributes.position,a=seal.original;
            for(let k=0;k<attr.count;k++){const j=k*3;
              if(seal.rootCover){const sign=seal.rootCover,target=sign>0?pose.upper:pose.lower,neutral=sign*(NOZZLE_HINGE+(.145-NOZZLE_HINGE)*.35/NOZZLE_LENGTH+.025),end=a[j+2]>.1;const y=sign*NOZZLE_HINGE+(target.y-sign*NOZZLE_HINGE)*.35/target.z+sign*.025;attr.setXYZ(k,a[j],end?a[j+1]+y-neutral:a[j+1],a[j+2]);}
              else{const end=a[j+2]>.8,upper=a[j+1]>0,target=upper?pose.upper:pose.lower;attr.setXYZ(k,a[j],end?target.y:a[j+1],end?target.z:a[j+2]);}
            }
            attr.needsUpdate=true;seal.mesh.geometry.computeVertexNormals();seal.mesh.geometry.computeBoundingSphere();
          }
        }
      }
      glowMaterials[i].uniforms.heat.value=engine*factor;glowMaterials[i].uniforms.afterburner.value=output;
      engineUniforms[i].power.value=output;engineUniforms[i].clock.value=t;
      flames[i].visible=output>.006;flames[i].scale.z=(.46+.54*ab)*(.35+.65*factor);flames[i].scale.x=.98+.016*Math.sin(t*47.+i);
    }
    const pulse = (t % 1.15) < .045 || ((t + .11) % 1.15) < .035;
    for (const strobe of strobes) strobe.visible = pulse;
    damageOverlay.update(damageState);
  }
  bakeAirframeSurfaceCoordinates(group);enableWorldDepthIn(group);
  group.userData.damagePartBounds=damageParts.map(part=>{
    const bounds=new THREE.Box3();
    part.traverse(node=>{if(!node.isMesh||node.material.isShaderMaterial||node.userData.fractureFace)return;const g=node.geometry;if(!g.boundingBox)g.computeBoundingBox();bounds.union(g.boundingBox.clone().applyMatrix4(node.matrixWorld));});
    return {min:bounds.min.toArray(),max:bounds.max.toArray(),center:bounds.getCenter(V(0,0,0)).toArray(),half:bounds.getSize(V(0,0,0)).multiplyScalar(.5).toArray()};
  });
  update({ gear: 0, engine: .6 });
  return { group, update, damageParts, exhaustFrames,weaponBays,mainWeaponBay,gun:{mount:gunMount,door:gunDoor,barrels:gunBarrels,flash:gunFlash}, setDamageOverlay:enabled=>damageOverlay.setEnabled(enabled), damageOverlay:damageOverlay.root };
}
