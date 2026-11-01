import * as T from "./vendor/three.module.js";

export function batchStaticMeshes(parent) {
  // Retain smooth vertex normals and every attribute. Recomputing normals after
  // non-indexing was the old model's flat-faceted fuselage regression.
  const buckets = new Map();
  for (const child of [...parent.children]) {
    if (
      !child.isMesh ||
      child.userData.keepDynamic ||
      child.geometry.morphAttributes.position ||
      child.material.isShaderMaterial ||
      child.material.transparent
    )
      continue;
    const key = child.material.uuid;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(child);
  }
  for (const list of buckets.values()) {
    if (list.length < 2) continue;
    const sizes = new Map([
        ["position", 3],
        ["normal", 3],
        ["uv", 2],
      ]),
      attributes = {},
      indices = [];
    for (const m of list)
      for (const [name, a] of Object.entries(m.geometry.attributes))
        sizes.set(name, a.itemSize);
    for (const name of sizes.keys()) attributes[name] = [];
    let offset = 0;
    for (const m of list) {
      m.updateMatrix();
      const g = m.geometry.clone();
      g.applyMatrix4(m.matrix);
      const n = g.attributes.position.count;
      for (const [name, size] of sizes) {
        const a = g.attributes[name];
        for (let i = 0; i < n * size; i++)
          attributes[name].push(a ? a.array[i] : name === "color" ? 1 : 0);
      }
      if (g.index) for (const i of g.index.array) indices.push(offset + i);
      else for (let i = 0; i < n; i++) indices.push(offset + i);
      offset += n;
      g.dispose();
      m.removeFromParent();
      m.geometry.dispose();
    }
    const g = new T.BufferGeometry();
    for (const [name, size] of sizes)
      g.setAttribute(
        name,
        new T.Float32BufferAttribute(attributes[name], size),
      );
    g.setIndex(indices);
    g.computeBoundingSphere();
    const m = new T.Mesh(g, list[0].material);
    m.castShadow = m.receiveShadow = true;
    m.name = "batched exterior / preserved smooth normals";
    parent.add(m);
  }
}
