// Export collision regions from the same neutral geometry used by combat.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const publicRoot=path.resolve(process.argv[2]||'public');
const moduleAt=name=>import(pathToFileURL(path.join(publicRoot,name)));
const {decodeSu35Asset}=await moduleAt('su35-asset.js');
const {createSu35CombatAircraft}=await moduleAt('su35-combat-model.js');
const metadata=JSON.parse(fs.readFileSync(path.join(publicRoot,'assets/su35/airframe.json')));
const binary=fs.readFileSync(path.join(publicRoot,'assets/su35/airframe.bin'));
const asset={metadata,meshes:decodeSu35Asset(metadata,binary.buffer.slice(binary.byteOffset,binary.byteOffset+binary.byteLength))};
const model=createSu35CombatAircraft({asset});
const parts=model.group.userData.damagePartBounds.map((part,id)=>({id,pivot:part.center,half:part.half.map(v=>Math.max(v,.055))}));
// System 9 has no visible shell. It is physically represented by the gear well.
parts[9]={id:9,pivot:[0,-.3,-1.0],half:[2.25,.3,3.5]};
const data={coordinateSystem:'+X right, +Y up, +Z aft; native CG at model z=1.2m',parts,gearContacts:model.group.userData.gearContacts};
fs.writeFileSync(path.resolve('assets/su35-combat/shapes.json'),JSON.stringify(data,null,2)+'\n');
console.log(JSON.stringify(parts.map(p=>({id:p.id,pivot:p.pivot.map(n=>+n.toFixed(3)),half:p.half.map(n=>+n.toFixed(3))}))));
