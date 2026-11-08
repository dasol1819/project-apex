// Temporary diagnostic for native variable-sweep dispatch (does not change web data).
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
execFileSync(process.execPath,['scripts/native/build-mig15.mjs'],{stdio:'inherit'});
const wat=fs.readFileSync('.native-build/mig15.wat','utf8');
function body(name){
 const i=wat.indexOf('  (func $'+name+' ');if(i<0){console.log('MISSING '+name);return''}
 const j=wat.indexOf('\n  (',i+1);
 return wat.slice(i,j);
}
for(const name of ['set_wing_sweep','get_aircraft_configuration','get_aircraft_specs','set_aircraft_type','set_controls','get_state','get_radar_profile']){
 const b=body(name);console.log('\n=== '+name+' '+b.length+' chars ===\n'+b.slice(0,14000));
}
const step=body('step');console.log('=== STEP length '+step.length+' ===');
for(const needle of ['i32.const 4','f64.store offset=','f64.load offset=']){
 let from=0,count=0;while(needle==='i32.const 4'&&(from=step.indexOf(needle,from))>=0&&count++<30){
  console.log('STEP TYPE4@'+from+': '+step.slice(Math.max(0,from-350),from+450).replace(/\n/g,'\\n'));from+=needle.length;
 }
}
const names=[...wat.matchAll(/^  \(func \$([^\s(]+)/gm)].map(m=>m[1]);console.log('SUSPECT NAMES '+names.filter(n=>/wing|sweep|aero|coeff|engine|thrust|fuel/i.test(n)).join(' | '));

for(const needle of ['1078952','1078960','1119600','1078968']){
 console.log('\n=== WING ADDRESS '+needle+' ===');
 for(const m of [...wat.matchAll(/^  \\(func \\$([^\s(]+)/gm)]){
  const at=m.index,j=wat.indexOf('\n  (',at+1),b=wat.slice(at,j<0?wat.length:j);
  let p=0,count=0;while((p=b.indexOf(needle,p))>=0){
   if(count++<12)console.log(m[1]+'@'+p+' '+b.slice(Math.max(0,p-440),p+530).replace(/\n/g,'\\n'));p+=needle.length;
  }
 }
}
