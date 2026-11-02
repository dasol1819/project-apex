// SPDX-License-Identifier: GPL-2.0-only
// One packed atlas fetch supplies normal XY, roughness and cavity/AO.
// A 256² shared tile supplies sub-millimetre detail and fades under minification.
export function addPackedAirframeSurface(
  shader,
  textures = {},
  { position, neutralNormal, metalMask = "0." } = {},
) {
  const packed = !!textures.surface,
    micro = !!textures.micro;
  shader.uniforms.afMicroMap = { value: textures.micro ?? null };
  shader.fragmentShader =
    "uniform sampler2D afMicroMap;\n" + shader.fragmentShader;
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <map_fragment>",
    `#include <map_fragment>
    vec4 afSurface=${packed ? "texture2D(normalMap,vNormalMapUv)" : "vec4(.5,.5,.68,1.)"};
    vec3 afNeutral=normalize(${neutralNormal}),afAbs=abs(afNeutral);
    vec2 afMicroUv=afAbs.y>=max(afAbs.x,afAbs.z)?${position}.xz:(afAbs.x>=afAbs.z?${position}.zy:${position}.xy);
    afMicroUv/=.14;
    float afFoot=max(length(dFdx(${position})),length(dFdy(${position})));
    float afDetailFade=1.-smoothstep(.008,.028,afFoot);
    vec4 afMicro=${micro ? "texture2D(afMicroMap,afMicroUv)" : "vec4(.5,.5,.68,1.)"};
  `,
  );
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <roughnessmap_fragment>",
    `#include <roughnessmap_fragment>
    roughnessFactor=clamp(mix(afSurface.b-.10,.45,${metalMask})+(afMicro.b-.69)*.16*afDetailFade,.36,.90);
  `,
  );
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <metalnessmap_fragment>",
    `#include <metalnessmap_fragment>
    metalnessFactor=mix(.055,.76,${metalMask});
  `,
  );
  if (packed)
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <normal_fragment_maps>",
      `
    vec2 afXY=(afSurface.rg*2.-1.)*normalScale;
    normal=normalize(tbn*vec3(afXY,sqrt(max(.001,1.-dot(afXY,afXY)))));
    ${
      micro
        ? `mat3 afFrame=getTangentFrame(-vViewPosition,normal,afMicroUv);
      vec2 afGrain=(afMicro.rg*2.-1.)*.5*afDetailFade;
      normal=normalize(afFrame*vec3(afGrain,sqrt(max(.001,1.-dot(afGrain,afGrain)))));`
        : ""
    }
    // Normal variance widens the highlight instead of shimmering at distance.
    vec3 afNX=dFdx(normal),afNY=dFdy(normal);
    roughnessFactor=sqrt(min(.9,roughnessFactor*roughnessFactor+min(.08,(dot(afNX,afNX)+dot(afNY,afNY))*.35)));
  `,
    );
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <aomap_fragment>",
    `#include <aomap_fragment>
    float afAO=mix(1.,afSurface.a,.65);
    reflectedLight.indirectDiffuse*=afAO;
    reflectedLight.indirectSpecular*=mix(afAO,1.,roughnessFactor);
  `,
  );
}
