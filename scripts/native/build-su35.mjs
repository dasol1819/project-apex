// Reproducible, checksum-pinned extension of the exported native combat module.
// No existing aircraft definition or original encoded payload is overwritten.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import wabtFactory from 'wabt';

process.on('uncaughtException',error=>{console.error(error.message);process.exit(1);});

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),build=path.join(root,'.native-build');
fs.mkdirSync(build,{recursive:true});
const originalPath=path.join(build,'original.wasm');
execFileSync('python3',[path.join(root,'scripts/native/extract_original.py'),originalPath]);
const original=fs.readFileSync(originalPath);
if(crypto.createHash('sha256').update(original).digest('hex')!=='51522ef91770b10155634793b49bcb92772507ef3b3bfedd53c889068385aa36')throw new Error('Unsupported native module revision');
const config=JSON.parse(fs.readFileSync(path.join(root,'assets/su35-combat/config.json')));
const shapes=JSON.parse(fs.readFileSync(path.join(root,'assets/su35-combat/shapes.json')));
const baseline=new WebAssembly.Instance(new WebAssembly.Module(original),{env:{pow:Math.pow,atan2:Math.atan2,asin:Math.asin,external_terrain:()=>0}}).exports;
const memory=Buffer.from(baseline.memory.buffer),wabt=await wabtFactory();
const parsed=wabt.readWasm(original,{readDebugNames:true});
let wat=parsed.toText({foldExprs:false,inlineExport:false});
const additions=[],regions={},oldPages=memory.length/65536;let cursor=memory.length;
function region(name,bytes){cursor=Math.ceil(cursor/16)*16;const at=cursor;additions.push({at,bytes:Buffer.from(bytes)});cursor+=bytes.length;regions[name]=at;return at;}
function expect(condition,message){if(!condition)throw new Error(message);}
function changeFunction(name,transform){
  const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),start=wat.search(new RegExp('^  \\(func \\$'+escaped+'(?:\\s|\\()','m'));
  expect(start>=0,'Missing native function '+name);
  const remaining=wat.slice(start+1),next=remaining.search(/^  \((?:func|table|memory|global|export|elem|data|start)\b/m),end=next<0?wat.length:start+1+next;
  const before=wat.slice(start,end),after=transform(before);expect(after!==before,'No change applied to '+name);wat=wat.slice(0,start)+after+wat.slice(end);
}
function preamble(name,code){changeFunction(name,body=>{let at=body.indexOf('\n')+1;if(body.slice(at).startsWith('    (local'))at=body.indexOf('\n',at)+1;return body.slice(0,at)+code+'\n'+body.slice(at);});}
const current='i32.const 0\n    i32.load offset=1119524';
const isSu35=current+'\n    i32.const 13\n    i32.eq';
const f64=n=>'f64.const '+Number(n).toString();

// Relocate fixed-length definition tables into a new page; preserve old rows.
const frames=Buffer.alloc(14*288);memory.copy(frames,0,1056176,1056176+13*288);memory.copy(frames,13*288,1056176+10*288,1056176+11*288);
for(const [offset,value]of Object.entries(config.airframeDoubles))frames.writeDoubleLE(value,13*288+Number(offset));
for(const [offset,value]of Object.entries(config.airframeInts))frames.writeInt32LE(value,13*288+Number(offset));
const frameAt=region('airframes',frames);
const rcs=Buffer.alloc(14*8);memory.copy(rcs,0,1059920,1059920+13*8);rcs.writeDoubleLE(config.rcs,13*8);const rcsAt=region('rcs',rcs);
const radars=Buffer.alloc(14*56);memory.copy(radars,0,1060992,1060992+13*56);
for(const [i,value]of [config.radar.range,config.radar.surfaceRange,config.radar.revisit,config.radar.scanStepDegrees*Math.PI/180,config.radar.notch,config.radar.quality].entries())radars.writeDoubleLE(value,13*56+i*8);
radars.writeInt32LE(config.radar.tws,13*56+48);radars.writeInt32LE(config.radar.datalink,13*56+52);const radarAt=region('radars',radars);
const presets=Buffer.alloc(42*24);memory.copy(presets,0,1048672,1048672+38*24);
for(const p of config.loadouts)[p.aircraft,p.ir,p.rfMask,p.bomb,p.bombs,p.pod].forEach((v,i)=>presets.writeInt32LE(v,p.id*24+i*4));
const presetAt=region('loadouts',presets);
const irParts=Buffer.alloc(14*4);memory.copy(irParts,0,1075808,1075808+13*4);irParts.writeInt32LE(12,13*4);
const irPartsAt=region('irAttachmentParts',irParts);

