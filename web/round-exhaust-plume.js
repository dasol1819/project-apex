// A round, tapered plume has no crossed billboard sheets or star-shaped end view.
import * as T from './vendor/three.module.js';
export function roundExhaustPlume(radius,length=radius*8){
  const root=new T.Group();root.name='round tapered afterburner volume';root.userData.visualEffect=true;
  const material=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.BackSide,blending:T.AdditiveBlending,
    uniforms:{time:{value:0},power:{value:0}},vertexShader:`varying vec2 plumeUV;varying vec3 plumeView;varying vec3 plumeNormal;
      void main(){plumeUV=uv;vec4 p=modelViewMatrix*vec4(position,1.);plumeView=-p.xyz;plumeNormal=normalMatrix*normal;gl_Position=projectionMatrix*p;}`,
    fragmentShader:`varying vec2 plumeUV;varying vec3 plumeView,plumeNormal;uniform float time,power;
      void main(){float z=plumeUV.y;
        float volume=pow(clamp(abs(dot(normalize(plumeNormal),normalize(plumeView))),0.,1.),.55);
        float fade=smoothstep(0.,.018,z)*(1.-smoothstep(.30,1.,z));
        float cell=pow(.5+.5*cos(z*43.-time*.65),5.);
        float turbulence=.94+.06*sin(plumeUV.x*19.+z*39.-time*7.);
        float alpha=power*fade*volume*(.12+.20*cell)*turbulence;
        if(alpha<.002)discard;
        vec3 colour=mix(vec3(.30,.40,1.),vec3(1.,.40,.13),smoothstep(.06,.82,z));
        gl_FragColor=vec4(colour,alpha);}`});
  const positions=[],uv=[],indices=[],rings=40,sides=40;
  for(let i=0;i<=rings;i++){
    const z=i/rings,r=radius*(.85+.16*Math.sin(z*4.2))*(1.-.80*Math.pow(z,1.3));
    for(let j=0;j<=sides;j++){const a=j/sides*Math.PI*2;positions.push(Math.cos(a)*r,Math.sin(a)*r,z*length);uv.push(j/sides,z);}
  }
  for(let i=0;i<rings;i++)for(let j=0;j<sides;j++){const a=i*(sides+1)+j,b=a+sides+1;indices.push(a,a+1,b,a+1,b+1,b);}
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();
  const mesh=new T.Mesh(geometry,material);mesh.name='continuous round exhaust envelope';mesh.userData.visualEffect=true;root.add(mesh);
  return {root,material};
}
