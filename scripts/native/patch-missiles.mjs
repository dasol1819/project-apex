import {missileFor} from '../../web/missile-data.js';

// The legacy native solver accepts six consecutive doubles. Keep that prefix
// and put motor, launch-window and warhead data next to it in the same row.
const fields = [
 'life', 'navigation', 'boostTime', 'boostAcceleration', 'speed', 'turnG',
 'burnTime', 'sustainAcceleration', 'drag', 'maxRange', 'tailRatio', 'minRange',
 'armTime', 'radius', 'pressure', 'fragments', 'fragmentBias', 'direct', 'damageRadius', 'collateralCap'
];
const offset = Object.fromEntries(fields.map((field, index) => [field, index * 8]));
const stride = fields.length * 8;

function warhead(mass, radius, fragmentBias) {
 const size = Math.sqrt(mass);
 return {
  pressure: Math.min(.51, .15 + size * .041),
  fragments: Math.min(.68, .25 + size * .055),
  fragmentBias,
  direct: Math.min(.97, .68 + size * .042),
  damageRadius: radius * 1.70,
  collateralCap: Math.min(.65, .26 + size * .048)
 };
}

function replace(source, anchor, replacement) {
 if (typeof anchor === 'string' && !source.includes(anchor)) {
  throw Error('Missing missile patch anchor: ' + anchor);
 }
 const result = source.replace(anchor, replacement);
 if (source === result) throw Error('Missing missile patch anchor: ' + anchor);
 return result;
}