// Compiler-inlined references are bounded to known table-field addresses.
const ranges=[[1056176,288,frameAt],[1059920,8,rcsAt],[1060992,56,radarAt],[1048672,24,presetAt],[1075808,4,irPartsAt]];
let relocated=0;wat=wat.replace(/\bi32\.const (\d+)\b/g,(source,text)=>{const value=Number(text),r=ranges.find(([a,n])=>value>=a&&value<a+n);if(!r)return source;relocated++;return 'i32.const '+(r[2]+value-r[0]);});
let bounds=0;wat=wat.replace(/i32\.const 13\n(\s+)i32\.lt_u/g,(_,space)=>{bounds++;return 'i32.const 14\n'+space+'i32.lt_u';});
expect(bounds>=20&&relocated>=40,'Native table/reference layout changed');
// The compiler folded profile membership into masks. Extend their membership
// together with the table; otherwise new profiles could read weapon[-1].
const cleanBits=(1n<<38n)|(1n<<40n)|(1n<<41n),precisionBit=1n<<39n;
for(const [old,bits]of [[219916330153n,cleanBits],[219949884585n,cleanBits],[256489944831n,cleanBits],[18387962112n,precisionBit],[54928022358n,precisionBit]]){
  const token='i64.const '+old+'\n';expect(wat.includes(token),'Loadout capability mask '+old);
  wat=wat.replaceAll(token,'i64.const '+(old|bits)+'\n');
}
for(const name of ['Loadouts::ensure__','set_strike_loadout'])changeFunction(name,b=>b.replaceAll('i32.const 38\n','i32.const 42\n'));
changeFunction('set_loadout',b=>b.replace('i32.const 37\n','i32.const 41\n'));

// PESA/TWS, exterior weapon carriage and the second fixed fin are distinct
// from the internal-carriage/stealth rules used by the Su-57.
preamble('Airframes::partPresent_int__int_',`    local.get 1
    i32.const 13
    i32.eq
    local.get 1
    i32.const 0
    i32.lt_s
    ${isSu35}
    i32.and
    i32.or
    if
      local.get 0
      i32.const 30
      i32.lt_u
      return
    end`);
function finishOutput(name,address,stores){changeFunction(name,body=>{const needle='    i32.const '+address+')';expect(body.includes(needle),'Output layout '+name);return body.replace(needle,`    ${isSu35}\n    if\n${stores}\n    end\n`+needle);});}
finishOutput('get_aircraft_specs',1119616,`      i32.const 1119712\n      f64.const 15\n      f64.store`);
finishOutput('get_aircraft_configuration',1119536,`      i32.const 1119592\n      f64.const 1\n      f64.store`);
for(const name of ['set_aircraft_type','set_tvc'])changeFunction(name,body=>body.replace(/(local\.get (\d+)\n\s+)i32\.const 10\n(\s+)i32\.eq/,(_,prefix,index,space)=>prefix+'i32.const 10\n'+space+'i32.eq\n'+space+'local.get '+index+'\n'+space+'i32.const 13\n'+space+'i32.eq\n'+space+'i32.or'));

