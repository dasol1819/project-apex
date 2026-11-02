// Exercise the exact vendored worker transcoder without requiring a browser/GPU.
import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import zlib from 'node:zlib';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const root=path.resolve(process.argv[2]||'public'),filename=path.join(root,'vendor/basis/basis_transcoder.js');
const context={module:{exports:{}},exports:{},require:createRequire(import.meta.url),__dirname:path.dirname(filename),__filename:filename,process,console,WebAssembly,TextDecoder,TextEncoder,Uint8Array,Int8Array,Uint16Array,Int16Array,Uint32Array,Int32Array,Float32Array,Float64Array,ArrayBuffer,setTimeout,clearTimeout,performance};
vm.runInNewContext(fs.readFileSync(filename,'utf8'),context);
const basis=await context.module.exports({wasmBinary:fs.readFileSync(path.join(root,'vendor/basis/basis_transcoder.wasm'))});basis.initializeBasis();
let slices=0;
for(let id=0;id<13;id++){
 const bytes=zlib.gunzipSync(fs.readFileSync(path.join(root,`assets/fleet-surface/${id}/surface.ktx2.gz`))),f=new basis.KTX2File(new Uint8Array(bytes));
 try{
  assert.ok(f.isValid()&&f.isUASTC()&&f.getHasAlpha(),'valid four-channel UASTC data');assert.equal(f.getWidth(),4096);assert.equal(f.getHeight(),4096);assert.equal(f.getFaces(),1);assert.equal(f.getLevels(),13);assert.ok(f.startTranscoding());
  for(const [name,format]of [['astc',10],['bc7',7],['etc2',1],['bc3',3]]){
   let gpuBytes=0;
   for(let level=0;level<f.getLevels();level++){
    const n=f.getImageTranscodedSizeInBytes(level,0,0,format),pixels=new Uint8Array(n);assert.ok(f.transcodeImage(pixels,level,0,0,format,0,-1,-1),`${id}/${name}/${level}`);gpuBytes+=n;slices++;
   }
   assert.equal(gpuBytes,22369648,'4K atlas plus all mips has a bounded GPU cost');
  }
 }finally{f.close();f.delete();}
}
console.log(JSON.stringify({result:'PASS',atlases:13,backends:['ASTC','BC7','ETC2 RGBA','BC3'],mipSlices:slices,gpuBytesPerAtlas:22369648,actualGpuUpload:false}));
