// Check that a MiG-23 preview can be deployed without granting a fake native aircraft.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';

const root=path.resolve(import.meta.dirname,'..');
const web=process.argv[2] ? path.resolve(process.argv[2]) : path.join(root,'web');
// Runtime imports must resolve from the deployed archive (not merely in source JS).
assert.ok(fs.existsSync(path.join(web,'vendor/three.module.js')), 'Missing deployed vendor/three.module.js; MiG-23 module cannot initialize');
const tree=fs.readFileSync(path.join(web,'aircraft-tree-data.js'),'utf8');
const preview=fs.readFileSync(path.join(web,'mig23mld.html'),'utf8');
const loader=fs.readFileSync(path.join(web,'mig23mld-glb.js'),'utf8');
const viewer=fs.readFileSync(path.join(web,'mig23mld-viewer.js'),'utf8');
const boot=fs.readFileSync(path.join(web,'mig23mld-boot.js'),'utf8');
assert.match(tree,/family==='mig23'&&suffix==='mld'\?'mig23mld\.html\?v=1'/);
assert.match(tree,/\['mld','MiG-23MLD'/);
assert.match(preview,/Tim Samedov/);
assert.match(preview,/CC BY 4\.0/);
assert.match(preview,/본편에서 이 기종을 출격시킬 수 없습니다/);
assert.match(loader,/source-preserving|MiG-23MLD Blender/);
assert.match(loader,/Math\.min\(72,Number\(degrees\)\|\|72\)\)-72/);
assert.match(viewer,/parseMig23Glb/);
assert.match(viewer,/export async function mountMig23/);
assert.ok(preview.includes('mig23mld-boot.js?v=1'),'Missing non-module bootloader script');
assert.match(boot,/AbortController/);
assert.ok(boot.includes('raw.githubusercontent.com'),'Missing backup model source');
assert.match(boot,/async function download/);
assert.ok(boot.includes("import('./mig23mld-viewer.js"),'Download must defer Three.js module to dynamic import');
for(const f of ['mig23mld-glb.js','mig23mld-viewer.js','mig23mld-boot.js'])
 execFileSync(process.execPath,['--check',path.join(web,f)],{stdio:'inherit'});

const manifest=JSON.parse(fs.readFileSync(path.join(root,'web/manifest.json'),'utf8'));
for(const f of ['mig23mld.html','mig23mld-glb.js','mig23mld-viewer.js','mig23mld-boot.js','aircraft-tree-data.js','aircraft-tree.js']){
 const data=fs.readFileSync(path.join(root,'web',f));
 assert.equal(crypto.createHash('sha256').update(data).digest('hex'),manifest.files[f],'Manifest mismatch: '+f);
}
const binary=path.join(web,'assets/mig23mld/Mig-23.glb');
if(fs.existsSync(binary)){
 const b=fs.readFileSync(binary);
 assert.equal(b.toString('ascii',0,4),'glTF');
 assert.equal(b.readUInt32LE(4),2);
 assert.equal(b.readUInt32LE(8),b.byteLength);
 const len=b.readUInt32LE(12),json=JSON.parse(b.toString('utf8',20,20+len));
 assert.equal(json.asset.version,'2.0');
 assert(json.nodes.some(n=>n.name==='OBJ0257'),'Missing left wing mesh');
 assert(json.nodes.some(n=>n.name==='OBJ0264'),'Missing right wing mesh');
 assert(json.images.length>0&&json.meshes.length>100,'Expected textured detailed source model');
 const sha=crypto.createHash('sha256').update(b).digest('hex');
 console.log(JSON.stringify({result:'PASS',binaryBytes:b.length,sha,meshes:json.meshes.length,images:json.images.length}));
}else{
 console.log('PASS: MiG-23 preview/manifest/static JS verified. Model binary NOT deployed; local file selection required.');
}

// MiG-23 performance branch: original vertex buffers retained after texture repacking.
