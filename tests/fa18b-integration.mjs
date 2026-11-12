import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'..');
const web=process.argv[2]?path.resolve(process.argv[2]):path.join(root,'web');
const catalog=fs.readFileSync(path.join(web,'aircraft-catalog.js'),'utf8');
const tree=fs.readFileSync(path.join(web,'aircraft-tree-data.js'),'utf8');
const aircraft=fs.readFileSync(path.join(web,'aircraft.js'),'utf8');
const app=fs.readFileSync(path.join(web,'app.js'),'utf8');
const source=fs.readFileSync(path.join(web,'fa18b-aircraft.js'),'utf8');
assert(catalog.includes("id:12,key:'fa18b',name:'F/A-18B'"),'F/A-18B in slot 12');
assert(catalog.includes("id:11,key:'fa18e',name:'F/A-18E'"),'F/A-18E preserved');
assert(!catalog.includes("id:12,key:'fa18f'"),'F/A-18F slot replaced');
assert(tree.includes("['b','F/A-18B'"),'F/A-18B in naval tree');
assert(!tree.includes("['fii','F/A-18F'"),'obsolete F/A-18F tree entry removed');
assert(aircraft.includes("if(Number(type)===12)return createFa18bAircraft(options)"),'slot uses source renderer');
assert(app.includes("aircraft.js?v=fa18b-1"),'bootstrap cache key updated');
for(const token of ['parseMig23Glb','get sourceLoaded()','weaponStore','visualEffect'])
 assert(source.includes(token),'missing authored renderer behavior: '+token);
const bin=fs.readFileSync(path.join(web,'assets/fa18/F18_Hornet_optimized.glb'));
assert.equal(bin.subarray(0,4).toString(),'glTF');
assert.equal(bin.readUInt32LE(4),2);
assert.equal(bin.readUInt32LE(8),bin.length);
const jsonLen=bin.readUInt32LE(12);
const j=JSON.parse(bin.toString('utf8',20,20+jsonLen));
assert.ok(j.meshes.length>=40&&j.nodes.length>=50);
const hash=crypto.createHash('sha256').update(bin).digest('hex');
assert.equal(hash,'e427459761adf590c6704f2c49ca051ba500c6be614a999f084c582b171f8944');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'web/manifest.json'),'utf8')).files;
for(const name of ['aircraft.js','aircraft-catalog.js','aircraft-tree-data.js','app.js','fa18b-aircraft.js','assets/fa18/CREDITS.txt','assets/fa18/F18_Hornet_optimized.glb']){
 const file=fs.readFileSync(path.join(web,name));
 assert.equal(crypto.createHash('sha256').update(file).digest('hex'),manifest[name],name+' manifest mismatch');
}
for(const name of ['aircraft.js','aircraft-catalog.js','aircraft-tree-data.js','app.js','fa18b-aircraft.js'])
 execFileSync(process.execPath,['--check',path.join(web,name)],{stdio:'inherit'});
console.log(JSON.stringify({result:'PASS',simSlot:12,variant:'F/A-18B',legacyF18E:11,bytes:bin.length,meshes:j.meshes.length,nodes:j.nodes.length,sha256:hash}));
