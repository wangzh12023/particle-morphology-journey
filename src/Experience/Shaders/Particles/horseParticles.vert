attribute vec3 aE2Geometry;
uniform sampler2D uPositions;//RenderTarget containing the transformed positions
uniform float uSize;
uniform float uTime;
uniform float uPixelRatio;
varying vec3 vPos;
varying vec2 vUv;

uniform float size;
uniform float scale;
uniform float uScroll;

#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>

#ifdef USE_POINTS_UV

varying vec2 vUv;
uniform mat3 uvTransform;

#endif

mat4 rotationMatrix(vec3 axis, float angle)
{
  axis = normalize(axis);
  float s = sin(angle);
  float c = cos(angle);
  float oc = 1.0 - c;

  return mat4(oc * axis.x * axis.x + c,           oc * axis.x * axis.y - axis.z * s,  oc * axis.z * axis.x + axis.y * s,  0.0,
              oc * axis.x * axis.y + axis.z * s,  oc * axis.y * axis.y + c,           oc * axis.y * axis.z - axis.x * s,  0.0,
              oc * axis.z * axis.x - axis.y * s,  oc * axis.y * axis.z + axis.x * s,  oc * axis.z * axis.z + c,           0.0,
              0.0,                                0.0,                                0.0,                                1.0);
}

void main() {

  #ifdef USE_POINTS_UV

  vUv = ( uvTransform * vec3( uv, 1 ) ).xy;

  #endif

  #include <color_vertex>
  #include <morphcolor_vertex>
  #include <begin_vertex>
  #include <morphtarget_vertex>
  #include <project_vertex>



  #ifdef USE_SIZEATTENUATION

  bool isPerspective = isPerspectiveMatrix( projectionMatrix );

  if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );

  #endif

  vec4 originalPos = projectionMatrix * modelViewMatrix * vec4( aE2Geometry, 1.0 );

  // transformed.y -= 60.3; (baked model already centered)

  vec4 transformedPos = projectionMatrix * modelViewMatrix * vec4( transformed.xyz * 0.015, 1.0 );


  // 6页5段: 马在段4出现, 段5散开, 段1/2/3不显示
  if (uScroll < uRange) {
    gl_Position.w = 0.0;
  } else if (uScroll < uRange * 2.0) {
    gl_Position.w = 0.0;
  } else if (uScroll < uRange * 3.0) {
    gl_Position.w = 0.0;
  } else if (uScroll < uRange * 4.0) {
    gl_PointSize = mix(0.0, uSize, (uScroll - uRange * 3.0) * uTotalModels );
    gl_Position = mix( originalPos, transformedPos, (uScroll - uRange * 3.0) * uTotalModels );
  } else {
    // 段5-6: 凤凰粒子线性散开成星空 (模仿水母段平滑过渡, 段 6 保持散开状态不归零)
    float scroll = (uScroll - uRange * 4.0) * uTotalModels;
    float disperse = clamp(scroll, 0.0, 1.0);  // 段 5 (0~1) 散开, 段 6 (1~) 钳到 1
    gl_PointSize = mix(uSize, 0.0, disperse);  // 段 5 末 size 归零, 段 6 保持 0 (凤凰完全消失)
    vec3 seed = transformed * 12.345;
    vec3 scatter = normalize(vec3(fract(sin(seed.x)*43.0), fract(sin(seed.y)*78.0), fract(sin(seed.z)*19.0)) - 0.5);
    float distance = disperse * 1.5;  // 线性散开 (原来是 scroll^2 爆裂)
    gl_Position = transformedPos + vec4(scatter * distance, 0.0);
  }

  #include <logdepthbuf_vertex>
  #include <clipping_planes_vertex>
  #include <worldpos_vertex>
  #include <fog_vertex>

  vPos = mvPosition.xyz;
  //vPos = transformed;
}
