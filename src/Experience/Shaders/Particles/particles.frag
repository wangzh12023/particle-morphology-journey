varying vec3 vPos;
uniform float uTime;
uniform float uScroll;
float random(vec3 st){ return fract(sin(dot(st, vec3(12.9898,78.233,37.719)))*43758.5453); }
void main()
{
  if ( length(vPos) < 0.01 ) discard;
  float distanceToCenter = distance(gl_PointCoord, vec2(0.5));
  float strength = 0.05 / distanceToCenter - 0.1;

  vec3 color = vec3(1.0, 0.5, 0.0);

  // 6页5段: 新段1=粒子狐狸橙色, 段2/3/4顺移, 段5青蓝过渡
  // 新段1: 淡金白狐狸, 溶解时金白→青白渐变(接青色全息壳), 完整体=金白
  if (uScroll < uRange) {
    float diss = uScroll * uTotalModels;
    vec3 goldWhite = vec3(1.0, 0.92, 0.7);
    vec3 cyanWhite = vec3(0.7, 0.95, 1.0);
    color = mix(goldWhite, cyanWhite, diss);
  } else if (uScroll < uRange * 2.0) {
    vec3 bloodRed = vec3(1.0, 0.2, 0.05);  // 死亡骑士 橙红
    color = mix(vec3(1.0, 0.92, 0.7), bloodRed, (uScroll - uRange) * uTotalModels );
  } else if (uScroll < uRange * 3.0) {
    vec3 jellyPurple = vec3(0.6, 0.2, 1.0);  // 水母幽紫
    color = mix(vec3(1.0, 0.2, 0.05), jellyPurple, (uScroll - uRange * 2.0) * uTotalModels );
  } else if (uScroll < uRange * 4.0) {
    vec3 fireGold = vec3(1.0, 0.8, 0.2);  // 凤凰 熔金
    color = mix(vec3(0.6, 0.2, 1.0), fireGold, (uScroll - uRange * 3.0) * uTotalModels );
  } else {
    // 段5: 花仙子 熔金→青蓝平滑过渡
    vec3 fireGold = vec3(1.0, 0.8, 0.2);
    vec3 cyanBlue = vec3(0.0, 0.7, 1.0);
    float t5 = (uScroll - uRange * 4.0) * uTotalModels;
    color = mix(fireGold, cyanBlue, t5);
  }

  // set FireFilies orange Color
  float alpha = strength * length(vPos);
  // 新段1: 粒子按高度跟实体溶解线同步显隐, 提亮接近完全成粒子的亮度
  if (uScroll < uRange) {
    float diss = uScroll * uTotalModels;          // 0~1 溶解进度(同实体uDissolve)
    float dLine = 1.0 - diss;                       // 溶解线(从1.0顶降到0.0底)
    float foxH = clamp((vPos.y + 1.8) / 3.6, 0.0, 1.0);  // 粒子归一化高度(和实体一致)
    float vis = smoothstep(dLine - 0.12, dLine, foxH);  // 窄过渡当开关: 线上显粒子, 线下是实体
    alpha *= vis;                                        // 不加倍数, 显示即原亮度=完全成粒子亮度
  }
  // 段5: 花仙子聚形压暗alpha
  if (uScroll >= uRange * 4.0) {
    float t5 = (uScroll - uRange * 4.0) * uTotalModels;
    alpha *= mix(1.0, 1.0, smoothstep(0.45, 1.0, t5));
  }
  gl_FragColor = vec4(color, alpha);
}