// Collision and ground contacts are generated from the adapted visible model.
function vectors(name,rows){const bytes=Buffer.alloc(rows.length*24);rows.flat().forEach((v,i)=>bytes.writeDoubleLE(v,i*8));return region(name,bytes);}
const pivotAt=vectors('partPivots',shapes.parts.map(p=>p.pivot)),halfAt=vectors('partHalfExtents',shapes.parts.map(p=>p.half));
const typeArgument=`local.get 2\n    i32.const 13\n    i32.eq\n    local.get 2\n    i32.const 0\n    i32.lt_s\n    ${isSu35}\n    i32.and\n    i32.or`;
function copyVector(table,index=1){return [0,8,16].map(offset=>`      local.get 0\n      local.get ${index}\n      i32.const 24\n      i32.mul\n      i32.const ${table+offset}\n      i32.add\n      f64.load\n      f64.store offset=${offset}`).join('\n');}
for(const [name,table]of [['shapePivot_int__int__double_',pivotAt],['shapeHalf_int__int__double_',halfAt]])preamble(name,`    ${typeArgument}\n    if\n${copyVector(table)}\n      return\n    end`);
// Native probes already remap other regions through shapePivot/shapeHalf.
preamble('shapeProbe_int__V_',`    ${isSu35}\n    local.get 1\n    i32.const 24\n    i32.sub\n    i32.const 3\n    i32.lt_u\n    i32.and\n    if\n      local.get 0\n      local.get 2\n      f64.load offset=8\n      f64.store offset=8\n      local.get 0\n      f64.const -4.07\n      f64.const 1.72\n      local.get 1\n      i32.const 24\n      i32.eq\n      select\n      f64.store offset=16\n      local.get 0\n      f64.const 0\n      f64.const -2.20\n      f64.const 2.20\n      local.get 1\n      i32.const 25\n      i32.eq\n      select\n      local.get 1\n      i32.const 24\n      i32.eq\n      select\n      f64.store\n      return\n    end`);
const rfMounts=Array.from({length:6},(_,slot)=>[(slot%2?1:-1)*(slot<2?4.4:slot<4?3.1:1.27),slot<4?-.02:-.96,slot<2?1.85:slot<4?.92:1.15]);
const irMounts=[[-6.05,.16,2.45],[6.05,.16,2.45]],bombMounts=[[-3.10,-.23,.92],[3.10,-.23,.92]];
for(const [name,rows]of [['Airframes::rfMount_int_',rfMounts],['Airframes::irMount_int_',irMounts],['Bombs::mount_int__double_',bombMounts]]){
  const at=vectors(name.split('::')[0]+'Mounts'+rows.length,rows);preamble(name,`    ${isSu35}\n    if\n${copyVector(at)}\n      return\n    end`);
}
preamble('Loadouts::podMass__',`    ${isSu35}\n    if\n      f64.const 225\n      f64.const 0\n      i32.const 0\n      i32.load offset=1119916\n      i32.const 39\n      i32.eq\n      select\n      return\n    end`);
function typeOr(body,local,operator='eq',count=1){
  const re=new RegExp(`local\\.get ${local}\\n(\\s+)i32\\.const 10\\n\\s+i32\\.${operator}`,'g');let n=0;
  return body.replace(re,(source,space)=>++n>count?source:source+`\n${space}local.get ${local}\n${space}i32.const 13\n${space}i32.${operator}\n${space}i32.${operator==='eq'?'or':'and'}`);
}
changeFunction('Combat::storeMass__',body=>{
  body=typeOr(body,4,'ne');
  // Keep the native ammunition/health checks; change only carried-store masses.
  for(const [old,next]of [[190,175],[106,105]])body=body.replace(`i32.const ${old}\n`,`i32.const ${next}\n      i32.const ${old}\n      ${isSu35}\n      select\n`);
  return body;
});
changeFunction('set_loadout',body=>body.replace(/i32\.const 6\n(\s+)i32\.gt_u/,(_,space)=>'i32.const 7\n'+space+'i32.gt_u'));
changeFunction('reset_sortie_spawn',body=>body.replace(/(i32\.const -6\n\s+i32\.add\n\s+)i32\.const 6\n(\s+)i32\.gt_u/,(_,prefix,space)=>prefix+'i32.const 7\n'+space+'i32.gt_u'));
finishOutput('get_amraam_state',1397024,'      i32.const 1397248\n      f64.const 77\n      f64.store');

