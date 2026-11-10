import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
const root = path.resolve(process.argv[2] || "public");
const { createFleetBridge } = await import(
  pathToFileURL(path.join(root, "fleet-bridge.js"))
);
const module = new WebAssembly.Module(
  fs.readFileSync(path.join(root, "flight.wasm")),
);
const imports = {
  env: {
    pow: Math.pow,
    atan2: Math.atan2,
    asin: Math.asin,
    external_terrain: () => 18,
  },
};
const read = (s, n, l) =>
    Array.from(new Float64Array(s.memory.buffer, s[n](), l)),
  state = (s) => read(s, "get_state", 104);
const make = (type = 14, z = 0, speed = 250) => {
  const s = new WebAssembly.Instance(module, imports).exports;
  s.set_aircraft_type(type);
  s.reset_spawn(1);
  s.debug_set_state(0, 5000, z, 0, 0, -speed, 0, 0, 0, 1);
  s.set_controls(0, 0, 0, 0.75, 0, 0, 0, 1);
  s.set_invincible(0);
  return s;
};
function combatBridge(shooter, target) {
  let missileDamage = 0;
  const bridge = createFleetBridge([
    { id: 1, team: 0, active: true, sim: shooter },
    { id: 101, team: 1, active: true, sim: target },
  ], undefined, {
    onHit(source, victim, weapon, part, loss) {
      if (source.sim === shooter && weapon === 5) missileDamage += loss;
    },
  });
  return { bridge, damage: () => missileDamage };
}

function engagement(kind, targetType = 1) {
  const player = make(),
    target = make(targetType, -4000, 210),
    { bridge, damage } = combatBridge(player, target);
  player.set_radar_power(1);
  player[kind === "rf" ? "set_amraam_enabled" : "set_missile_enabled"](1);
  let locked = false,
    launched = false,
    trajectory = false;
  for (let i = 0; i < 3600; i++) {
    bridge.step(1 / 120);
    if (!locked && read(player, "get_radar_state", 32)[5]) {
      player.select_sensor_target(101);
      player.request_radar_lock();
      locked = true;
    }
    const weapon = read(
      player,
      kind === "rf" ? "get_amraam_state" : "get_missile_state",
      40,
    );
    if (!launched && weapon[2] === 4) {
      assert.equal(
        player[
          kind === "rf" ? "request_amraam_fire" : "request_missile_fire"
        ](),
        1,
      );
      launched = true;
    }
    if (
      launched &&
      read(player, kind === "rf" ? "get_amraams" : "get_missiles", 2)[0] > 0
    )
      trajectory = true;
  }
  assert.ok(
    locked && launched && trajectory,
    kind + " acquires, launches and flies",
  );
  assert.ok(
    damage() > 0,
    kind + " inflicts native damage through the fleet bridge",
  );
  return {
    kind,
    targetType,
    remaining: read(
      player,
      kind === "rf" ? "get_amraam_state" : "get_missile_state",
      32,
    )[1],
    damage: damage(),
  };
}
const engagements = [engagement("rf"), engagement("ir"), engagement("rf", 14)];
const gun = make();
gun.set_trigger(1);
for (let i = 0; i < 720; i++) gun.step(1 / 120);
gun.set_trigger(0);
assert.equal(read(gun, "get_combat", 12)[0], 0, "150 rounds can be expended");
assert.equal(
  read(gun, "get_combat", 12)[4],
  150,
  "150 native gun projectiles fired",
);
assert.ok(
  read(gun, "get_reload_state", 8)[2] > 0,
  "empty gun starts the game reload timer",
);
for (let i = 0; i < 120 * 21; i++) gun.step(1 / 120);
assert.equal(
  read(gun, "get_combat", 12)[0],
  150,
  "game reload restores 150 rounds",
);
const cm = make(),
  cmBefore = read(cm, "get_countermeasure_state", 16);
assert.equal(cm.request_countermeasure(0), 1);
for (let i = 0; i < 240; i++) cm.step(1 / 120);
const count = read(cm, "get_countermeasure_state", 16);
assert.ok(
  count[0] < cmBefore[0] && count[1] < cmBefore[1],
  "flare and chaff programs dispense native decoys",
);
const aircraft = make();
aircraft.set_map(2);
aircraft.reset_sortie_spawn(0, 0, 0);
let takeoffTime;
for (let i = 0; i < 120 * 80; i++) {
  const s = state(aircraft);
  aircraft.set_controls(
    s[13] > 80 ? 0.5 : 0,
    0,
    0,
    1.1,
    s[1] > 50 ? 0 : 1,
    0,
    0,
    1,
  );
  aircraft.step(1 / 120);
  if (s[1] > 80) {
    takeoffTime = i / 120;
    break;
  }
}
assert.ok(takeoffTime && takeoffTime < 50, "takeoff from the existing runway");
assert.equal(state(aircraft)[33], 0, "takeoff remains intact");
console.log(
  JSON.stringify({
    result: "PASS",
    engagements,
    gunRounds: 150,
    reload: true,
    countermeasures: true,
    takeoffSeconds: takeoffTime,
  }),
);

