uniform sampler2D uPositions;//RenderTarget containing the transformed positions
uniform float uSize;
uniform float uPixelRatio;
uniform vec2 uResolution;
uniform float uScroll;
varying vec3 vPos;
varying vec2 vUv;
void main() {

  //the mesh is a nomrliazed square so the uvs = the xy positions of the vertices
  vec3 pos = texture2D( uPositions, position.xy ).xyz;
  //pos now contains a 3D position in space, we can use it as a regular vertex

  float range = 1.0 / uTotalModels;
  float customSize = uSize;

  vec4 modelPosition = modelMatrix * vec4(pos, 1.0);
  vec4 viewPosition = viewMatrix * modelPosition;
  vec4 projectionPosition = projectionMatrix * viewPosition;


  // 6页5段: 新段1=粒子狐狸固定大小, 后面4段顺移
  if (uScroll < range) {
    customSize = 7.0;
  } else if (uScroll < range * 2.0) {
    customSize = mix(7.0, 10., (uScroll - range) * uTotalModels);
  } else if (uScroll < range * 3.0) {
    customSize = mix(10., 5., (uScroll - range * 2.0) * uTotalModels);
  } else if (uScroll < range * 4.0) {
    customSize = mix(5., 20., (uScroll - range * 3.0) * uTotalModels);
  } else {
    float scroll = max((uScroll - range * 4.0), (uScroll - range * 4.0) * uTotalModels);
    customSize = mix(20., 20., scroll);
  }

  gl_Position = projectionPosition;
  gl_PointSize = customSize * uResolution.y * 0.0013;
  gl_PointSize *= (1.0 / - viewPosition.z);

  vPos = pos;
}
