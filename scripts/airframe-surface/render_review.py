"""EGL/llvmpipe validation of exported game shaders and meshes (not a browser)."""
from pathlib import Path
import json, sys, hashlib, os
import numpy as np
from PIL import Image,ImageDraw
import moderngl

ROOT=Path(__file__).resolve().parents[2]
DATA=ROOT/os.environ.get('REVIEW_DATA','.native-build/fleet-review');OUT=ROOT/os.environ.get('REVIEW_OUTPUT','docs/fleet-surface-review');OUT.mkdir(parents=True,exist_ok=True)
ctx=moderngl.create_standalone_context(backend='egl');ctx.enable(moderngl.DEPTH_TEST)
print(ctx.info['GL_RENDERER'],flush=True)
programs={};textures={};W,H=1440,960
target=ctx.simple_framebuffer((W,H),components=4);target.use()
def program(p):
    key=hashlib.sha256((p['vertex']+p['fragment']).encode()).hexdigest()
    if key not in programs:
        try:programs[key]=ctx.program(vertex_shader=p['vertex'],fragment_shader=p['fragment'])
        except Exception:
            (DATA/'failed.vert').write_text(p['vertex']);(DATA/'failed.frag').write_text(p['fragment']);raise
    return programs[key]
def texture(path):
    if path in textures:return textures[path]
    image=ROOT/'public'/path
    if not image.exists():
        if path.endswith('seat.webp'):image=ROOT/'public/assets/su35/seat.webp'
        if not image.exists():raise FileNotFoundError(image)
    im=Image.open(image).convert('RGBA').transpose(Image.Transpose.FLIP_TOP_BOTTOM)
    t=ctx.texture(im.size,4,im.tobytes());t.build_mipmaps();t.filter=(moderngl.LINEAR_MIPMAP_LINEAR,moderngl.LINEAR);t.repeat_x=t.repeat_y='micro-' in path
    if path.endswith('albedo.webp'):
        # Hardware sRGB decoding is represented explicitly in exported coat maps;
        # procedural colours are already linear.
        a=np.array(im).astype(np.float32)/255;a[...,:3]=np.where(a[...,:3]<=.04045,a[...,:3]/12.92,((a[...,:3]+.055)/1.055)**2.4)
        t.release();t=ctx.texture(im.size,4,np.rint(a*255).astype(np.uint8).tobytes());t.build_mipmaps()
    textures[path]=t;return t
def setu(p,key,value):
    if key not in p:return
    u=p[key]
    if isinstance(value,dict):return
    if isinstance(value,list):
        if len(value) in [9,16]:u.write(np.array(value,dtype='f4').tobytes())
        else:u.value=tuple(value)
    else:u.value=value
def look_at(eye,at,up=(0,1,0)):
    f=(at-eye);f/=np.linalg.norm(f);r=np.cross(f,up);r/=np.linalg.norm(r);u=np.cross(r,f)
    m=np.eye(4,dtype='f4');m[:3,:3]=[r,u,-f];m[:3,3]=-m[:3,:3]@eye;return m
def perspective(fov,aspect,near,far):
    f=1/np.tan(fov/2);m=np.zeros((4,4),dtype='f4');m[0,0]=f/aspect;m[1,1]=f;m[2,2]=(far+near)/(near-far);m[2,3]=2*far*near/(near-far);m[3,2]=-1;return m