// Estimated parasitic drag follows carried missiles, bombs and the pod.
// Launch rails remain on the aircraft after firing, so keep their small term.
changeFunction('coefficients_double__double__double__double__double__double__double__double__double__double__double_',body=>{
  const terms=[];
  for(let i=0;i<2;i++)terms.push(`      i32.const 0\n      i32.load8_u offset=${1079208+i}\n      i32.const 0\n      i32.load8_u offset=${1079212+i}\n      i32.and\n      f64.convert_i32_u\n      f64.const 0.00050\n      f64.mul\n      f64.add`);
  for(let i=0;i<6;i++)terms.push(`      i32.const 0\n      i32.load8_u offset=${1079232+i}\n      f64.convert_i32_u\n      f64.const 0.00055\n      f64.mul\n      f64.add`);
  for(let i=0;i<2;i++)terms.push(`      i32.const 0\n      i32.load8_u offset=${1350992+i}\n      f64.convert_i32_u\n      f64.const 0.00135\n      f64.mul\n      f64.add`);
  const presetValue=offset=>`      i32.const 0\n      i32.load offset=1119916\n      i32.const 24\n      i32.mul\n      i32.const ${presetAt+offset}\n      i32.add\n      i32.load`;
  terms.push(`${presetValue(4)}\n${presetValue(8)}\n      i32.popcnt\n      i32.add\n${presetValue(16)}\n      i32.add\n      f64.convert_i32_s\n      f64.const 0.00015\n      f64.mul\n      f64.add`);
  const code=`    ${isSu35}\n    if\n      local.get 0\n      local.get 0\n      f64.load offset=8\n${terms.join('\n')}\n      call $Loadouts::podMass__\n      f64.const 0.000004\n      f64.mul\n      f64.add\n      f64.store offset=8\n    end\n`;
  const end=body.lastIndexOf(')');return body.slice(0,end)+'\n'+code+body.slice(end);
});
// Russian external stations detach with their supporting wing/intake.
preamble('Amraam::attached_int_',`    ${isSu35}\n    if\n      i32.const 0\n      i32.load offset=1119916\n      i32.const 24\n      i32.mul\n      i32.const ${presetAt+8}\n      i32.add\n      i32.load\n      local.get 0\n      i32.shr_s\n      i32.const 1\n      i32.and\n      i32.const 0\n      i32.load8_u offset=1135208\n      i32.const 1\n      i32.eq\n      i32.and\n      i32.const 0\n      f64.load offset=1133512\n      f64.const 0.08\n      f64.ge\n      i32.and\n      local.get 0\n      i32.const 1\n      i32.and\n      i32.const 1\n      i32.const 27\n      local.get 0\n      i32.const 4\n      i32.lt_u\n      select\n      i32.add\n      i32.const 8\n      i32.mul\n      i32.const 1133512\n      i32.add\n      f64.load\n      f64.const 0.08\n      f64.ge\n      i32.and\n      return\n    end`);

