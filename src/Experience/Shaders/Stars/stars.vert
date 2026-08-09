attribute float aSize;
attribute vec3 aColor;

varying vec3 vColor;

void main() {
    vColor = aColor;

    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPos;

    // 星空 size 用绝对像素(不按距离缩放), 让远近星点大小一致
    // 透视缩放: 远小近大, 3D 深度感关键 (类似 horseParticles.vert 的做法)
    gl_PointSize = aSize * (300.0 / -mvPos.z);
}