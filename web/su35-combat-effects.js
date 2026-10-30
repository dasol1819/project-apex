import * as T from './vendor/three.module.js';
import {enableWorldDepthIn} from './world-depth.js';

// Plumes inherit the physical nozzle frames, including independent vectoring.
export function createSu35Plumes(frames){
  return frames.map(frame=>{
    const root=new T.Group();root.name='AL-41F1S afterburner plume';root.userData.visualEffect=true;frame.add(root);
    const material=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,
      uniforms:{time:{value:0},power:{value:0}},vertexShader:'varying vec2 plumeUV;void main(){plumeUV=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:`varying vec2 plumeUV;uniform float time,power;
        void main(){float z=plumeUV.y,r=abs(plumeUV.x*2.-1.);float envelope=(1.-smoothstep(.22,1.,z))*pow(max(0.,1.-r),2.2);
        float diamond=pow(.5+.5*cos(z*44.-time*.9),5.);float core=exp(-r*r*22.)*(1.-smoothstep(.05,.65,z));
        float alpha=(envelope*(.24+.46*diamond)+core*.3)*power;if(alpha<.003)discard;
        vec3 colour=mix(vec3(.20,.35,1.),vec3(.95,.44,.19),smoothstep(.04,.78,z));colour=mix(colour,vec3(.66,.76,1.),core);
        gl_FragColor=vec4(colour,alpha*.65);}`});
    for(let i=0;i<3;i++){const geometry=new T.PlaneGeometry(1.03,4.2,1,24);geometry.rotateX(Math.PI/2);geometry.translate(0,0,2.1);const mesh=new T.Mesh(geometry,material);mesh.rotation.z=i*Math.PI/3;mesh.userData.visualEffect=true;root.add(mesh);}
    enableWorldDepthIn(root);root.visible=false;return{root,material};
  });
}
