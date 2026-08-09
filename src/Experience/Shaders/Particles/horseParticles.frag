varying vec3 vPos;
uniform float uTime;
uniform float uScroll;
void main()
{
//  if ( vPos == vec3(0.0) )
//  {
//    discard;
//  }

  float distanceToCenter = distance(gl_PointCoord, vec2(0.5));
  float strength = 0.05 / distanceToCenter - 0.1;
  float opacity = 0.0;

  // 6页5段: 马在段4亮, 段5灭, 段1/2/3不显示
  if (uScroll < uRange) {
    opacity = 0.0;
  } else if (uScroll < uRange * 2.0) {
    opacity = 0.0;
  } else if (uScroll < uRange * 3.0) {
    opacity = 0.0;
  } else if (uScroll < uRange * 4.0) {
    opacity = mix(0.0, 1.0, (uScroll - uRange * 3.0) * uTotalModels );
  } else {
    // 段5-6: opacity 1.0 -> 0.7 平滑过渡, 段 6 保持 0.7 (作为星空可见度)
    float scroll = (uScroll - uRange * 4.0) * uTotalModels;
    opacity = mix(1.0, 0.0, clamp(scroll, 0.0, 1.0));  // 段 5 末 opacity 归零, 段 6 保持 0
  }

  // 凤凰 熔金色
  gl_FragColor = vec4(1.0, 0.8, 0.2, strength * length(vPos) * opacity);
}
