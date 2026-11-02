// SPDX-License-Identifier: GPL-2.0-only
// One packed atlas fetch supplies normal XY, roughness and cavity/AO.
// A 256² shared tile supplies sub-millimetre detail and fades under minification.
export function addSu35Surface(shader, textures = {}) {
  const packed = !!textures.surface,
    micro = !!textures.micro;
  shader.uniforms.su35Micro = { value: textures.micro ?? null };
  shader.fragmentShader =
    "uniform sampler2D su35Micro;\n" + shader.fragmentShader;
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <map_fragment>",
    `#include <map_fragment>
    vec4 suSurface=${packed ? "texture2D(normalMap,vNormalMapUv)" : "vec4(.5,.5,.68,1.)"};
    vec3 suNeutral=normalize(vSu35NeutralNormal),suAbs=abs(suNeutral);
    vec2 suMicroUv=suAbs.y>=max(suAbs.x,suAbs.z)?vSu35Local.xz:(suAbs.x>=suAbs.z?vSu35Local.zy:vSu35Local.xy);
    suMicroUv/=.14;
    float suFoot=max(length(dFdx(vSu35Local)),length(dFdy(vSu35Local)));
    float suDetailFade=1.-smoothstep(.008,.028,suFoot);
    vec4 suMicro=${micro ? "texture2D(su35Micro,suMicroUv)" : "vec4(.5,.5,.68,1.)"};
  `,
  );
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <roughnessmap_fragment>",
    `#include <roughnessmap_fragment>
    roughnessFactor=clamp(mix(suSurface.b-.10,.45,metal)+(suMicro.b-.69)*.16*suDetailFade,.36,.90);
  `,
  );
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <metalnessmap_fragment>",
    `#include <metalnessmap_fragment>
    metalnessFactor=mix(.055,.76,metal);
  `,
  );
  if (packed)
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <normal_fragment_maps>",
      `
    vec2 suXY=(suSurface.rg*2.-1.)*normalScale;
    normal=normalize(tbn*vec3(suXY,sqrt(max(.001,1.-dot(suXY,suXY)))));
    ${
      micro
        ? `mat3 suFrame=getTangentFrame(-vViewPosition,normal,suMicroUv);
      vec2 suGrain=(suMicro.rg*2.-1.)*.5*suDetailFade;
      normal=normalize(suFrame*vec3(suGrain,sqrt(max(.001,1.-dot(suGrain,suGrain)))));`
        : ""
    }
    // Normal variance widens the highlight instead of shimmering at distance.
    vec3 suNX=dFdx(normal),suNY=dFdy(normal);
    roughnessFactor=sqrt(min(.9,roughnessFactor*roughnessFactor+min(.08,(dot(suNX,suNX)+dot(suNY,suNY))*.35)));
  `,
    );
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <aomap_fragment>",
    `#include <aomap_fragment>
    float suAO=mix(1.,suSurface.a,.65);
    reflectedLight.indirectDiffuse*=suAO;
    reflectedLight.indirectSpecular*=mix(suAO,1.,roughnessFactor);
  `,
  );
}