export function patchMissiles(wat, region, aircraftCount, radarTable) {
 const rows = Buffer.alloc(aircraftCount * 2 * stride);
 for (let type = 0; type < aircraftCount; type++) {
  for (const radar of [false, true]) {
   const profile = missileFor(type, radar);
   if (!profile) continue;
   const row = {
    ...profile,
    boostAcceleration: profile.boostKn * 1000 / profile.mass,
    sustainAcceleration: profile.sustainKn * 1000 / profile.mass,
    burnTime: profile.boostTime + profile.sustainTime,
    ...warhead(profile.warhead, profile.radius, profile.fragmentBias)
   };
   fields.forEach((field, index) => rows.writeDoubleLE(row[field], (type * 2 + Number(radar)) * stride + index * 8));
  }
 }
 const table = region('missileProfiles', rows);
 const sam = Buffer.alloc(6 * 8);
 Object.values(warhead(28, 4.3, .78)).forEach((value, index) => sam.writeDoubleLE(value, index * 8));
 const samWarhead = region('samWarhead', sam);
 const section = name => {
  const start = wat.indexOf('  (func $' + name + ' ');
  if (start < 0) throw Error('Missing missile native function: ' + name);
  return wat.slice(start, wat.indexOf('\n  (', start + 1));
 };
 function change(name, apply) {
  const before = section(name);
  wat = replace(wat, before, apply(before));
 }
 const profile = radar => `i32.const ${Number(radar)}\n        call $Missiles::profile`;
 const field = (radar, key) => `${profile(radar)}\n        f64.load offset=${offset[key]}`;

 change('Combat::storeMass__', b => replace(b, `    local.get 1
    local.get 5
    local.get 0
    i32.mul`, `    local.get 4
    i32.const 16
    i32.eq
    if
      local.get 1
      local.get 0
      f64.convert_i32_u
      f64.const ${missileFor(16).mass}
      f64.mul
      f64.add
      local.get 3
      f64.convert_i32_u
      f64.const ${missileFor(16,true).mass}
      f64.mul
      f64.add
      return
    end
    local.get 1
    local.get 5
    local.get 0
    i32.mul`));

 // In the compact radar mode, use the same aircraft sensor profiles as
 // battlefield mode for platform scans. A missile's own radar keeps its gate.
 change('Radar::observe_V__Q__double__double__double_', b => replace(b,
  /local.get 7\n        i32.const 288\n        i32.mul\n        i32.const \d+\n        i32.add\n        f64.load\n        local.tee 10/,
  `local.get 7
        i32.const 56
        i32.mul
        i32.const ${radarTable}
        i32.add
        f64.load
        local.tee 10`));

 const legacySarhType = /i32\.const 1\n\s+i32\.const 0\n\s+i32\.load offset=1119524\n\s+i32\.const 0\n\s+i32\.load offset=1119524\n\s+i32\.const 14\n\s+i32\.eq\n\s+select/g;
 const sarhType = `call $Missiles::legacyRadarType`;
 change('Amraam::request_bool_', b => replace(b, legacySarhType, sarhType));
 change('Amraam::releaseWindow__', b => {
  b = replace(b, 'f64.const 0x1.5ep+8 (;=350;)', field(true, 'minRange'));
  return replace(b, /f64.const 0x1\.57cp\+14 \(;=22000;\)[\s\S]*?\bselect/, 'call $Missiles::radarMaxRange');
 });
 change('get_amraam_state', b => {
  b = replace(b, /f64.const 0x1\.57cp\+14 \(;=22000;\)[\s\S]*?\bselect\n    f64.store offset=96/,
   'call $Missiles::radarMaxRange\n    f64.store offset=96');
  // Keep local 8 available for the existing weapon-code and station outputs.
  b = replace(b, '    call $Missiles::radarMaxRange', '    i32.const 0\n    i32.load offset=1119524\n    local.set 8\n    call $Missiles::radarMaxRange');
  return replace(b, '    i32.const 1397024)', `    i32.const 0
    i32.load offset=1119524
    i32.const 16
    i32.eq
    if
      i32.const 1397248
      f64.const 24
      f64.store
    end
    i32.const 1397024)`);
 });
 change('Sidewinder::request_bool_', b => replace(b, '      i32.const 180\n      local.set 2', `      block
        call $Missiles::irReleaseWindow
        br_if 0
        i32.const -8
        local.set 1
        br 1
      end
      i32.const 180
      local.set 2`));


 change('step', b => {
  b = replace(b, legacySarhType, sarhType);
  const irEnd = b.indexOf('        local.get 1\n        i32.const 3600', b.indexOf('i64.const 4631530004285489152'));
  const irStart = b.lastIndexOf('        block  ;; label = @3\n', b.indexOf('i64.const 4631530004285489152'));
  const rfStart = b.lastIndexOf('        block  ;; label = @3\n', b.indexOf('f64.const 0x1.5p+4 (;=21;)', irEnd));
  const rfEnd = b.indexOf('        local.get 17\n        f64.load\n        local.set 12',
   b.indexOf('        f64.store offset=3704', rfStart));
  if (irStart < 0 || irEnd <= irStart || rfStart <= irEnd || rfEnd <= rfStart) {
   throw Error('Missing legacy missile motion profiles');
  }
  b = b.slice(0, irStart) + b.slice(irEnd, rfStart) + b.slice(rfEnd);
  for (const [radar, rateOutput] of [[false, 1110280], [true, 1112136]]) {
   const motion = `        local.get 1\n        i32.const 3672\n        i32.add\n        local.get 3\n        i32.const ${rateOutput}`;
   b = replace(b, motion, `        ${profile(radar)}\n        local.get 3\n        i32.const ${rateOutput}`);
  }
  b = replace(b, /f64.const 0x1\.6p\+4 \(;=22;\)\n        call 266/, `${profile(false)}\n        call 266`);
  b = replace(b, /local.get 0\n        call 266/, `${profile(true)}\n        call 266`);
  b = replace(b, `              i32.const 1
              i32.const 4
              local.get 4
              select
              local.set 4`, `              i32.const 1
              i32.const 4
              i32.const 9
              call $Missiles::irReleaseWindow
              select
              local.get 4
              select
              local.set 4`);
  b = replace(b, `                            i32.const 14000
                            i32.const 6500
                            i32.const 0
                            i32.load offset=1396512
                            local.tee 3
                            i32.const 2
                            i32.eq
                            select
                            f64.convert_i32_u`, `                            call $Missiles::radarMaxRange
                            f64.const 0.72
                            f64.mul
                            f64.const 6500
                            i32.const 0
                            i32.load offset=1396512
                            local.tee 3
                            i32.const 2
                            i32.eq
                            select`);
  return replace(b, `          i32.store8 offset=1135484
          local.get 7
          i32.const 1
          i32.lt_s`, `          i32.store8 offset=1135484
          call $Missiles::irReleaseWindow
          i32.eqz
          br_if 2
          local.get 7
          i32.const 1
          i32.lt_s`);
 });

 const motionFn = 'GameMissileMotion::advance_V__V&__V&__double__double__V__V__V__bool__GameMissileMotion::Profile_const&__double&__double&_';
 change(motionFn, b => {
  b = replace(b, /f64.const 0x1\.14d2f5dbb9cfap-15 \(;=3\.3e-05;\)/g, 'local.get 10\n    call $Missiles::drag');
  const start = b.indexOf('    f64.const 0x0p+0 (;=0;)\n    local.get 10\n    f64.load offset=32\n    local.tee 18');
  const end = b.indexOf('    local.get 19\n    local.get 16\n    local.get 10\n    call $Missiles::drag', start);
  if (start < 0 || end <= start) throw Error('Missing missile motor block');
  return b.slice(0, start) + `    f64.const 0
    local.get 10
    f64.load offset=32
    f64.const 150
    f64.add
    local.tee 20
    local.get 10
    local.get 4
    local.get 19
    call $Missiles::acceleration
` + b.slice(end);
 });

 for (const [getter, radar] of [['get_missiles', false], ['get_amraams', true]]) {
  change(getter, b => replace(b, /f64\.const 0x1\.eb851eb851eb8p-4 \(;=0\.12;\)\n        f64.gt\n        local.get 3\n[\s\S]*?        f64.lt\n        i32.and/, `f64.const 0.12
        f64.gt
        local.get 3
        ${field(radar, 'burnTime')}
        f64.const 0.12
        f64.add
        f64.lt
        i32.and`));
 }

 const finish = 'Sidewinder::finishFlight_Sidewinder::Missile&__V__double__double_';
 change(finish, b => {
  b = replace(b, '(type 53) (param i32 i32 f64 f64)', '(param i32 i32 f64 i32)');
  b = replace(b, /^    \(local [^)]+\)/m, '$&\n    (local $armed i32)');
  const start = b.indexOf('    block  ;; label = @1\n      local.get 0\n      f64.load offset=96');
  const end = b.indexOf('    block  ;; label = @1\n      block  ;; label = @2\n        local.get 18', start);
  if (start < 0 || end <= start) throw Error('Missing legacy proximity block');
  b = b.slice(0, start) + `    local.get 0
    f64.load offset=96
    local.tee 8
    local.get 2
    f64.sub
    local.get 3
    f64.load offset=${offset.armTime}
    f64.ge
    local.get 0
    f64.load offset=136
    local.get 3
    f64.load offset=${offset.minRange}
    f64.const 0.12
    f64.mul
    f64.ge
    i32.and
    local.set $armed
    block
      local.get $armed
      i32.eqz
      br_if 0
      local.get 13
      i32.const 0
      i32.ge_s
      br_if 0
      local.get 4
      i32.const 80
      i32.add
      local.get 4
      i32.const 56
      i32.add
      local.get 2
      local.get 4
      i32.const 400
      i32.add
      local.get 3
      f64.load offset=${offset.radius}
      call $Missiles::proximityTarget
      i32.const 0
      i32.lt_s
      br_if 0
      local.get 4
      i32.const 0
      i32.load offset=1122496
      i32.store offset=396
    end
` + b.slice(end);
  b = replace(b, '        local.get 8\n        f64.const 0x1.999999999999ap-3 (;=0.2;)\n        f64.lt', '        local.get $armed\n        i32.eqz');
  const oldProfile = b.indexOf('                block  ;; label = @7\n                  block  ;; label = @8\n                    local.get 0\n                    i32.load offset=176');
  const endProfile = b.indexOf('                i32.const 0\n                local.set 7\n                loop', oldProfile);
  if (oldProfile < 0 || endProfile <= oldProfile) throw Error('Missing legacy missile warhead selection');
  b = b.slice(0, oldProfile) + `                local.get 15
                local.get 2
                f64.mul
                local.set 18
` + b.slice(endProfile);
  b = replace(b, '                    local.get 4\n                    i32.const 456\n                    i32.add\n                    call 297',
   `                    local.get 3
                    i32.const ${offset.pressure}
                    i32.add
                    call 297`);
  b = replace(b, '            i32.const 1\n            local.set 12\n            br 1 (;@3;)', `            i32.const 5
            i32.const 1
            local.get 13
            i32.const 0
            i32.lt_s
            select
            local.set 12
            br 1 (;@3;)`);
  return replace(b, '        local.get 8\n        local.get 3\n        f64.gt',
   `        local.get 8\n        local.get 3\n        f64.load offset=${offset.life}\n        f64.gt`);
 });

 change('GameWarhead::damage_V__V__int__int__double__GameWarhead::Profile_const&_', b => {
  b = replace(b, '        f64.const 0x1p+0 (;=1;)\n        local.set 4\n        br 1',
   '        local.get 5\n        f64.load offset=24\n        local.set 4\n        br 1');
  b = replace(b, '          f64.const 0x1.4cccccccccccdp+1 (;=2.6;)\n          f64.div',
   '          local.get 5\n          f64.load offset=32\n          f64.const 0.28\n          f64.mul\n          f64.div');
  b = replace(b, '          f64.const 0x1.2666666666666p+2 (;=4.6;)\n          f64.div',
   '          local.get 5\n          f64.load offset=32\n          f64.const 0.40\n          f64.mul\n          f64.div');
  b = replace(b, '          f64.const 0x1.7333333333333p+0 (;=1.45;)\n          f64.mul\n', '');
  b = replace(b, '          f64.const 0x1.b333333333333p+0 (;=1.7;)\n          f64.mul\n', '');
  b = replace(b, '          call 309\n          f64.const 0x1.2p+3 (;=9;)\n          f64.mul',
   '          drop\n          local.get 5\n          f64.load offset=32\n          f64.const 0.48\n          f64.mul');
  b = replace(b, '          call 309\n          f64.const 0x1.1p+4 (;=17;)\n          f64.mul',
   '          drop\n          local.get 5\n          f64.load offset=32');
  b = replace(b, '      f64.const 0x1p+0 (;=1;)\n      local.get 36',
   '      local.get 5\n      f64.load offset=40\n      local.get 36');
  return replace(b, '      local.tee 4\n      local.get 4\n      f64.const 0x1p+0 (;=1;)\n      f64.gt',
   '      local.tee 4\n      local.get 4\n      local.get 5\n      f64.load offset=40\n      f64.gt');
 });
 change('SAM::detonate_SAM::Rocket&__int__double__double_', b => replace(b, 'i32.const 1075680\n        call 297',
  `i32.const ${samWarhead}\n        call 297`));

 const targetHit = section('Combat::targetHit_V__V__double__double&_');
 const proximity = proximityFunction(targetHit);
 const additions = nativeHelpers({table, end: table + rows.length}) + '\n' + proximity;
 return wat.slice(0, wat.lastIndexOf(')')) + '\n' + additions + '\n)';
}

