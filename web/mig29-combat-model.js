// SPDX-License-Identifier: GPL-2.0-only
import * as T from "./vendor/three.module.js";
import { cachedMig29Asset } from "./mig29-asset.js?v=visual-2";
import { createMig29Model } from "./mig29-model.js?v=visual-2";
import {
  aircraftDefinition,
  storeMount,
  irStoreAvailable,
} from "./aircraft-catalog.js";
import { PRESETS } from "./loadout-catalog.js";
import { createRussianMissileModel } from "./russian-missile-model.js";
import { enableWorldDepthIn } from "./world-depth.js";
export function createMig29CombatAircraft({ asset = cachedMig29Asset() } = {}) {
  if (!asset)
    throw Error("MiG-29 assets must finish loading before aircraft selection");
  const model = createMig29Model(asset, { combat: true }),
    stores = [];
  model.group.userData.previewOnly = false;
  model.group.userData.aircraftType = 14;
  for (const kind of ["ir", "rf"])
    for (let i = 0; i < (kind === "ir" ? 4 : 2); i++) {
      const root = new T.Group(),
        missile = createRussianMissileModel(kind === "ir" ? "r73" : "r27r"),
        part = (kind === "ir" && i < 2 ? 12 : 1) + (i % 2);
      root.name = `MiG-29 ${kind} station ${i + 1}`;
      root.position.set(...storeMount(14, kind, i));
      root.userData.weaponStore = { kind, slot: i };
      root.add(missile);
      const pos = storeMount(14, kind, i),
        wing = [];
      model.group.updateMatrixWorld(true);
      for (const id of [1, 2, 12, 13, 16, 17, 18, 19])
        model.damageParts[id].traverse((o) => {
          if (
            o.isMesh &&
            !o.userData.visualEffect &&
            !o.material.isShaderMaterial
          )
            wing.push(o);
        });
      const height = (z) => {
        const hits = new T.Raycaster(
          new T.Vector3(pos[0], -2, z),
          new T.Vector3(0, 1, 0),
          0,
          4,
        ).intersectObjects(wing, false);
        return hits[0]?.point.y;
      };
      const center = height(pos[2]);
      if (center === undefined)
        throw Error("MiG-29 pylon has no wing attachment " + kind + " " + i);
      const zf = -0.38,
        zb = 0.38,
        bottom = 0.1,
        front = (height(pos[2] + zf) ?? center) - pos[1] + 0.015,
        back = (height(pos[2] + zb) ?? center) - pos[1] + 0.015,
        verts = [];
      for (const x of [-0.045, 0.045])
        verts.push(
          x,
          bottom,
          zf,
          x,
          bottom,
          zb,
          x,
          front,
          zf - 0.06,
          x,
          back,
          zb + 0.06,
        );
      const g = new T.BufferGeometry();
      g.setAttribute("position", new T.Float32BufferAttribute(verts, 3));
      g.setIndex([
        0, 1, 2, 1, 3, 2, 4, 6, 5, 5, 6, 7, 0, 4, 1, 1, 4, 5, 2, 3, 6, 3, 7, 6,
        0, 2, 4, 2, 6, 4, 1, 5, 3, 3, 5, 7,
      ]);
      g.computeVertexNormals();
      const pylon = new T.Mesh(
        g,
        new T.MeshStandardMaterial({ color: 0x83948a, roughness: 0.8 }),
      );
      root.add(pylon);
      model.damageParts[part].add(root);
      enableWorldDepthIn(root);
      stores.push({ root, missile, part, kind, slot: i });
    }
  const update = model.update;
  model.update = (s = {}, dt = 1 / 60) => {
    const e = new T.Euler().setFromQuaternion(model.group.quaternion, "YXZ");
    update(
      {
        ...s,
        altitude: model.group.position.y,
        heading: -e.y,
        bank: e.z,
        pitchAngle: e.x,
      },
      dt,
    );
    const preset = PRESETS[s.bombs?.[22]] || PRESETS[42];
    for (const item of stores) {
      const installed =
        item.kind === "ir"
          ? item.slot < preset.ir
          : !!(preset.rfMask & (1 << item.slot));
      item.root.visible = !!installed && model.damageParts[item.part].visible;
      item.missile.visible =
        item.kind === "ir"
          ? irStoreAvailable(s.missiles, item.slot)
          : (s.amraam?.[16 + item.slot] ?? 1) > 0;
    }
    model.group.updateMatrixWorld(true);
  };
  model.definition = aircraftDefinition(14);
  model.update();
  return model;
}