// Measure delivered hit energy against the existing GSh-30-1, through real
// projectile travel and collision. Muzzle velocity alone cannot verify this.
function impactEnergies(type) {
  const shooter = make(type),
    target = make(8, -180, 250),
    factors = [];
  target.set_invincible(1);
  shooter.set_trigger(1);
  const bridge = createFleetBridge(
    [
      { id: 1, team: 0, active: true, sim: shooter },
      { id: 101, team: 1, active: true, sim: target },
    ],
    undefined,
    {
      onEvents(a) {
        if (a.id !== 1) return;
        const hits = read(shooter, "get_fleet_hits", 450);
        for (let i = 0; i < hits[0]; i++) {
          const k = 2 + i * 7;
          factors.push(hits[k + 2]);
        }
      },
    },
  );
  for (let i = 0; i < 180; i++) bridge.step(1 / 120);
  assert.ok(factors.length, "gun hits a fleet target for type " + type);
  return Math.max(...factors);
}
const legacy30mm = impactEnergies(10),
  mig29Impact = impactEnergies(14);
assert.ok(
  Math.abs(mig29Impact - legacy30mm) < 1e-12,
  "MiG-29 actual 30mm hit energy matches the existing 30mm gun",
);
assert.ok(mig29Impact > 0.4, "30mm impact multiplier is applied");
console.log(
  JSON.stringify({ result: "PASS", gunImpact: { legacy30mm, mig29Impact } }),
);

const ai = make(),
  aiTarget = make(1, -4000, 210);
ai.set_combat_ai(1, 0.8, 0);
const { bridge: aiBridge, damage: aiDamage } = combatBridge(ai, aiTarget);
let aiLaunched = false;
for (let i = 0; i < 3600; i++) {
  aiBridge.step(1 / 120);
  aiLaunched ||= read(ai, "get_amraam_state", 32)[1] < 2;
}
assert.ok(aiLaunched, "AI acquires and launches its own RF missile");
assert.ok(
  aiDamage() > 0,
  "AI delivers native missile damage",
);
console.log(JSON.stringify({ result: "PASS", aiCombat: true }));
// Semi-active radar homing requires illumination throughout the engagement.
function illumination(cut) {
  const shooter = make(),
    target = make(1, -4000, 210),
    { bridge, damage } = combatBridge(shooter, target);
  shooter.set_radar_power(1);
  shooter.set_amraam_enabled(1);
  let detected = false,
    firedAt = -1;
  for (let i = 0; i < 3600; i++) {
    bridge.step(1 / 120);
    if (!detected && read(shooter, "get_radar_state", 32)[5]) {
      shooter.select_sensor_target(101);
      assert.equal(
        shooter.request_amraam_fire(),
        -6,
        "R-27R cannot launch without STT",
      );
      shooter.request_radar_lock();
      detected = true;
    }
    if (firedAt < 0 && read(shooter, "get_amraam_state", 40)[2] === 4) {
      assert.equal(shooter.request_amraam_fire(), 1);
      firedAt = i;
    }
    if (cut && firedAt >= 0 && i - firedAt > 30) shooter.set_radar_power(0);
  }
  assert.ok(firedAt >= 0);
  return damage();
}
const maintained = illumination(false),
  lost = illumination(true);
assert.ok(maintained > 0);
assert.equal(lost, 0, "loss of illumination prevents the SARH hit");
console.log(
  JSON.stringify({ result: "PASS", sarhIllumination: { maintained, lost } }),
);
const rack = make(),
  rackTarget = make(1, -3000, 180);
rackTarget.set_invincible(1);
rack.set_radar_power(1);
rack.set_missile_enabled(1);
const rackBridge = createFleetBridge([
  { id: 1, team: 0, active: true, sim: rack },
  { id: 101, team: 1, active: true, sim: rackTarget },
]);
let rounds = 0;
for (let i = 0; i < 2400 && rounds < 4; i++) {
  rackBridge.step(1 / 120);
  if (read(rack, "get_radar_state", 32)[5]) {
    rack.select_sensor_target(101);
    rack.request_radar_lock();
  }
  if (
    read(rack, "get_missile_state", 40)[2] === 4 &&
    rack.request_missile_fire() === 1
  )
    rounds++;
}
assert.equal(rounds, 4, "all four R-73 stations launch");
console.log(JSON.stringify({ result: "PASS", r73Stations: rounds }));