function nativeHelpers({table, end}) {
 const f = name => 'offset=' + offset[name];
 const coordinates = [0, 8, 16];
 const globalF64 = address => `(f64.load (i32.const ${address}))`;
 const displacement = coordinates.map((axis, i) =>
  `(local.set $${'xyz'[i]} (f64.sub (f64.load offset=${axis} (local.get $position)) ${globalF64(1109552 + axis)}))`).join('\n    ');
 const radial = coordinates.map((axis, i) =>
  `(f64.mul (local.get $${'xyz'[i]}) (f64.load offset=${axis} (local.get $velocity)))`);
 const cube = coordinates.map(axis => `
    (local.set $a (f64.sub (f64.load offset=${axis} (local.get $from)) ${globalF64(1133416 + axis)}))
    (local.set $b (f64.sub (f64.sub (f64.load offset=${axis} (local.get $to)) ${globalF64(1133416 + axis)})
                          (f64.mul ${globalF64(1133440 + axis)} (local.get $dt))))
    (if (i32.or (f64.gt (f64.min (local.get $a) (local.get $b)) (local.get $extent))
                (f64.lt (f64.max (local.get $a) (local.get $b)) (f64.neg (local.get $extent))))
      (then (return (i32.const 0))))`).join('');

 return `  (func $Missiles::profile (param $radar i32) (result i32)
    (i32.add (i32.const ${table})
      (i32.mul (i32.add (i32.shl (i32.load (i32.const 1119524)) (i32.const 1)) (local.get $radar))
               (i32.const ${stride}))))
  (func $Missiles::legacyRadarType (result i32)
    (local $type i32)
    (local.set $type (i32.load (i32.const 1119524)))
    (select (i32.const 1) (local.get $type)
      (i32.or (i32.eq (local.get $type) (i32.const 14)) (i32.eq (local.get $type) (i32.const 16)))))
  (func $Missiles::isAamProfile (param $p i32) (result i32)
    (i32.and (i32.ge_u (local.get $p) (i32.const ${table}))
             (i32.lt_u (local.get $p) (i32.const ${end}))))
  (func $Missiles::drag (param $p i32) (result f64)
    (if (result f64) (call $Missiles::isAamProfile (local.get $p))
      (then (f64.load ${f('drag')} (local.get $p)))
      (else (f64.const 0.000033))))
  (func $Missiles::acceleration (param $p i32) (param $age f64) (param $speed f64) (result f64)
    (local $time f64) (local $boost f64)
    (local.set $time (f64.sub (local.get $age) (f64.const 0.12)))
    (if (i32.or (f64.le (local.get $time) (f64.const 0))
                (f64.ge (local.get $speed) (f64.load ${f('speed')} (local.get $p))))
      (then (return (f64.const 0))))
    (local.set $boost (f64.load ${f('boostTime')} (local.get $p)))
    (if (i32.eqz (call $Missiles::isAamProfile (local.get $p)))
      (then (return (select (f64.mul (f64.load ${f('boostAcceleration')} (local.get $p)) (f64.const 0.92))
                            (f64.const 0) (f64.lt (local.get $time) (local.get $boost))))))
    (if (f64.lt (local.get $time) (local.get $boost))
      (then (return (f64.load ${f('boostAcceleration')} (local.get $p)))))
    (if (f64.lt (local.get $time) (f64.load ${f('burnTime')} (local.get $p)))
      (then (return (f64.load ${f('sustainAcceleration')} (local.get $p)))))
    f64.const 0)
  (func $Missiles::maxRange (param $p i32) (param $position i32) (param $velocity i32) (result f64)
    (local $x f64) (local $y f64) (local $z f64)
    (local $distance f64) (local $aspect f64) (local $altitude f64) (local $speed f64)
    ${displacement}
    (local.set $distance (f64.sqrt
      (f64.add (f64.add (f64.mul (local.get $x) (local.get $x)) (f64.mul (local.get $y) (local.get $y)))
               (f64.mul (local.get $z) (local.get $z)))))
    (local.set $aspect (f64.min (f64.const 1) (f64.max (f64.const 0)
      (f64.div (f64.add (f64.const 250)
        (f64.div (f64.add (f64.add ${radial[0]} ${radial[1]}) ${radial[2]})
                 (f64.max (f64.const 1) (local.get $distance)))) (f64.const 550)))))
    (local.set $altitude (f64.min ${globalF64(1109560)} (f64.load offset=8 (local.get $position))))
    (local.set $altitude (f64.min (f64.const 0.97) (f64.max (f64.const 0.52)
      (f64.add (f64.const 0.52) (f64.mul (local.get $altitude) (f64.const 0.000032))))))
    (local.set $speed (f64.min (f64.const 1.22) (f64.max (f64.const 0.83)
      (f64.add (f64.const 1) (f64.mul (f64.sub ${globalF64(1109720)} (f64.const 230)) (f64.const 0.00065))))))
    (f64.mul (f64.load ${f('maxRange')} (local.get $p))
      (f64.min (f64.const 1) (f64.mul (f64.mul (local.get $altitude) (local.get $speed))
        (f64.sub (f64.const 1) (f64.mul (local.get $aspect)
          (f64.sub (f64.const 1) (f64.load ${f('tailRatio')} (local.get $p)))))))))
  (func $Missiles::radarMaxRange (result f64)
    (call $Missiles::maxRange (call $Missiles::profile (i32.const 1)) (i32.const 1133416) (i32.const 1133440)))
  (func $Missiles::irPosition (result i32)
    (local $track i32)
    (local.set $track (call 21 (i32.load (i32.const 1218116))))
    (select (i32.add (local.get $track) (i32.const 8)) (i32.const 1133416) (local.get $track)))
  (func $Missiles::irMaxRange (export "get_ir_release_max") (result f64)
    (local $position i32)
    (local.set $position (call $Missiles::irPosition))
    (call $Missiles::maxRange (call $Missiles::profile (i32.const 0)) (local.get $position)
      (i32.add (local.get $position) (i32.const 24))))
  (func $Missiles::irReleaseWindow (result i32)
    (local $p i32) (local $position i32) (local $range f64)
    (local $x f64) (local $y f64) (local $z f64)
    (local.set $p (call $Missiles::profile (i32.const 0)))
    (local.set $position (call $Missiles::irPosition))
    ${displacement}
    (local.set $range (f64.sqrt
      (f64.add (f64.add (f64.mul (local.get $x) (local.get $x)) (f64.mul (local.get $y) (local.get $y)))
               (f64.mul (local.get $z) (local.get $z)))))
    (i32.and (f64.ge (local.get $range) (f64.load ${f('minRange')} (local.get $p)))
             (f64.le (local.get $range) (call $Missiles::irMaxRange))))
  (func $Missiles::nearAircraft (param $from i32) (param $to i32) (param $dt f64) (param $radius f64) (result i32)
    (local $a f64) (local $b f64) (local $extent f64)
    (local.set $extent (f64.add (f64.const 44) (local.get $radius)))${cube}
    i32.const 1)
  ;; The derivative of squared point-to-box distance is monotone along a line.
  ;; Use it to find the closest point only in the tick that passes the part.
  (func $Missiles::boxMetric (param $frame i32) (param $t f64) (param $derivative i32) (result f64)
    (local $i i32) (local $d f64) (local $x f64) (local $gap f64) (local $sum f64)
    (loop $axis
      (local.set $d (f64.load offset=144 (i32.add (local.get $frame) (local.get $i))))
      (local.set $x (f64.add (f64.load offset=176 (i32.add (local.get $frame) (local.get $i)))
                            (f64.mul (local.get $d) (local.get $t))))
      (local.set $gap (f64.sub (local.get $x)
        (f64.max (f64.load offset=112 (i32.add (local.get $frame) (local.get $i)))
          (f64.min (local.get $x) (f64.load offset=80 (i32.add (local.get $frame) (local.get $i)))))))
      (local.set $sum (f64.add (local.get $sum) (f64.mul (local.get $gap)
        (select (local.get $d) (local.get $gap) (local.get $derivative)))))
      (local.set $i (i32.add (local.get $i) (i32.const 8)))
      (br_if $axis (i32.lt_u (local.get $i) (i32.const 24))))
    local.get $sum)
  (func $Missiles::passage (param $frame i32) (param $radius f64) (result f64)
    (local $i i32) (local $a f64) (local $b f64)
    (local $lo f64) (local $hi f64) (local $t f64)
    ;; A cheap part-level interval check before evaluating distance.
    (loop $axis
      (local.set $a (f64.load offset=176 (i32.add (local.get $frame) (local.get $i))))
      (local.set $b (f64.add (local.get $a) (f64.load offset=144 (i32.add (local.get $frame) (local.get $i)))))
      (if (i32.or
           (f64.gt (f64.min (local.get $a) (local.get $b))
                   (f64.add (f64.load offset=80 (i32.add (local.get $frame) (local.get $i))) (local.get $radius)))
           (f64.lt (f64.max (local.get $a) (local.get $b))
                   (f64.sub (f64.load offset=112 (i32.add (local.get $frame) (local.get $i))) (local.get $radius))))
        (then (return (f64.const 2))))
      (local.set $i (i32.add (local.get $i) (i32.const 8)))
      (br_if $axis (i32.lt_u (local.get $i) (i32.const 24))))
    (if (i32.or (f64.ge (call $Missiles::boxMetric (local.get $frame) (f64.const 0) (i32.const 1)) (f64.const 0))
                (f64.lt (call $Missiles::boxMetric (local.get $frame) (f64.const 1) (i32.const 1)) (f64.const 0)))
      (then (return (f64.const 2))))
    (local.set $hi (f64.const 1))
    (local.set $i (i32.const 10))
    (loop $closest
      (local.set $t (f64.mul (f64.add (local.get $lo) (local.get $hi)) (f64.const 0.5)))
      (if (f64.lt (call $Missiles::boxMetric (local.get $frame) (local.get $t) (i32.const 1)) (f64.const 0))
        (then (local.set $lo (local.get $t)))
        (else (local.set $hi (local.get $t))))
      (local.set $i (i32.sub (local.get $i) (i32.const 1)))
      (br_if $closest (local.get $i)))
    (select (local.get $t) (f64.const 2)
      (f64.le (call $Missiles::boxMetric (local.get $frame) (local.get $t) (i32.const 0))
              (f64.mul (local.get $radius) (local.get $radius)))))`;
}

