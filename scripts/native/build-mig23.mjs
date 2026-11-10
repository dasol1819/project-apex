// Reproducible 17th native aircraft extension; the original payload is untouched.
// MiG-23MLD wing AUTO targets are managed by the typed JS governor, with actual
// current angle, aerodynamic schedule and damage feedback in the native WASM.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import wabtFactory from 'wabt';
import {patchMissiles} from './patch-missiles.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const build=path.join(root,'.native-build');
execFileSync(process.execPath,[path.join(root,'scripts/native/build-mig15.mjs')],{stdio:'inherit'});
const base=fs.readFileSync(path.join(root,'web/flight.wasm'));
const sim=new WebAssembly.Instance(new WebAssembly.Module(base),{
 env:{pow:Math.pow,atan2:Math.atan2,asin:Math.asin,external_terrain:()=>0}
}).exports;
const memory=Buffer.from(sim.memory.buffer);
const old=JSON.parse(fs.readFileSync(path.join(build,'mig15-layout.json'))).regions;
const cfg=JSON.parse(fs.readFileSync(path.join(root,'assets/mig23mld/flight-config.json')));
const baseParts=JSON.parse(fs.readFileSync(path.join(root,'assets/mig29-combat/shapes.json'))).parts;
const expect=(x,m)=>{if(!x)throw Error(m)};
let wat=fs.readFileSync(path.join(build,'mig15.wat'),'utf8');
let cursor=memory.length;const additions=[],regions={},relocations=[];
function region(name,b){
 cursor=Math.ceil(cursor/16)*16;const at=cursor;cursor+=b.length;
 additions.push({at,b});regions[name]=at;return at;
}
function table(name,count,stride,fill){
 const b=Buffer.alloc(count*stride);
 memory.copy(b,0,old[name],old[name]+(count-1)*stride);
 fill(b);const at=region(name,b);
 relocations.push([old[name],stride,at]);return at;
}
const frames=table('airframes',17,288,b=>{
 memory.copy(b,16*288,old.airframes+14*288,old.airframes+15*288);
 for(const [off,val] of Object.entries(cfg.airframeDoubles))b.writeDoubleLE(val,16*288+Number(off));
 for(const [off,val] of Object.entries(cfg.airframeInts))b.writeInt32LE(val,16*288+Number(off));
});
table('rcs',17,8,b=>b.writeDoubleLE(cfg.rcs,16*8));
table('radars',17,56,b=>{
 const k=16*56;
 for(const [i,v] of [cfg.radar.range,cfg.radar.surfaceRange,cfg.radar.revisit,
   cfg.radar.scanStepDegrees*Math.PI/180,cfg.radar.notch,cfg.radar.quality].entries())
  b.writeDoubleLE(v,k+i*8);
 b.writeInt32LE(cfg.radar.tws,k+48);
 b.writeInt32LE(cfg.radar.datalink,k+52);
});
table('loadouts',47,24,b=>[16,4,3,-1,0,0].forEach((v,i)=>b.writeInt32LE(v,46*24+i*4)));
table('irAttachmentParts',17,4,b=>b.writeInt32LE(12,16*4));
// The incremental compiler puts all existing 0..15 rows in relocated
// buffers; this second relocation only changes their table BASE instructions.
wat=wat.replace(/\bi32\.const (\d+)\b/g,(token,t)=>{
 const n=+t,r=relocations.find(([base,stride])=>n>=base&&n<base+stride);
 return r?'i32.const '+(r[2]+n-r[0]):token;
});
let bounds=0;wat=wat.replace(/i32\.const 16\n(\s+)i32\.lt_u/g,(_,sp)=>{
 bounds++;return 'i32.const 17\n'+sp+'i32.lt_u';
});
expect(bounds>=25&&bounds<=34,'Unexpected native aircraft type bound count: '+bounds);
function change(name,fn){
 const start=wat.indexOf('  (func $'+name+' ');
 expect(start>=0,'Missing WAT function '+name);
 const end=wat.indexOf('\n  (',start+1);
 const prior=wat.slice(start,end),after=fn(prior);
 expect(prior!==after,'No patch applied to '+name);
 wat=wat.slice(0,start)+after+wat.slice(end);
}
function pre(name,src){
 change(name,body=>{
  let p=body.indexOf('\n')+1;
  if(body.slice(p).startsWith('    (local'))p=body.indexOf('\n',p)+1;
  return body.slice(0,p)+src+'\n'+body.slice(p);
 });
}
const isMig='i32.const 0\n    i32.load offset=1119524\n    i32.const 16\n    i32.eq';
for(const n of ['Loadouts::ensure__','set_strike_loadout'])
 change(n,b=>b.replaceAll('i32.const 46\n','i32.const 47\n'));
