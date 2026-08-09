varying vec3 vColor;

void main() {
    // 柔和圆形星点(像光晕, 不要硬边)
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    float alpha = smoothstep(0.5, 0.0, d);
    if (alpha < 0.05) discard;
    gl_FragColor = vec4(vColor, alpha);
}