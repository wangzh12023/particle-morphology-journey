uniform float uTime;
uniform float uOpacity;
uniform vec3 uColor;     // base cyan
uniform vec3 uCoreColor; // light cyan
uniform vec3 uHitPoint;
uniform vec3 uHitDir;
uniform float uHitActive;
uniform float uBrushR;
uniform float uDissolve;  // 狐狸溶解进度(0=完整 1=全溶), 花仙子不传=0
varying vec3 vNormal;
varying vec3 vViewPos;
varying vec3 vWorldPos;
varying vec2 vUv;

void main() {
    vec3 viewDir = normalize(-vViewPos);
    float ndv = max(dot(normalize(vNormal), viewDir), 0.0);

    float fresnel = pow(1.0 - ndv, 2.5) * 0.35;
    float pulse = 0.5 + 0.5 * sin(uTime * 1.0);
    float h = vWorldPos.y * 1.2 - uTime * 0.6;
    float band = abs(fract(h) - 0.5);
    float scan = smoothstep(0.45, 0.0, band) * 0.15;

    vec3 col = mix(uColor * 0.2, uColor * 0.45, ndv);
    col += uCoreColor * fresnel * (0.4 + pulse * 0.15);
    col += uCoreColor * scan;
    col *= 0.7 + pulse * 0.1;

    // distance from this fragment to the mouse RAY (through-and-through hole)
    vec3 toFrag = vWorldPos - uHitPoint;
    float along = dot(toFrag, uHitDir);
    float d = length(toFrag - along * uHitDir);
    // brush reveals holo where the mouse is; elsewhere the solid shows through
    float brush = uHitActive * (1.0 - smoothstep(uBrushR * 0.6, uBrushR, d));

    float alpha = mix(0.2, 0.6, fresnel) + scan * 0.08;
    alpha = clamp(alpha, 0.0, 1.0) * uOpacity * mix(1.0, brush, uHitActive);
    // 按高度溶解(和实体同步): 溶解线以上消失, 边缘带0.12一致
    float hFox = clamp((vWorldPos.y + 1.8) / 3.6, 0.0, 1.0);
    float hLine = 1.0 - uDissolve;
    alpha *= 1.0 - smoothstep(hLine - 0.12, hLine, hFox);

    gl_FragColor = vec4(col, alpha);
}