change('set_loadout',b=>b.replace('i32.const 45\n','i32.const 46\n'));
// Expand clean-store guards for one additional external AAM-only profile.
const clean=(1n<<38n)|(1n<<40n)|(1n<<41n)|(1n<<42n)|(1n<<43n)|(1n<<44n)|(1n<<45n);
let profileMasks=0;
for(const oldMask of [219916330153n,219949884585n,256489944831n]){
 const m=oldMask|clean,needle='i64.const '+m+'\n';
 expect(wat.includes(needle),'Missing profile capabilities mask '+m);
 wat=wat.replaceAll(needle,'i64.const '+(m|(1n<<46n))+'\n');profileMasks++;
}
// MiG-23MLD: one engine, one fin, one afterburning nozzle. Conventional
// aileronless spoiler/taileron mix is added separately from basic aerodynamics.
const absent=[6,8,21,23];
const present=(1<<30)-1-absent.reduce((a,n)=>a+(1<<n),0);
pre('Airframes::partPresent_int__int_',`    local.get 1
    i32.const 16
    i32.eq
    local.get 1
    i32.const 0
    i32.lt_s
    ${isMig}
    i32.and
    i32.or
    if
      local.get 0
      i32.const 30
      i32.lt_u
      i32.const ${present}
      local.get 0
      i32.shr_u
      i32.const 1
      i32.and
      i32.and
      return
    end`);
function vectors(name,rows){
 const b=Buffer.alloc(rows.length*24);
 rows.flat().forEach((v,i)=>b.writeDoubleLE(v,i*8));
 return region(name,b);
}
function vectorLoad(at){
 return [0,8,16].map(off=>`      local.get 0
      local.get 1
      i32.const 24
      i32.mul
      i32.const ${at+off}
      i32.add
      f64.load
      f64.store offset=${off}`).join('\n');
}
const shapes=baseParts.map((p,i)=>{
 const pivot=[p.pivot[0]*1.09,p.pivot[1],p.pivot[2]*.965];
 const half=[p.half[0]*1.09,p.half[1],p.half[2]*.965];
 // MiG-23 has a central vertical tail and a single exhaust.
 if(i===5){pivot[0]=0;half[0]=.14;}
 if(i===7){pivot[0]=0;half[0]=.55;}
 if(i===22){pivot[0]=0;half[0]=.58;}
 return {id:i,pivot,half};
});
for(const [fn,key] of [['shapePivot_int__int__double_','pivot'],['shapeHalf_int__int__double_','half']]){
 const at=vectors(key,shapes.map(p=>p[key]));
 pre(fn,`    local.get 2
    i32.const 16
    i32.eq
    local.get 2
    i32.const 0
    i32.lt_s
    ${isMig}
    i32.and
    i32.or
    if
${vectorLoad(at)}
      return
    end`);
}
const gear=vectors('gearContacts',cfg.gearContacts);
pre('shapeProbe_int__V_',`    ${isMig}
    local.get 1
    i32.const 24
    i32.sub
    i32.const 3
    i32.lt_u
    i32.and
    if
${[0,8,16].map(off=>`      local.get 0
      local.get 1
      i32.const 24
      i32.sub
      i32.const 24
      i32.mul
      i32.const ${gear+off}
      i32.add
      f64.load
      f64.store offset=${off}`).join('\n')}
      return
    end`);
for(const [name,rows] of [['Airframes::irMount_int_',cfg.irMounts],['Airframes::rfMount_int_',cfg.rfMounts]]){
 const at=vectors(name,rows);
 pre(name,`    ${isMig}
    if
${vectorLoad(at)}
      return
    end`);
}
// Wing sweep setter in the original F-14 requires type 4 and clamps 20..68.
// Admit type 16 too, but use physically appropriate MiG-23 16..72 stops.
change('set_wing_sweep',b=>{
 const guard='i32.const 4\n      i32.ne';
 expect(b.includes(guard),'F-14 wing sweep type guard changed');
 b=b.replace(guard,`i32.const 4
      i32.eq
      ${isMig}
      i32.or
      i32.eqz`);
 b=b.replaceAll('f64.const 0x1.4p+4 (;=20;)',`f64.const 16
      f64.const 20
      ${isMig}
      select`);
 b=b.replaceAll('f64.const 0x1.1p+6 (;=68;)',`f64.const 72
      f64.const 68
      ${isMig}
      select`);
 return b;
});
// Expose the typed sweep state through the existing get_aircraft_configuration API.
change('get_aircraft_configuration',b=>{
 const mark='i32.const 4\n    i32.eq\n    select';
 expect(b.includes(mark),'configuration swept-wing type selector changed');
 return b.replace(mark,`i32.const 4
    i32.eq
    ${isMig}
    i32.or
    select`);
});
// Force STT/SARH only; do not accidentally grant modern TWS to the Sapfir.
pre('set_radar_mode',`    ${isMig}
    if
      i32.const 1
      local.set 0
    end`);
// Drive slotted flaps/ailerons through the native control/damage path.
pre('DamageState::move_int__double__double__double__double__double__const',`    ${isMig}
    local.get 1
    i32.const 16
    i32.sub
    i32.const 2
    i32.lt_u
    i32.and
    if
      i32.const 0
      f64.load offset=1109680
      f64.const ${25*Math.PI/180}
      f64.mul
      local.set 3
      f64.const 0.20
      local.set 4
      f64.const 0.16
      local.set 5
    end`);

