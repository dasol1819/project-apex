// Export collision regions from the same neutral geometry used by combat.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const publicRoot=path.resolve(process.argv[2]||'public');
const moduleAt=name=>import(pathToFileURL(path.join(publicRoot,name)));
const {decodeMig29Asset}=await moduleAt('mig29-asset.js');
const {createMig29CombatAircraft}=await moduleAt('mig29-combat-model.js');
const metadata=JSON.parse(fs.readFileSync(path.join(publicRoot,'assets/mig29/airframe.json')));
const binary=fs.readFileSync(path.join(publicRoot,'assets/mig29/airframe.bin'));
const asset={metadata,meshes:decodeMig29Asset(metadata,binary.buffer.slice(binary.byteOffset,binary.byteOffset+binary.byteLength))};
const model=createMig29CombatAircraft({asset});
const parts=model.group.userData.damagePartBounds.map((part,id)=>({id,pivot:part.center,half:part.half.map(v=>Math.max(v,.055))}));
// System 9 has no visible shell. It is physically represented by the gear well.
parts[9]={id:9,pivot:[0,-.3,-.6],half:[1.75,.3,3.5]};
const data={coordinateSystem:'+X right, +Y up, +Z aft; native CG at model origin',parts,gearContacts:model.group.userData.gearContacts};
fs.writeFileSync(path.resolve('assets/mig29-combat/shapes.json'),JSON.stringify(data,null,2)+'\n');
console.log(JSON.stringify(parts.map(p=>({id:p.id,pivot:p.pivot.map(n=>+n.toFixed(3)),half:p.half.map(n=>+n.toFixed(3))}))));
