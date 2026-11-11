// Extend the existing compiled C++ flight controller without replacing its
// physical model. Mask bits: pitch=1, roll=2, yaw=4. A zero mask preserves the
// original module instruction-for-instruction for AI and legacy API callers.
export function patchInstructor(wat,region){
 const at=region('pilotAxisOverride',Buffer.alloc(16));
 const start=wat.indexOf('  (func $step '),end=wat.indexOf('\n  (',start+1);
 if(start<0||end<0)throw Error('Missing native step');
 let body=wat.slice(start,end);
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
 body=body.replace(boundary,'    end\n'+restore+'\n'+boundary.slice('    end\n'.length));
 wat=wat.slice(0,start)+body+wat.slice(end);
 // Lifecycle calls clear ownership so a sortie/type/AI transition cannot
 // inherit a player's held key. Existing boolean overrides keep their ABI.
 for(const name of ['reset','reset_spawn','set_aircraft_type','set_pilot_override']){
  const a=wat.indexOf('  (func $'+name+' '),b=wat.indexOf('\n  (',a+1);
  if(a<0||b<0)throw Error('Missing lifecycle function '+name);
  let f=wat.slice(a,b),p=f.indexOf('\n')+1;
  if(f.slice(p).startsWith('    (local'))p=f.indexOf('\n',p)+1;
  f=f.slice(0,p)+`    i32.const ${at}\n    i32.const 0\n    i32.store\n`+f.slice(p);
  wat=wat.slice(0,a)+f+wat.slice(b);
 }
 const extra=`
  (func $set_pilot_axis_override (export "set_pilot_axis_override") (param i32)
    i32.const ${at}
    local.get 0
    i32.const 7
    i32.and
    i32.store)
  (func $get_pilot_axis_override (export "get_pilot_axis_override") (result i32)
    i32.const ${at}
    i32.load)
`;
 return wat.slice(0,wat.lastIndexOf(')'))+extra+'\n)';
}