// Route the existing hydraulic actuator and swept-wing coefficient path to
// native type 16. The F-14 path remains unchanged, while angle normalization
// uses the MiG's 16..72 degree range instead of the Tomcat's 20..68 degrees.
function wingGate(b,expression,needle){
 expect(b.includes(needle),'wing gate missing: '+expression);
 return b.replace(needle,needle.replace(expression,expression==='i32.ne'?'i32.eq':'i32.ne')+
  (expression==='i32.ne'?'\n      '+isMig+'\n      i32.or\n      i32.eqz':''));
}
function sweepTerms(section){
 const substitutions=[
  ['f64.const -0x1.4p+4 (;=-20;)','f64.const -16\n      f64.const -20\n      '+isMig+'\n      select'],
  ['f64.const 0x1.8p+5 (;=48;)','f64.const 56\n      f64.const 48\n      '+isMig+'\n      select'],
  ['f64.const 0x1.4p+4 (;=20;)','f64.const 16\n      f64.const 20\n      '+isMig+'\n      select'],
  ['f64.const 0x1.1p+6 (;=68;)','f64.const 72\n      f64.const 68\n      '+isMig+'\n      select']
 ];
 for(const [old,now] of substitutions)section=section.split(old).join(now);
 return section;
}
for(const [name,argument] of [
 ['coefficients_double__double__double__double__double__double__double__double__double__double__double_','8'],
 ['liftCoefficient_double__double__double_','3']
]){
 change(name,b=>{
  const marker='local.get '+argument+'\n        i32.const 4\n        i32.ne';
  const at=b.indexOf('i32.const 4\n');
  // Match whitespace independently of the original compiler indentation.
  const regex=new RegExp('(local\\.get '+argument+'\\n)(\\s+)i32\\.const 4\\n\\s+i32\\.ne');
  expect(regex.test(b),'lift/drag F-14 guard '+name);
  b=b.replace(regex,(_,prefix,sp)=>prefix+sp+'i32.const 4\n'+sp+'i32.eq\n'+sp+isMig+'\n'+sp+'i32.or\n'+sp+'i32.eqz');
  return sweepTerms(b);
 });
}
change('step',b=>{
 // Wing lift/camber reduction is calculated before the hydraulic servo.
 const aero=b.indexOf('f64.load offset=1078952');
 expect(aero>0,'sweep aerodynamic calculation');
 let a=b.slice(Math.max(0,aero-1200),aero+1300);
 const guard=/local\.get 4\n(\s+)i32\.const 4\n\s+i32\.ne/;
 expect(guard.test(a),'wing drag guard');
 a=a.replace(guard,(_,sp)=>'local.get 4\n'+sp+'i32.const 4\n'+sp+'i32.eq\n'+sp+isMig+'\n'+sp+'i32.or\n'+sp+'i32.eqz');
 a=sweepTerms(a);
 b=b.slice(0,aero-1200)+a+b.slice(aero+1300);
 const marker=b.indexOf('i32.load8_u offset=1119600');
 expect(marker>0,'hydraulic sweep controller');
 const gate=b.lastIndexOf('i32.const 4\n      i32.ne',marker);
 expect(gate>0&&marker-gate<1300,'hydraulic type guard');
 b=b.slice(0,gate)+('i32.const 4\n      i32.eq\n      '+isMig+'\n      i32.or\n      i32.eqz')+b.slice(gate+'i32.const 4\n      i32.ne'.length);
 // Adjust whole sweep actuator and wind-load geometry, preserving F-14 values.
 const after=b.indexOf('f64.store offset=1078952',marker);
 expect(after>marker,'hydraulic position update');
 const tail=b.indexOf('f64.store offset=1078968',after);
 const end=tail>after?tail+28:after+1600;
 b=b.slice(0,marker)+sweepTerms(b.slice(marker,end))+b.slice(end);
 return b;
});

wat=patchMissiles(wat,region,17,regions.radars);
const pages=Math.ceil(cursor/65536);
wat=wat.replace(/\(memory \(;0;\) \d+\)/,`(memory (;0;) ${pages})`);
wat=wat.slice(0,wat.lastIndexOf(')'))+
 additions.map(({at,b})=>'  (data (i32.const '+at+') "'+[...b].map(v=>'\\'+v.toString(16).padStart(2,'0')).join('')+'")').join('\n')+'\n)';
fs.writeFileSync(path.join(build,'mig23.wat'),wat);
const wabt=await wabtFactory();
const parser=wabt.parseWat('mig23.wat',wat,{bulk_memory:true,nontrapping_fptoint:true});
parser.resolveNames();parser.validate();
const {buffer}=parser.toBinary({write_debug_names:true});
const out=Buffer.from(buffer);
new WebAssembly.Module(out);
fs.writeFileSync(path.join(root,'web/flight.wasm'),out);
fs.writeFileSync(path.join(build,'mig23-layout.json'),JSON.stringify({regions,pages,bounds,profileMasks},null,2)+'\n');
console.log(JSON.stringify({result:'BUILT',aircraft:17,bytes:out.byteLength,pages,bounds,profileMasks,wingNative:true}));
