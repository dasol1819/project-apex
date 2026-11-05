// Export actual game geometry and its actual material shader hooks for EGL QA.
// This does not replace a browser/gameplay review.
import fs from 'node:fs';import path from 'node:path';import {pathToFileURL} from 'node:url';
const root=path.resolve(process.argv[2]||'public'),out=path.resolve(process.argv[3]||'.native-build/fleet-review');fs.mkdirSync(out,{recursive:true});
const load=n=>import(pathToFileURL(path.join(root,n)));
const T=await load('vendor/three.module.js'),{createAircraft}=await load('aircraft.js'),{decodeSu35Asset}=await load('su35-asset.js'),{attachSurfaceUv}=await load('airframe-surface-uv.js');
const chunks=T.ShaderChunk;
function expand(s){return s.replace(/#include <([\w\d_]+)>/g,(_,name)=>{if(!(name in chunks))throw Error('Unknown chunk '+name);return expand(chunks[name]);});}
function texture(name){const t=new T.Texture();t.name=name;return t;}
function asset(name){
 const metadata=JSON.parse(fs.readFileSync(path.join(root,`assets/${name}/airframe.json`))),b=fs.readFileSync(path.join(root,`assets/${name}/airframe.bin`));
 let meshes=decodeSu35Asset(metadata,b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));
 if(name==='mig29'){const meta=JSON.parse(fs.readFileSync(path.join(root,'assets/mig29/surface-uv.json'))),uv=fs.readFileSync(path.join(root,'assets/mig29/surface-uv.bin'));meshes=attachSurfaceUv(T,meshes,meta,uv.buffer.slice(uv.byteOffset,uv.byteOffset+uv.byteLength));}
 const textures=Object.fromEntries(['albedo','surface','micro','seat'].map(k=>[k,texture(`assets/${name}/${k==='surface'?'surface-fallback.webp':k==='micro'?'micro-surface.webp':k+'.webp'}`)]));
 if(name==='mig29')textures.surface.channel=1;
 return {metadata,meshes,textures};
}
const countDefines={'NUM_DIR_LIGHTS':2,'NUM_POINT_LIGHTS':0,'NUM_SPOT_LIGHTS':0,'NUM_SPOT_LIGHT_MAPS':0,'NUM_SPOT_LIGHT_COORDS':0,'NUM_RECT_AREA_LIGHTS':0,'NUM_HEMI_LIGHTS':1,'NUM_DIR_LIGHT_SHADOWS':0,'NUM_POINT_LIGHT_SHADOWS':0,'NUM_SPOT_LIGHT_SHADOWS':0,'NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS':0,'NUM_CLIPPING_PLANES':0,'UNION_CLIPPING_PLANES':0};
function shader(material,id){
 const lib=material.isShaderMaterial?null:material.isMeshBasicMaterial?T.ShaderLib.basic:material.isMeshPhysicalMaterial?T.ShaderLib.physical:T.ShaderLib.standard;
 const sh={vertexShader:lib?lib.vertexShader:material.vertexShader,fragmentShader:lib?lib.fragmentShader:material.fragmentShader,uniforms:lib?T.UniformsUtils.clone(lib.uniforms):{...material.uniforms}};
 if(lib){sh.uniforms.diffuse={value:material.color};sh.uniforms.roughness={value:material.roughness};sh.uniforms.metalness={value:material.metalness};sh.uniforms.opacity={value:material.opacity};sh.uniforms.emissive={value:material.emissive};sh.uniforms.map={value:material.map};sh.uniforms.normalMap={value:material.normalMap};sh.uniforms.normalScale={value:material.normalScale};material.onBeforeCompile(sh);}
 if(material.isMeshPhysicalMaterial)for(const key of ['clearcoat','clearcoatRoughness','ior','specularIntensity','specularColor'])if(sh.uniforms[key])sh.uniforms[key]={value:material[key]};
 let defines=Object.entries(countDefines).map(([k,v])=>`#define ${k} ${v}`).join('\n')+'\n';
 if(material.isMeshPhysicalMaterial){defines+='#define PHYSICAL\n';if(material.clearcoat>0)defines+='#define USE_CLEARCOAT\n';}
 if(material.vertexColors)defines+='#define USE_COLOR\n';
 if(material.side===T.DoubleSide)defines+='#define DOUBLE_SIDED\n';
 if(material.side===T.BackSide)defines+='#define FLIP_SIDED\n';
 if(material.map)defines+='#define USE_MAP\n#define MAP_UV uv\n';
 if(material.normalMap)defines+='#define USE_NORMALMAP\n#define USE_NORMALMAP_TANGENTSPACE\n#define NORMALMAP_UV '+(material.normalMap.channel===1?'uv1':'uv')+'\n';
 const uniforms={};for(const [k,{value:v}]of Object.entries(sh.uniforms)){
   if(v?.isTexture)uniforms[k]={texture:v.name||`assets/fleet-surface/${id}/surface-fallback.webp`};
   else if(v?.isColor)uniforms[k]=v.toArray();else if(v?.toArray)uniforms[k]=v.toArray();else if(typeof v==='number'||typeof v==='boolean')uniforms[k]=v;
 }
 if(material.userData.fleetSurface)uniforms.fleetSurfaceMap={texture:`assets/fleet-surface/${id}/surface-fallback.webp`};
 const precision='';
 const vertex='#version 330\n#define attribute in\n#define varying out\n#define texture2D texture\n'+defines+precision+'uniform mat4 modelMatrix,modelViewMatrix,projectionMatrix,viewMatrix;uniform mat3 normalMatrix;uniform vec3 cameraPosition;uniform bool isOrthographic;\nin vec3 position,normal;in vec2 uv,uv1;\n'+(material.vertexColors?'in vec3 color;\n':'')+expand(sh.vertexShader);
 const fragment='#version 330\n#define varying in\n#define texture2D texture\n#define textureCube texture\n#define gl_FragColor fragColor\n#define gl_FragDepthEXT gl_FragDepth\nout vec4 fragColor;\n'+defines+'uniform mat4 viewMatrix;uniform vec3 cameraPosition;uniform bool isOrthographic;\nvec4 linearToOutputTexel(vec4 c){vec3 x=max(c.rgb,vec3(0.));x=clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);return vec4(pow(x,vec3(1./2.2)),c.a);}\n'+expand(sh.fragmentShader);
 return {vertex,fragment,uniforms,side:material.side,transparent:material.transparent,opacity:material.opacity,additive:material.blending===T.AdditiveBlending};
}
for(const id of (process.argv[4]?process.argv[4].split(',').map(Number):Array.from({length:15},(_,i)=>i))){
 const options=id===13?{asset:asset('su35')}:id===14?{asset:asset('mig29')}:{};
 const state={gear:0,engine:process.env.REVIEW_EFFECTS?1.2:.85,afterburner:process.env.REVIEW_EFFECTS?1:0,time:1,...JSON.parse(process.env.REVIEW_STATE||'{}')};
 const model=createAircraft(id,options);model.update(state);model.group.updateMatrixWorld(true);
 const meshes=[],programs=[],programKeys=new Map(),buffers=[],bounds=new T.Box3();let offset=0,triangles=0;
 const v=new T.Vector3(),norm=new T.Vector3();
 model.group.traverse(node=>{
  if(!node.isMesh)return;for(let p=node;p;p=p.parent)if(!p.visible||(!process.env.REVIEW_EFFECTS&&p.userData.visualEffect))return;
  if(Array.isArray(node.material))return;
  const m=node.material;if(!m.isMeshStandardMaterial&&!m.isShaderMaterial&&!m.isMeshBasicMaterial)return;
  const key=m.customProgramCacheKey()+':'+m.color?.getHex()+':'+m.roughness+':'+m.metalness+':'+JSON.stringify(m.userData)+':'+m.map?.name;
  let program=programKeys.get(key);if(program===undefined){program=programs.length;programKeys.set(key,program);programs.push(shader(m,id));}
  const g=node.geometry,attributes={},normalMatrix=new T.Matrix3().getNormalMatrix(node.matrixWorld);
  for(const [name,attr]of Object.entries(g.attributes)){
   const values=new Float32Array(attr.array);
   if(name==='position')for(let i=0;i<attr.count;i++){node.getVertexPosition(i,v).applyMatrix4(node.matrixWorld).toArray(values,i*3);bounds.expandByPoint(v);}
   if(name==='normal')for(let i=0;i<attr.count;i++)norm.fromBufferAttribute(attr,i).applyMatrix3(normalMatrix).normalize().toArray(values,i*3);
   const b=Buffer.from(values.buffer);attributes[name]={offset,bytes:b.length,size:attr.itemSize,count:attr.count};buffers.push(b);offset+=b.length;
  }
  let index;if(g.index){const b=Buffer.from(new Uint32Array(g.index.array).buffer);index={offset,bytes:b.length,count:g.index.count};buffers.push(b);offset+=b.length;}
  triangles+=(g.index?.count||g.attributes.position.count)/3;meshes.push({name:node.name,program,attributes,index});
 });
 fs.writeFileSync(path.join(out,id+'.bin'),Buffer.concat(buffers));fs.writeFileSync(path.join(out,id+'.json'),JSON.stringify({id,name:model.definition?.name||'F-22A',state,bounds:[bounds.min.toArray(),bounds.max.toArray()],triangles,programs,meshes}));
 console.log(id,meshes.length,programs.length,triangles);
}
