// Append the actual MiG-15bis to the reproducible native simulator. All 15
// preceding aircraft tables, function indices and state addresses are retained.
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {execFileSync} from 'node:child_process';import wabtFactory from 'wabt';
process.on('uncaughtException',e=>{console.error(e.message);process.exit(1);});
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),build=path.join(root,'.native-build');
execFileSync(process.execPath,[path.join(root,'scripts/native/build-mig29.mjs')],{stdio:'inherit'});
const baseline=fs.readFileSync(path.join(root,'web/flight.wasm'));fs.writeFileSync(path.join(build,'mig29-baseline.wasm'),baseline);
const sim=new WebAssembly.Instance(new WebAssembly.Module(baseline),{env:{pow:Math.pow,atan2:Math.atan2,asin:Math.asin,external_terrain:()=>0}}).exports;
const memory=Buffer.from(sim.memory.buffer),old=JSON.parse(fs.readFileSync(path.join(build,'mig29-layout.json'))).regions,
 cfg=JSON.parse(fs.readFileSync(path.join(root,'assets/mig15bis/config.json'))),shapes=JSON.parse(fs.readFileSync(path.join(root,'assets/mig15bis/shapes.json')));
let wat=fs.readFileSync(path.join(build,'mig29.wat'),'utf8'),cursor=memory.length;const additions=[],regions={},relocations=[];
const expect=(x,msg)=>{if(!x)throw Error(msg);};
function region(name,b){cursor=Math.ceil(cursor/16)*16;const at=cursor;cursor+=b.length;additions.push({at,b});regions[name]=at;return at;}
function table(name,count,stride,fill){const b=Buffer.alloc(count*stride);memory.copy(b,0,old[name],old[name]+(count-1)*stride);fill(b);const at=region(name,b);relocations.push([old[name],stride,at]);return at;}
const frames=table('airframes',16,288,b=>{memory.copy(b,15*288,old.airframes+2*288,old.airframes+3*288);for(const[o,v]of Object.entries(cfg.airframeDoubles))b.writeDoubleLE(v,15*288+Number(o));for(const[o,v]of Object.entries(cfg.airframeInts))b.writeInt32LE(v,15*288+Number(o));});
table('rcs',16,8,b=>b.writeDoubleLE(cfg.rcs,15*8));
table('radars',16,56,b=>{memory.copy(b,15*56,old.radars+9*56,old.radars+10*56);});
table('loadouts',46,24,b=>[15,0,0,-1,0,0].forEach((v,i)=>b.writeInt32LE(v,45*24+i*4)));
table('irAttachmentParts',16,4,b=>b.writeInt32LE(1,15*4));
wat=wat.replace(/\bi32\.const (\d+)\b/g,(token,n)=>{const v=+n,r=relocations.find(([a,stride])=>v>=a&&v<a+stride);return r?'i32.const '+(r[2]+v-r[0]):token;});
let bounds=0;wat=wat.replace(/i32\.const 15\n(\s+)i32\.lt_u/g,(_,sp)=>{bounds++;return 'i32.const 16\n'+sp+'i32.lt_u';});expect(bounds===28,'Expected 28 aircraft bounds, found '+bounds);
function change(name,fn){const a=wat.indexOf('  (func $'+name+' ');expect(a>=0,'Missing '+name);const b=wat.indexOf('\n  (',a+1),before=wat.slice(a,b),after=fn(before);expect(after!==before,'No change '+name);wat=wat.slice(0,a)+after+wat.slice(b);}
function pre(name,code){change(name,b=>{let p=b.indexOf('\n')+1;if(b.slice(p).startsWith('    (local'))p=b.indexOf('\n',p)+1;return b.slice(0,p)+code+'\n'+b.slice(p);});}
function post(name,code){change(name,b=>{const p=b.lastIndexOf(')');return b.slice(0,p)+'\n'+code+'\n'+b.slice(p);});}
const current='i32.const 0\n    i32.load offset=1119524',isMig=current+'\n    i32.const 15\n    i32.eq';
for(const name of ['Loadouts::ensure__','set_strike_loadout'])change(name,b=>b.replaceAll('i32.const 45\n','i32.const 46\n'));
change('set_loadout',b=>b.replace('i32.const 44\n','i32.const 45\n'));
// Extend clean-store masks; otherwise a new clean profile can read bomb[-1].
let masks=0;const clean=(1n<<38n)|(1n<<40n)|(1n<<41n)|(1n<<42n)|(1n<<43n)|(1n<<44n);
for(const original of [219916330153n,219949884585n,256489944831n]){const value=original|clean,token='i64.const '+value+'\n';expect(wat.includes(token),'Profile mask '+value);wat=wat.replaceAll(token,'i64.const '+(value|(1n<<45n))+'\n');masks++;}
const absent=[6,8,18,19,21,23],present=(1<<30)-1-absent.reduce((a,n)=>a+(1<<n),0);
pre('Airframes::partPresent_int__int_',`    local.get 1\n    i32.const 15\n    i32.eq\n    local.get 1\n    i32.const 0\n    i32.lt_s\n    ${isMig}\n    i32.and\n    i32.or\n    if\n      local.get 0\n      i32.const 30\n      i32.lt_u\n      i32.const ${present}\n      local.get 0\n      i32.shr_u\n      i32.const 1\n      i32.and\n      i32.and\n      return\n    end`);
function vectors(name,rows){const b=Buffer.alloc(rows.length*24);rows.flat().forEach((v,i)=>b.writeDoubleLE(v,i*8));return region(name,b);}
function copy(at,index=1){return[0,8,16].map(o=>`      local.get 0\n      local.get ${index}\n      i32.const 24\n      i32.mul\n      i32.const ${at+o}\n      i32.add\n      f64.load\n      f64.store offset=${o}`).join('\n');}
for(const[name,key]of [['shapePivot_int__int__double_','pivot'],['shapeHalf_int__int__double_','half']]){const at=vectors(key,shapes.parts.map(p=>p[key]));pre(name,`    local.get 2\n    i32.const 15\n    i32.eq\n    local.get 2\n    i32.const 0\n    i32.lt_s\n    ${isMig}\n    i32.and\n    i32.or\n    if\n${copy(at)}\n      return\n    end`);}
const gear=vectors('gearContacts',shapes.gearContacts);
pre('shapeProbe_int__V_',`    ${isMig}\n    local.get 1\n    i32.const 24\n    i32.sub\n    i32.const 3\n    i32.lt_u\n    i32.and\n    if\n${[0,8,16].map(o=>`      local.get 0\n      local.get 1\n      i32.const 24\n      i32.sub\n      i32.const 24\n      i32.mul\n      i32.const ${gear+o}\n      i32.add\n      f64.load\n      f64.store offset=${o}`).join('\n')}\n      return\n    end`);
pre('Combat::storeMass__',`    ${isMig}\n    if\n      f64.const 0\n      return\n    end`);
// Never grant 1950s equipment the modern default radar/CM/weapon capabilities.
for(const name of ['set_radar_power','set_radar_mode'])pre(name,`    ${isMig}\n    if\n      i32.const 0\n      local.set 0\n    end`);
pre('request_countermeasure',`    ${isMig}\n    if\n      i32.const 0\n      return\n    end`);
const cmClear=`    ${isMig}\n    if\n      i32.const 0\n      i64.const 0\n      i64.store offset=1079304\n      i32.const 0\n      i32.const 0\n      i32.store offset=1079168\n      i32.const 0\n      i32.const 0\n      i32.store offset=1079172\n      i32.const 0\n      i32.const 0\n      i32.store8 offset=1137605\n    end`;
for(const name of ['set_aircraft_type','reset','reset_spawn'])post(name,cmClear);
// Conventional flaps, ailerons and rudder. No leading-edge actuators or TVC.
pre('DamageState::move_int__double__double__double__double__double__const',`    ${isMig}\n    local.get 1\n    i32.const 16\n    i32.sub\n    i32.const 2\n    i32.lt_u\n    i32.and\n    if\n      i32.const 0\n      f64.load offset=1109680\n      f64.const ${30*Math.PI/180}\n      f64.mul\n      local.set 3\n      f64.const 0.22\n      local.set 4\n      f64.const 0.18\n      local.set 5\n    end`);
change('step',body=>{
 const start=body.indexOf('f64.store offset=1109968'),end=body.indexOf('f64.store offset=1110000',start);expect(start>0&&end>start,'Control mix range');
 let mix=body.slice(start,end);mix=mix.replace(/i32\.const 14\n(\s+)i32\.eq/g,(m,sp)=>m+`\n${sp}${isMig}\n${sp}i32.or`);body=body.slice(0,start)+mix+body.slice(end);
 const gun=body.indexOf('i32.const 6160'),status='      i32.const 0\n      local.set 4\n      local.get 3\n      i32.const 1135208';
 const p=body.indexOf(status,gun);expect(p>gun,'Gun installation guard');body=body.slice(0,p)+`      ${isMig}\n      if\n        i32.const 10\n        local.set 3\n      end\n`+body.slice(p);
 // Native physical projectiles retain drag, gravity, target hits and damage.
 const muzzle=body.indexOf('          i32.const 0\n          i32.const 0\n          i32.load offset=14345824',gun);expect(muzzle>gun,'Muzzle position');
 body=body.slice(0,muzzle)+`          ${isMig}\n          if\n            f64.const 0.34\n            f64.const -0.28\n            f64.const -0.46\n            i32.const 0\n            i32.load offset=14303876\n            i32.const 1\n            i32.and\n            select\n            i32.const 0\n            i32.load offset=14303876\n            i32.const 5\n            i32.rem_u\n            i32.eqz\n            select\n            local.set 40\n          end\n`+body.slice(muzzle);
 const velocity=body.indexOf('i32.const 860',gun),vEnd=body.indexOf('          local.tee 42',velocity);expect(vEnd>velocity,'Gun velocity selector');
 body=body.slice(0,vEnd)+`          f64.const 690\n          ${isMig}\n          i32.eqz\n          select\n`+body.slice(vEnd);
 const energy=body.indexOf('f64.const 0x1.0cccccccccccdp+1',velocity),eEnd=body.indexOf('            f64.mul',energy);expect(eEnd>energy,'Gun impact selector');
 body=body.slice(0,eEnd)+`            f64.const 3.8\n            f64.const 0.85\n            local.get 7\n            i32.const 14258880\n            i32.add\n            i32.load\n            select\n            ${isMig}\n            i32.eqz\n            select\n`+body.slice(eEnd);
 return body;
});
const pages=Math.ceil(cursor/65536);wat=wat.replace('(memory (;0;) 222)','(memory (;0;) '+pages+')');
wat=wat.slice(0,wat.lastIndexOf(')'))+additions.map(({at,b})=>'  (data (i32.const '+at+') "'+[...b].map(v=>'\\'+v.toString(16).padStart(2,'0')).join('')+'")').join('\n')+'\n)';
fs.writeFileSync(path.join(build,'mig15.wat'),wat);
const wabt=await wabtFactory(),parsed=wabt.parseWat('mig15.wat',wat,{bulk_memory:true,nontrapping_fptoint:true});parsed.resolveNames();parsed.validate();const{buffer}=parsed.toBinary({write_debug_names:true});
fs.writeFileSync(path.join(root,'web/flight.wasm'),Buffer.from(buffer));fs.writeFileSync(path.join(build,'mig15-layout.json'),JSON.stringify({regions,bounds,pages},null,2)+'\n');console.log(JSON.stringify({result:'BUILT',aircraft:16,bytes:buffer.length,bounds,pages}));
