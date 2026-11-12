// Extend the existing compiled C++ flight controller without replacing its
// physical model. Mask bits: pitch=1, roll=2, yaw=4. With response tuning off
// and no owned axes, AI and legacy callers retain the original trajectory.
export function patchInstructor(wat,region){
 const at=region('pilotAxisOverride',Buffer.alloc(16));
 const start=wat.indexOf('  (func $step '),end=wat.indexOf('\n  (',start+1);
 if(start<0||end<0)throw Error('Missing native step');
 let body=wat.slice(start,end);
 // Player-only response tuning. The old bank-cone memory could remain stuck
 // while sideslip blocked its decay, then unwind late at the destination.
 // Make the applied cone proportional to angular error for stationary/slow
 // targets, blending to the predictive solver for moving targets. Retain the
 // lift-plane selection, roll/rate feedback, G/AoA limits and actuators.
 const response=`i32.const ${at+4}\n          i32.load`;
 const bankBoundary='          f64.store offset=1079296\n          local.get 66';
 if(!body.includes(bankBoundary))throw Error('Instructor bank-cone boundary changed');
 body=body.replace(bankBoundary,`          f64.store offset=1079296
          ${response}
          i32.const 0
          i32.load offset=1119524
          i32.const 7
          i32.sub
          i32.const 3
          i32.ge_u
          i32.and
          if
            i32.const 0
            f64.load offset=1396536
            local.get 70
            call $instructor_bank_cone
            local.set 70
          end
          local.get 66`);
 const load='    i32.const 0\n    f64.load offset=1133352\n    local.set 0\n    block';
 if(!body.includes(load))throw Error('Pilot input boundary changed');
 // Isolate the direction solver from the held manual axes. The raw commands
 // remain in Controls and are restored before FBW/actuators, not after forces.
 const neutral=[['1','0'],['2','16'],['4','39']].map(([bit,local])=>`
    i32.const ${at}
    i32.load
    i32.const ${bit}
    i32.and
    if
      f64.const 0
      local.set ${local}
    end`).join('');
 body=body.replace(load,load.slice(0,-'    block'.length)+neutral+'\n    block');
 const boundary='    end\n    i32.const 0\n    local.get 0\n    i32.const 0\n    f64.load offset=1079032';
 if(!body.includes(boundary))throw Error('FBW input boundary changed');
 const restore=[
  {bit:1,local:0,raw:1133352,command:14239960,integrator:1395344},
  {bit:2,local:16,raw:1133360,command:14239968,integrator:1395352},
  {bit:4,local:39,raw:1133368,command:14239976,integrator:1395360}
 ].map(a=>`
    i32.const ${at}
    i32.load
    i32.const ${a.bit}
    i32.and
    if
      i32.const 0
      f64.load offset=${a.raw}
      local.set ${a.local}
      i32.const 0
      local.get ${a.local}
      f64.store offset=${a.command}
      i32.const 0
      i64.const 0
      i64.store offset=${a.integrator}
      ${a.bit===1?'i32.const 0\n      i32.const 0\n      i32.store8 offset=1137736\n      i32.const 0\n      i64.const 0\n      i64.store offset=1137728\n      i32.const 0\n      local.set 4\n      f64.const 0\n      local.set 23':''}
    end`).join('');
 // These two adapted airframes need sideslip feedback in the direction
 // controller as well as the native rudder loop. Without it a small lateral
 // target can diverge after the first pass. Manual yaw is restored below.
 const coordinate=`
    i32.const ${at+4}
    i32.load
    i32.const 0
    i32.load8_u offset=14240112
    i32.and
    i32.const 0
    i32.load offset=1119524
    i32.const 13
    i32.sub
    i32.const 2
    i32.lt_u
    i32.and
    if
      local.get 39
      i32.const 0
      f64.load offset=1109712
      f64.add
      f64.const -1
      f64.max
      f64.const 1
      f64.min
      local.set 39
      i32.const 0
      local.get 39
      f64.store offset=14239976
    end`;
 body=body.replace(boundary,'    end\n'+coordinate+'\n'+restore+'\n'+boundary.slice('    end\n'.length));
 wat=wat.slice(0,start)+body+wat.slice(end);
 // Lifecycle calls clear ownership so a sortie/type/AI transition cannot
 // inherit a player's held key. Existing boolean overrides keep their ABI.
 for(const name of ['reset','reset_spawn','set_aircraft_type','set_pilot_override']){
  const a=wat.indexOf('  (func $'+name+' '),b=wat.indexOf('\n  (',a+1);
  if(a<0||b<0)throw Error('Missing lifecycle function '+name);
  let f=wat.slice(a,b),p=f.indexOf('\n')+1;
  if(f.slice(p).startsWith('    (local'))p=f.indexOf('\n',p)+1;
  f=f.slice(0,p)+`    i32.const ${at}\n    i32.const 0\n    i32.store\n`+(name==='set_pilot_override'?'':`    i32.const ${at+4}\n    i32.const 0\n    i32.store\n`)+f.slice(p);
  wat=wat.slice(0,a)+f+wat.slice(b);
 }
 const extra=`
  (func $instructor_bank_cone (param $error f64) (param $legacy f64) (result f64)
    (local $motion f64) (local $weight f64)
    i32.const 0
    f64.load offset=1395280
    local.tee $motion
    local.get $motion
    f64.mul
    i32.const 0
    f64.load offset=1395288
    local.tee $motion
    local.get $motion
    f64.mul
    f64.add
    i32.const 0
    f64.load offset=1395296
    local.tee $motion
    local.get $motion
    f64.mul
    f64.add
    f64.sqrt
    local.set $motion
    f64.const 0.12
    local.get $motion
    f64.sub
    f64.const 0.085
    f64.div
    f64.const 0
    f64.max
    f64.const 1
    f64.min
    local.tee $weight
    local.get $weight
    f64.mul
    f64.const 3
    f64.const 2
    local.get $weight
    f64.mul
    f64.sub
    f64.mul
    local.set $weight
    local.get $error
    f64.const 6
    f64.mul
    f64.const ${80*Math.PI/180}
    f64.min
    f64.const ${Math.PI/180}
    f64.max
    local.get $legacy
    f64.sub
    local.get $weight
    f64.mul
    local.get $legacy
    f64.add)
  (func $set_pilot_axis_override (export "set_pilot_axis_override") (param i32)
    i32.const ${at}
    local.get 0
    i32.const 7
    i32.and
    i32.store)
  (func $get_pilot_axis_override (export "get_pilot_axis_override") (result i32)
    i32.const ${at}
    i32.load)
  (func $set_instructor_response (export "set_instructor_response") (param i32)
    i32.const ${at+4}
    local.get 0
    i32.const 0
    i32.ne
    i32.store)
  (func $get_instructor_response (export "get_instructor_response") (result i32)
    i32.const ${at+4}
    i32.load)
`;
 return wat.slice(0,wat.lastIndexOf(')'))+extra+'\n)';
}
