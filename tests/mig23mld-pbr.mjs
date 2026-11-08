// Regression checks for the source-preserving MiG-23MLD glTF PBR importer.
// Structural validation does not substitute for actual browser WebGL/photo inspection.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root=path.resolve(import.meta.dirname,'..');
const web=process.argv[2]?path.resolve(process.argv[2]):path.join(root,'web');
const importer=fs.readFileSync(path.join(web,'mig23mld-glb.js'),'utf8');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'web/manifest.json'),'utf8'));
assert.equal(
 crypto.createHash('sha256').update(importer).digest('hex'),
 manifest.files['mig23mld-glb.js'],
 'GLB importer must match deploy manifest'
);
for(const [name,pattern] of [
 ['sRGB base color',/map:texture\(p\.baseColorTexture,true\)/],
 ['linear metal roughness',/const orm=texture\(p\.metallicRoughnessTexture\)/],
 ['metal channel',/metalnessMap:orm/],
 ['rough channel',/roughnessMap:orm/],
 ['linear normals',/normalMap:texture\(m\.normalTexture\)/],
 ['normal strength',/normalScale:new T\.Vector2/],
 ['occlusion channel',/aoMap:texture\(m\.occlusionTexture\)/],
 ['occlusion strength',/aoMapIntensity:/],
 ['secondary AO UV mapping',/g\.setAttribute\('uv2',g\.getAttribute\('uv'\)\)/],
 ['emission color',/emissiveMap:texture\(m\.emissiveTexture,true\)/],
 ['linear data spaces',/T\.NoColorSpace/],
 ['color spaces keyed separately',/id\+':'\+\(color\?'srgb':'linear'\)/],
 ['unsupported UV index reported',/TEXCOORD_1 UV/]
]) assert.match(importer,pattern,name);
const bin=path.join(web,'assets/mig23mld/Mig-23.glb');
if(fs.existsSync(bin)){
 const b=fs.readFileSync(bin);
 assert.equal(b.toString('ascii',0,4),'glTF');
 assert.equal(b.readUInt32LE(4),2);
 assert.equal(b.readUInt32LE(8),b.length);
 const jsonBytes=b.readUInt32LE(12);
 const j=JSON.parse(b.toString('utf8',20,20+jsonBytes));
 assert.equal(j.asset.version,'2.0');
 assert.ok(j.meshes.length>=100&&j.images.length>=20);
 const bad=(j.materials??[]).flatMap((m,i)=>{
  const refs=[m.pbrMetallicRoughness?.baseColorTexture,m.pbrMetallicRoughness?.metallicRoughnessTexture,m.normalTexture,m.occlusionTexture,m.emissiveTexture];
  return refs.some(t=>t&&(!Number.isInteger(t.index)||t.index>=j.textures.length))?[i]:[];
 });
 assert.deepEqual(bad,[],'all PBR texture references must resolve');
 const primitiveCount=j.meshes.reduce((n,m)=>n+m.primitives.length,0);
 assert.ok(primitiveCount>=200);
 for(const name of ['OBJ0257','OBJ0264']) assert.ok(j.nodes.some(n=>n.name===name),'missing variable-sweep wing '+name);
 console.log(JSON.stringify({result:'PASS',sourceBytes:b.length,meshes:j.meshes.length,primitives:primitiveCount,materials:j.materials.length,textures:j.textures.length,sha256:crypto.createHash('sha256').update(b).digest('hex')}));
}else{
 console.log('PASS PBR contract; source binary not present in selected web directory');
}
