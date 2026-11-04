import fs from 'node:fs';import path from 'node:path';import {pathToFileURL} from 'node:url';
const root=path.resolve(process.argv[2]||'public');
const {createMig15bisAircraft}=await import(pathToFileURL(path.join(root,'mig15bis-model.js')));
const m=createMig15bisAircraft(),parts=m.group.userData.damagePartBounds.map((b,id)=>({id,pivot:b.center,half:b.half.map(n=>Math.max(.035,n))}));
// Internal engine occupies its actual bay, not just the visible turbine face.
parts[7]={id:7,pivot:[0,-.03,1.8],half:[.60,.57,1.95]};
fs.writeFileSync('assets/mig15bis/shapes.json',JSON.stringify({parts,gearContacts:m.group.userData.gearContacts},null,2)+'\n');
console.log('Exported 30 MiG-15bis damage regions and three contact points');