// Reuse the native target interpolation, orientation, part presence, swept wing
// transform and bounds. Change just the box intersection into a distance test.
function proximityFunction(body) {
 const start = body.lastIndexOf('          local.set 29\n          f64.const 0x0p+0 (;=0;)');
 const end = body.indexOf('          local.get 3\n          local.get 14\n          f64.store', start);
 if (start < 0 || end <= start) throw Error('Missing aircraft collision loop');
 body = body.slice(0, start) + `          local.set 29
          local.get 4
          local.get $radius
          call $Missiles::passage
          local.tee 14
          f64.const 1
          f64.gt
          br_if 0
          local.get 14
          local.get 3
          f64.load
          f64.ge
          br_if 0
` + body.slice(end);
 body = body.replace(/local\.(get|set|tee) (\d+)/g, (_, op, index) => `local.${op} ${+index >= 4 ? +index + 1 : index}`);
 body = replace(body,
  /\$Combat::targetHit_V__V__double__double&_ \(type 57\) \(param i32 i32 f64 i32\)/,
  '$$Missiles::proximityTarget (param i32 i32 f64 i32) (param $radius f64)');
 return replace(body, '    global.get 0', `    (if (i32.or (i32.load (i32.const 1219800))
          (i32.eqz (call $Missiles::nearAircraft (local.get 0) (local.get 1) (local.get 2) (local.get $radius))))
      (then (return (i32.const -1))))
    global.get 0`);
}
