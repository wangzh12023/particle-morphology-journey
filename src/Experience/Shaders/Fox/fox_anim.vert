uniform float uTime;
uniform float uRun;   // 0=idle, 1=running
varying vec3 vNormal;
varying vec2 vUv;

void main() {
    vUv = uv;
    vNormal = normal;

    vec3 pos = position;

    // fox body lies along Z (head +Z, tail -Z), X = left/right, Y = up/down
    // legs are at the bottom (low Y), tail at the back (low Z)

    // --- legs: swing forward/back while running ---
    float legMask = smoothstep(-0.15, -0.22, pos.y);   // 1 at feet, 0 at body
    float legPhase = pos.z * 6.0 + uTime * 8.0;
    float legSwing = sin(legPhase) * 0.06 * uRun * legMask;
    pos.z += legSwing;

    // slight body bob while running
    pos.y += abs(sin(uTime * 8.0)) * 0.015 * uRun;

    // --- tail: sway side to side, more at the tip (far -Z) ---
    float tailMask = smoothstep(-0.1, -0.4, pos.z);    // 1 at tail tip, 0 at body
    float tailSway = sin(uTime * 3.0 + pos.z * 4.0) * 0.08 * tailMask;
    pos.x += tailSway;
    // tail also lifts a little
    pos.y += abs(sin(uTime * 3.0 + pos.z * 4.0)) * 0.03 * tailMask;

    // --- ears/head subtle bob ---
    float headMask = smoothstep(0.25, 0.45, pos.z);
    pos.y += sin(uTime * 4.0) * 0.01 * headMask;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}