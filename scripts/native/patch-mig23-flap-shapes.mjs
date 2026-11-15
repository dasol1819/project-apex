// Original source flap envelope over native game0..25deg, at live wing sweep.
// C++ fit-mig23-flaps.cpp records welded pin and continuous-arc error bound.
export function patchMig23FlapShapes(wat,region,source){
 if(source.referenceSweepDegrees!==72||Object.keys(source.parts).join(',')!=='16,17')throw Error('Unexpected MiG23 wing support source');
 const records=Object.entries(source.parts).map(([part,w])=>{
  if(w.hullXZ.length<3||w.hullXZ.some(p=>p.length!==2||!p.every(Number.isFinite))||!w.hinge.every(Number.isFinite)||!(w.maxY>w.minY))throw Error('Invalid wing hull '+part);
  const data=Buffer.alloc(w.hullXZ.length*16);w.hullXZ.flat().forEach((v,i)=>data.writeDoubleLE(v,i*8));
  return {part:+part,w,at:region('mig23FlapSupport'+part,data)};
 });
 const setup=({w,at})=>`i32.const ${at} local.set $base
 i32.const ${w.hullXZ.length} local.set $count
 f64.const ${w.hinge[0]} local.set $hx
 f64.const ${w.hinge[2]} local.set $hz
 f64.const ${w.minY} local.set $loY
 f64.const ${w.maxY} local.set $hiY
 local.get $angle f64.const ${w.sign} f64.mul local.set $angle`;
 const helper=`
 (func $mig23FlapSupport (param $out i32) (param $part i32) (param $angle f64) (param $half i32)
  (local $base i32) (local $count i32) (local $i i32)
  (local $hx f64) (local $hz f64) (local $c f64) (local $s f64)
  (local $dx f64) (local $dz f64) (local $x f64) (local $z f64)
  (local $loX f64) (local $hiX f64) (local $loY f64) (local $hiY f64) (local $loZ f64) (local $hiZ f64)
  local.get $angle f64.const 0 f64.lt
  local.get $angle local.get $angle f64.ne i32.or
  if i32.const 0 f64.load offset=1078952 local.set $angle end
  local.get $angle f64.const 16 f64.max f64.const 72 f64.min
  f64.const 72 f64.sub f64.const ${Math.PI/180} f64.mul local.set $angle
  local.get $part i32.const 16 i32.eq
  if ${setup(records[0])} else ${setup(records[1])} end
  local.get $angle call $cos local.set $c
  local.get $angle call $sin local.set $s
  f64.const inf local.set $loX f64.const inf local.set $loZ
  f64.const -inf local.set $hiX f64.const -inf local.set $hiZ
  loop $vertex
   local.get $base local.get $i i32.const 16 i32.mul i32.add f64.load
   local.get $hx f64.sub local.set $dx
   local.get $base local.get $i i32.const 16 i32.mul i32.add f64.load offset=8
   local.get $hz f64.sub local.set $dz
   local.get $dx local.get $c f64.mul local.get $dz local.get $s f64.mul f64.add local.get $hx f64.add local.set $x
   local.get $dz local.get $c f64.mul local.get $dx local.get $s f64.mul f64.sub local.get $hz f64.add local.set $z
   local.get $loX local.get $x f64.min local.set $loX
   local.get $hiX local.get $x f64.max local.set $hiX
   local.get $loZ local.get $z f64.min local.set $loZ
   local.get $hiZ local.get $z f64.max local.set $hiZ
   local.get $i i32.const 1 i32.add local.tee $i local.get $count i32.lt_u br_if $vertex
  end
  ${['X','Y','Z'].map((axis,i)=>`local.get $out
   local.get $half
   if (result f64)
    local.get $hi${axis} local.get $lo${axis} f64.sub f64.const 0.5 f64.mul f64.const ${source.paddingMetres} f64.add
   else local.get $hi${axis} local.get $lo${axis} f64.add f64.const 0.5 f64.mul end
   f64.store offset=${i*8}`).join('\n')}
 )`;
 for(const [name,half] of [['shapePivot_int__int__double_',0],['shapeHalf_int__int__double_',1]]){
  const start=wat.indexOf('  (func $'+name+' '),end=wat.indexOf('\n  (',start+1);
  if(start<0||end<0)throw Error('Missing native wing shape function');
  const prior=wat.slice(start,end);let at=prior.indexOf('\n')+1;
  if(prior.slice(at).startsWith('    (local'))at=prior.indexOf('\n',at)+1;
  const check=`    local.get 2 i32.const 16 i32.eq
    local.get 2 i32.const 0 i32.lt_s
    i32.const 0 i32.load offset=1119524 i32.const 16 i32.eq i32.and i32.or
    local.get 1 i32.const 16 i32.sub i32.const 2 i32.lt_u i32.and
    if
     local.get 0 local.get 1 local.get 3 i32.const ${half} call $mig23FlapSupport return
    end\n`;
  wat=wat.slice(0,start)+prior.slice(0,at)+check+prior.slice(at)+wat.slice(end);
 }
 return wat.slice(0,wat.lastIndexOf(')'))+helper+'\n)';
}