summary=[]
for id in map(int,sys.argv[1:] or range(15)):
    meta=json.loads((DATA/f'{id}.json').read_text());raw=(DATA/f'{id}.bin').read_bytes();objects=[]
    if os.environ.get('REVIEW_COMPILE_ONLY'):
        for spec in meta['programs']:program(spec)
        summary.append({'id':id,'materialVariants':len(meta['programs'])})
        print('Compiled',id,flush=True)
        continue
    for mesh in meta['meshes']:
        spec=meta['programs'][mesh['program']];p=program(spec);content=[];buffers=[]
        for name,a in mesh['attributes'].items():
            if name not in p:continue
            b=ctx.buffer(raw[a['offset']:a['offset']+a['bytes']]);buffers.append(b);content.append((b,f"{a['size']}f",name))
        index=mesh.get('index');ib=ctx.buffer(raw[index['offset']:index['offset']+index['bytes']]) if index else None
        vao=ctx.vertex_array(p,content,index_buffer=ib,index_element_size=4)
        objects.append((p,spec,vao,buffers,ib))
    bbox=np.array(meta['bounds']);center=(bbox[0]+bbox[1])/2;size=bbox[1]-bbox[0];scale=max(size[0],size[2]);center[1]=.4
    for angle,direction in [('front',(0,.13,-1)),('rear',(.12,.22,1)),('top',(.08,1,-.001)),('quarter',(.85,.65,-1))]:
        d=np.array(direction,dtype='f4');d/=np.linalg.norm(d);eye=center+d*scale*1.52
        view=look_at(eye,center,(0,0,-1) if angle=='top' else (0,1,0));projection=perspective(np.radians(36),W/H,.1,scale*10)
        target.clear(.12,.145,.175,1,depth=1)
        for p,spec,vao,buffers,ib in sorted(objects,key=lambda o:o[1]['transparent']):
            for name,value in spec['uniforms'].items():setu(p,name,value)
            setu(p,'modelMatrix',np.eye(4).T.ravel().tolist());setu(p,'viewMatrix',view.T.ravel().tolist());setu(p,'modelViewMatrix',view.T.ravel().tolist());setu(p,'projectionMatrix',projection.T.ravel().tolist());setu(p,'normalMatrix',view[:3,:3].T.ravel().tolist());setu(p,'cameraPosition',eye.tolist());setu(p,'isOrthographic',False)
            setu(p,'ambientLightColor',[.7,.75,.85]);setu(p,'receiveShadow',False)
            for i,(light,col) in enumerate([((-.6,1,-.7),(2.7,2.55,2.4)),((1,.4,.7),(.9,1.1,1.4))]):
                vec=view[:3,:3]@np.array(light);vec/=np.linalg.norm(vec)
                setu(p,f'directionalLights[{i}].direction',vec.tolist());setu(p,f'directionalLights[{i}].color',list(col))
            setu(p,'hemisphereLights[0].direction',(view[:3,:3]@np.array([0,1,0])).tolist());setu(p,'hemisphereLights[0].skyColor',[.6,.7,.9]);setu(p,'hemisphereLights[0].groundColor',[.28,.23,.18])
            unit=0
            for name,v in spec['uniforms'].items():
                if isinstance(v,dict) and 'texture' in v and name in p:
                    texture(v['texture']).use(unit);p[name].value=unit;unit+=1
            if spec['transparent']:ctx.enable(moderngl.BLEND);ctx.blend_func=(moderngl.SRC_ALPHA,moderngl.ONE if spec['additive'] else moderngl.ONE_MINUS_SRC_ALPHA)
            else:ctx.disable(moderngl.BLEND)
            if spec['side']==2:ctx.disable(moderngl.CULL_FACE)
            else:ctx.enable(moderngl.CULL_FACE);ctx.cull_face='front' if spec['side']==1 else 'back'
            vao.render()
        image=Image.frombytes('RGBA',(W,H),target.read(components=4)).transpose(Image.Transpose.FLIP_TOP_BOTTOM).convert('RGB')
        draw=ImageDraw.Draw(image);draw.text((24,22),f"{meta['name']} | {angle} | actual game mesh + material hooks | EGL llvmpipe",fill='#cbd7df')
        image.save(OUT/f'{id}-{angle}.jpg',quality=90)
    for p,spec,vao,buffers,ib in objects:
        vao.release()
        for b in buffers:b.release()
        if ib:ib.release()
    summary.append({'id':id,'triangles':meta['triangles'],'meshes':len(meta['meshes']),'views':4})
    print('Rendered',id,meta['name'],flush=True)
(OUT/('compile-results.json' if os.environ.get('REVIEW_COMPILE_ONLY') else 'render-results.json')).write_text(json.dumps({'renderer':ctx.info['GL_RENDERER'],'shaderProgramsCompiled':len(programs),'aircraft':summary,'limitation':'Offscreen OpenGL port of expanded Three shaders; WebGL browser unavailable. Not a browser gameplay test.'},indent=2)+'\n')