// Native TVC continues to apply forces, engine health, actuator lag and FBW.
// The Su-35 has exterior stores; its bay-door rules deliberately stay separate.
changeFunction('step',body=>{
  const start=body.indexOf('f64.store offset=1109928'),end=body.indexOf('f64.store offset=1109768',start);
  expect(start>0&&end>start,'TVC force/actuator block');
  let section=body.slice(start,end);section=typeOr(typeOr(section,3),3,'ne');
  section=section.replace(/i32\.load offset=1119524\n(\s+)i32\.const 10\n\s+i32\.eq/g,(source,space)=>source+`\n${space}${isSu35}\n${space}i32.or`);
  section=section.replace(/f64\.const (-?0x[\da-f.]+p[-+]\d+) \(;=(-?)0\.349066;\)/g,(source,hex,negative)=>`${isSu35}\n      if (result f64)\n        f64.const ${negative?'-':''}${Math.PI/12}\n      else\n        ${source}\n      end`);
  section=section.replace('f64.const 0x1.9b0f58956c202p-2 (;=0.401426;)',`${isSu35}\n      if (result f64)\n        f64.const ${32*Math.PI/180}\n      else\n        f64.const 0x1.9b0f58956c202p-2 (;=0.401426;)\n      end`);
  body=body.slice(0,start)+section+body.slice(end);
  // The canted vector axes are 32 degrees; the Su-57 retains its 23 degrees.
  const cant='f64.const 0x1.9b0f58956c202p-2 (;=0.401426;)';
  const at=body.indexOf(cant+'\n    f64.const 0x0p+0');expect(at>0,'Nozzle force cant');
  const old=body.slice(at,body.indexOf('    local.tee 0',at));
  body=body.replace(old,`    ${isSu35}\n    if (result f64)\n      f64.const ${32*Math.PI/180}\n    else\n      ${old.trim()}\n    end\n`);
  // GSh-30-1 muzzle velocity and impact energy, independently of gun cadence.
  for(const [local,anchor]of [[4,'i32.const 860'],[3,'f64.const 0x1.0cccccccccccdp+1']]){
    const at=body.indexOf(anchor);expect(at>0,'30mm gun parameter');
    const tail=typeOr(body.slice(at),local);body=body.slice(0,at)+tail;
  }
  // R-73 flight estimates: 40g, 2.3 boost factor, 45-degree seeker cone.
  // Use the bounded, unique 28/42-degree legacy seeker selection.
  body=body.replace(/i32\.const 28\n(\s+)i32\.const 42\n/,(source,space)=>`i32.const 28\n${space}i32.const 45\n${space}i32.const 42\n${space}${isSu35}\n${space}select\n`);
  let marker=body.indexOf('i64.const 4631530004285489152');
  const irEnd=body.indexOf('        local.get 1\n        i32.const 3600',marker);expect(irEnd>marker,'IR motion profile');
  body=body.slice(0,irEnd)+`        ${isSu35}\n        if\n          local.get 1\n          f64.const 40\n          f64.store offset=3672\n          f64.const 2.3\n          local.set 13\n        end\n`+body.slice(irEnd);
  // Dedicated R-77-1 motion parameters in the existing proportional-navigation
  // solver: flight life, boost/drag terms, acceleration, speed and turn limit.
  const rfMotion='        local.get 1\n        local.get 0\n        f64.store offset=3712\n        local.get 1\n        local.get 12\n        f64.store offset=3704';
  expect(body.includes(rfMotion),'RF motion profile boundary');
  body=body.replace(rfMotion,`        ${isSu35}\n        if\n          f64.const 40\n          local.set 23\n          f64.const 2.1\n          local.set 18\n          f64.const 5\n          local.set 16\n          f64.const 220\n          local.set 19\n          f64.const 1250\n          local.set 12\n          f64.const 45\n          local.set 0\n        end\n`+rfMotion);
  // Include the new IR attachment row, and locate the 30 mm gun in the body.
  const irGuard=body.indexOf('i32.const '+irPartsAt);expect(irGuard>0,'IR attachment lookup');
  const irTail=body.slice(irGuard);body=body.slice(0,irGuard)+irTail.replace(/i32\.const 12\n(\s+)i32\.gt_u/,(_,space)=>'i32.const 13\n'+space+'i32.gt_u');
  const gun=body.indexOf('i32.const 6160');
  // Gun damage selection has a stable instruction boundary before its health load.
  const gunHealth=body.indexOf('i32.const 1133512',gun);expect(gunHealth>gun,'Gun damage linkage');
  const shift=body.lastIndexOf('      local.get 3',gunHealth);expect(shift>gun,'Gun part local');
  body=body.slice(0,shift)+`      ${isSu35}\n      if\n        i32.const 0\n        local.set 3\n      end\n`+body.slice(shift);
  // An external mount launches directly; no internal bay timing is inherited.
  return body;
});

// Additional pages belong to the extension only; all legacy addresses stay put.
const neededPages=Math.ceil(cursor/65536);
wat=wat.replace(/\(memory (;?[^)]*;\))?\s*220\)/,match=>match.replace('220',String(neededPages)));
expect(wat.includes('(memory (;0;) '+neededPages+')'),'Memory declaration changed');
const data=additions.map(({at,bytes})=>'  (data (i32.const '+at+') "'+[...bytes].map(b=>'\\'+b.toString(16).padStart(2,'0')).join('')+'")').join('\n');
wat=wat.slice(0,wat.lastIndexOf(')'))+data+'\n)';
fs.writeFileSync(path.join(build,'su35.wat'),wat);
const compiled=wabt.parseWat('su35-native.wat',wat,{bulk_memory:true,nontrapping_fptoint:true});compiled.resolveNames();compiled.validate();
const {buffer}=compiled.toBinary({write_debug_names:true});
fs.mkdirSync(path.join(root,'web'),{recursive:true});fs.writeFileSync(path.join(root,'web/flight.wasm'),Buffer.from(buffer));
fs.writeFileSync(path.join(build,'layout.json'),JSON.stringify({originalSha256:crypto.createHash('sha256').update(original).digest('hex'),regions,relocated,bounds,pages:neededPages},null,2));
console.log(JSON.stringify({result:'BUILT',bytes:buffer.length,regions,relocated,typeGuards:bounds,pages:neededPages}));
