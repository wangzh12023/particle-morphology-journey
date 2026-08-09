import * as THREE from 'three'
import Experience from '../Experience.js'
import cubeVertexShader from '../Shaders/Cube/vertex.glsl'
import cubeFragmentShader from '../Shaders/Cube/fragment.glsl'
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";
import gsap from "gsap";

import { BufferGeometry, MathUtils } from "three";
import { uniform, skinning, PointsNodeMaterial } from 'three/nodes';

import simVertex from '../Shaders/Particles/simulation.vert';
import simFragment from '../Shaders/Particles/simulation.frag';
import particlesVertex from '../Shaders/Particles/particles.vert';
import particlesFragment from '../Shaders/Particles/particles.frag';

import horseParticlesVertex from '../Shaders/Particles/horseParticles.vert';
import horseParticlesFragment from '../Shaders/Particles/horseParticles.frag';

import FBO from "../Utils/FBO.js";
import holoVertex from '../Shaders/Fox/holo.vert';
import holoFragment from '../Shaders/Fox/holo.frag';
import foxAnimVertex from '../Shaders/Fox/fox_anim.vert';

// 第 6 页粒子花仙子偏移 (实体右侧, 背对实体): 0 单位 (老大说继续挪到底, 1.5 → 0.8 → 0, 粒子和实体重叠在 fairyGroup 原点)
const FAIRY_PARTICLE_OFFSET_X = 0;

export default class Page {
    constructor() {
        this.experience = new Experience()
        this.debug = this.experience.debug
        this.scene = this.experience.scene
        this.time = this.experience.time
        this.camera = this.experience.camera.instance
        this.renderer = this.experience.renderer.instance
        this.resources = this.experience.resources
        this.sizes = this.experience.sizes
        this.timeline = this.experience.timeline;
        this.isMobile = this.experience.isMobile
        this.cursor = this.experience.cursor

        this.sectionCount = document.querySelectorAll('.section').length - 1
        this.range = 1.0 / parseFloat(this.sectionCount)
        this.objectDistance = 100000;
        this.scrollY = window.scrollY
        this.normalizedScrollY = this.scrollY / (document.body.offsetHeight - window.innerHeight);
        this.currentSection = 0


        this.smoothScroll = document.querySelector('.smooth');
        this.scrollTarget = 0
        this.normalizedTargetScrollY = 0

        document.getElementById('fake-scroll').addEventListener('scroll', (e) => {
            this.scroll()
        });

        document.getElementById('fake-scroll').addEventListener('wheel', (e) => {
            this.scrollDeltaY = e.deltaY
        });

        this.setFBOParticles()

        // 第 1 页大字接力滚动: 拿 intro 和第二页标题 DOM (.section--text 第 1 个 = 段 2 'The Knight Awakens')
        this.introEl = document.querySelector('.intro')
        this.secondTitleEl = document.querySelectorAll('.section--text')[0]?.querySelector('.content__text-title')

        // ★关键★ .intro 的祖先 .smooth 有 'will-change: transform' (smooth scroll 用), 这会创建新的 fixed 定位 containing block,
        // 让 position:fixed 相对 .smooth 而不是 viewport, 视觉上 MORPH 跟着 .smooth 一起滚
        // 把 .intro 移到 body 直接子元素, 脱离 .smooth 影响, fixed 才能钉 viewport
        if (this.introEl && this.introEl.parentNode !== document.body) {
            document.body.appendChild(this.introEl)
        }

        // hold left mouse to control the model: drag = rotate, wheel = zoom.
        // release left mouse: wheel goes back to normal page scrolling.
        this.leftDown = false
        this.lastPointerX = 0
        this.lastPointerY = 0
        // model rotation accumulated by left-drag (applied to treeMesh)
        this.modelYaw = Math.PI / 2   // start front-facing, same as treeMesh.rotation.y
        this.modelPitch = 0
        // zoom = camera distance along -z (parallax only nudges x/y, never z)
        this.cameraDist = 4
        this.targetCameraDist = 4   // wheel writes here, update() lerps cameraDist to target for smooth zoom
        const fakeScrollEl = document.getElementById('fake-scroll')
        window.addEventListener('mousedown', (e) => {
            if (e.button === 0) { this.leftDown = true; this.lastPointerX = e.clientX; this.lastPointerY = e.clientY }
        })
        window.addEventListener('mouseup', (e) => {
            if (e.button === 0) this.leftDown = false
        })
        window.addEventListener('mousemove', (e) => {
            if (!this.leftDown) return
            const dx = e.clientX - this.lastPointerX
            const dy = e.clientY - this.lastPointerY
            this.lastPointerX = e.clientX
            this.lastPointerY = e.clientY
            this.modelYaw += dx * 0.01
            this.modelPitch = THREE.MathUtils.clamp(this.modelPitch - dy * 0.01, -1.2, 1.2)
        })
        if (fakeScrollEl) {
            fakeScrollEl.addEventListener('wheel', (e) => {
                if (!this.leftDown) return  // not holding left: normal page scroll
                e.preventDefault()  // holding left: wheel zooms, don't page
                const controls = this.experience.camera.controls
                this.targetCameraDist = THREE.MathUtils.clamp(this.targetCameraDist * (1 + e.deltaY * 0.001), controls.minDistance, controls.maxDistance)
            }, { passive: false })
        }

        // raycast mouse to the fairy so the holo shader can open a hole there
        this.raycaster = new THREE.Raycaster()
        this.pointerNDC = new THREE.Vector2(2, 2)  // off-screen by default
        if (fakeScrollEl) {
            fakeScrollEl.addEventListener('pointermove', (e) => {
                const rect = fakeScrollEl.getBoundingClientRect()
                this.pointerNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
                this.pointerNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
            })
            fakeScrollEl.addEventListener('pointerleave', () => {
                this.pointerNDC.set(2, 2)
            })
        }
    }

    makeTexture(g, tailMark = null){

        let vertAmount = g.attributes.position.count;
        let texWidth = 256;  // 强制对齐FBO 256x256, 避免欠采样残影
        let texHeight = 256;

        let data = new Float32Array(texWidth * texHeight * 4);  // 256x256, 多出来的填0被discard过滤

        function shuffleArrayByThree(array) {
            const groupLength = 3;

            let numGroups = Math.floor(array.length / groupLength);

            for (let i = numGroups - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));

                for (let k = 0; k < groupLength; k++) {
                    let temp = array[i * groupLength + k];
                    array[i * groupLength + k] = array[j * groupLength + k];
                    array[j * groupLength + k] = temp;
                }
            }

            return array;
        }


        shuffleArrayByThree(g.attributes.position.array);

        let totalTexel = texWidth * texHeight;  // 65536
        for(let i = 0; i < totalTexel; i++){
            let vi = i % vertAmount;  // 顶点不够循环复用

            const x = g.attributes.position.array[vi * 3 + 0];
            const y = g.attributes.position.array[vi * 3 + 1];
            const z = g.attributes.position.array[vi * 3 + 2];
            const w = tailMark ? tailMark[vi] : 0

            data[i * 4 + 0] = x;
            data[i * 4 + 1] = y;
            data[i * 4 + 2] = z;
            data[i * 4 + 3] = w;
        }

        let dataTexture = new THREE.DataTexture(data, texWidth, texHeight, THREE.RGBAFormat, THREE.FloatType);
        dataTexture.needsUpdate = true;

        return dataTexture;
    }

    setFBOParticles() {
        // width and height of FBO
        const width = 256;
        const height = 256;

        function parseMesh(g){
            var vertices = g.vertices;
            var total = vertices.length;
            var size = parseInt( Math.sqrt( total * 4 ) + .5 );
            var data = new Float32Array( size*size * 4 );
            for( var i = 0; i < total; i++ ) {
                data[i * 3] = vertices[i].x;
                data[i * 3 + 1] = vertices[i].y;
                data[i * 3 + 2] = vertices[i].z;
            }
            return data;
        }

        //returns an array of random 3D coordinates
        function getRandomData( width, height, size ){
            var len = width * height * 4;
            var data = new Float32Array( len );
            //while( len-- )data[len] = ( Math.random() -.5 ) * size ;
            for(let i = 0; i < len; i++){
                data[i * 3 + 0] = (Math.random() - 0.5) * size
                data[i * 3 + 1] = (Math.random() - 0.5) * size
                data[i * 3 + 2] = (Math.random() - 0.5) * size
            }

            return data;
        }

        // 遍历找第一个mesh,兼容多层嵌套(Sketchfab导出的模型结构深)
        let boyMesh = null
        this.resources.items.boyModel.scene.traverse(o => { if (o.isMesh && !boyMesh) boyMesh = o })
        this.boyGeometry = boyMesh.geometry.clone()
        this.boyGeometry.center()
        this.boyGeometry.scale(3.564, 3.564, 3.564)
        this.boyGeometry.rotateY(Math.PI * 1.25)
        this.boyGeometry.translate(0, -0.3, 0)

        // 水母(2个mesh) traverse合并 + center + scale0.54(放大一倍) + rotateZ头朝右上
        const e2Geoms = []
        this.resources.items.e2Model.scene.traverse(o => { if (o.isMesh && o.geometry) e2Geoms.push(o.geometry.clone()) })
        // 合并前记录尾巴标记: 原始z<0是尾巴=1, 头=0
        let e2PreCount = 0
        for (const gg of e2Geoms) e2PreCount += gg.attributes.position.count
        const e2TailMark = new Float32Array(e2PreCount)
        let e2Off = 0
        for (const gg of e2Geoms) {
          const arr = gg.attributes.position.array
          const cnt = gg.attributes.position.count
          for (let i = 0; i < cnt; i++) {
            e2TailMark[e2Off + i] = arr[i * 3 + 2] < 0.0 ? Math.min(-arr[i * 3 + 2] / 6.0, 1.0) : 0.0  // 头=0, 尾巴=深度(0~1)
          }
          e2Off += cnt
        }
        this.e2Geometry = BufferGeometryUtils.mergeGeometries(e2Geoms, false) || e2Geoms[0]
        this.e2Geometry.center()
        this.e2Geometry.scale(0.54, 0.54, 0.54)
        this.e2Geometry.rotateX(Math.PI / 2)  // 先立起来(头从冲屏幕变朝上)
        this.e2Geometry.rotateZ(Math.PI * 0.75)  // 调头朝右上
        this.e2TailMark = e2TailMark


        // this.horseGeometry = this.resources.items.horseModel.scene.children[0].geometry.clone()
        // this.horseGeometry.scale(0.01, 0.01, 0.01)




        //populate a Float32Array of random positions
        //var data = getRandomData( width, height, 256 );

        // 刺客(Sketchfab下载, 24个mesh都65532顶点需合并) traverse合并所有mesh
        const oniGeoms = []
        this.resources.items.oniModel.scene.traverse(o => { if (o.isMesh && o.geometry) oniGeoms.push(o.geometry.clone()) })
        this.oniGeometry = BufferGeometryUtils.mergeGeometries(oniGeoms, false) || oniGeoms[0]
        this.oniGeometry.center()
        this.oniGeometry.scale(5.0, 5.0, 5.0)
        this.oniGeometry.rotateX(-Math.PI / 2)  // 反向转,头朝上
        this.oniGeometry.translate(0, -0.8, 0)  // 往下一点露头  // 往下挪一点露出头


        //convertes it to a FloatTexture
        //var positions = new THREE.DataTexture( data, width, height, THREE.RGBAFormat, THREE.FloatType );
        //positions.needsUpdate = true;


        // 粒子聚形目标用新花仙子fairy2(测试有无球壳)
        let treeSrcMesh = null
        this.resources.items.treeModel.scene.traverse(o => { if (o.isMesh && !treeSrcMesh) treeSrcMesh = o })
        this.treeGeometry = treeSrcMesh.geometry.clone()
        this.treeGeometry.scale(2.6667, 2.6667, 2.6667)  // 花仙子scale 4.0 → 2.6667 (调小到2/3)
        this.treeGeometry.rotateY(Math.PI / 2)
        this.treeGeometry.translate(0, -1, 0)


        var uTextureA = this.makeTexture(this.boyGeometry);

        var data = getRandomData( width, height, 30 );
        var positions = new THREE.DataTexture( data, width, height, THREE.RGBAFormat, THREE.FloatType );
        positions.needsUpdate = true;
        // var uTextureA = positions;
        var uTextureB = this.makeTexture(this.oniGeometry);
        var uTextureC = this.makeTexture(this.e2Geometry, this.e2TailMark);
        var uTextureD = positions;
        var uTextureE = this.makeTexture(this.treeGeometry);

        //simulation shader used to update the particles' positions
        this.simMaterial = new THREE.ShaderMaterial({
            uniforms:{
                uTextureA: { type: "t", value: uTextureA },
                uTextureB: { type: "t", value: uTextureB },
                uTextureC: { type: "t", value: uTextureC },
                uTextureD: { type: "t", value: uTextureD },
                uTextureE: { type: "t", value: uTextureE },
                uTime: { value: 0 },
                uScroll : { value: this.normalizedScrollY },
                uTreePos : { value: new THREE.Vector3() },
                uModelYaw : { value: Math.PI / 2 },
                uReverse : { value: 0 },  // 0=normal, 1=反向回 D (第 6 页星空)
            },
            defines:
            {
                uTotalModels : parseFloat(this.sectionCount).toFixed(2),
            },
            vertexShader: simVertex,
            fragmentShader:  simFragment
        });

        //render shader to display the particles on screen
        //the 'positions' uniform will be set after the FBO.update() call
        this.renderMaterial = new THREE.ShaderMaterial( {
            uniforms: {
                uPositions: { value: null },
                uSize: { value: 12 },
                uTime: { value: 0 },
                uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
                uScroll : { value: this.normalizedScrollY },
                uResolution: new THREE.Uniform(
                    new THREE.Vector2(
                        this.sizes.width * this.sizes.pixelRatio,
                        this.sizes.height * this.sizes.pixelRatio
                    )
                ),
            },
            defines:
            {
                uTotalModels : parseFloat(this.sectionCount).toFixed(2),
                uRange : this.range,
            },
            vertexShader: particlesVertex,
            fragmentShader: particlesFragment,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        } );

        // Initialize the FBO
        this.fbo = new FBO(width, height, this.renderer, this.simMaterial, this.renderMaterial);

        // Add the particles to the scene
        this.scene.add(this.fbo.particles);


        this.resource = this.resources.items.horseModel
        this.horseMesh = this.resources.items.horseModel.scene

        this.horseMesh.scale.set(0.01, 0.01, 0.01)

        const pointsMaterial = new THREE.PointsMaterial( {
            size: 4,
            sizeAttenuation: false,
        } );

        this.horsePointsMaterial = new THREE.ShaderMaterial( {
            uniforms: {
                uPositions: { value: null },
                uSize: { value: 2 },
                uTime: { value: 0 },
                uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
                uScroll : { value: this.normalizedScrollY },
            },
            defines:
            {
                uTotalModels : parseFloat(this.sectionCount).toFixed(2),
                uRange : this.range,
            },
            vertexShader: horseParticlesVertex,
            fragmentShader: horseParticlesFragment,
            transparent: true,
            depthWrite: false,
            //type: 'PointsMaterial',
            //blending: THREE.AdditiveBlending
        } );


        this.fg = this.horseMesh.children[0].geometry

        this.aE2Geometry = new Float32Array( this.fg.attributes.position.array.length );

        for ( let i = 0; i < this.fg.attributes.position.array.length; i ++ ) {
            this.aE2Geometry[i + 0] = this.e2Geometry.attributes.position.array[i + 0];
            this.aE2Geometry[i + 1] = this.e2Geometry.attributes.position.array[i + 1];
            this.aE2Geometry[i + 2] = this.e2Geometry.attributes.position.array[i + 2];
        }

        this.fg.setAttribute( 'aE2Geometry', new THREE.BufferAttribute( this.aE2Geometry, `3` ) );

        const points = new THREE.Points( this.fg, this.horsePointsMaterial );
        points.morphTargetInfluences = this.horseMesh.children[0].morphTargetInfluences;
        points.morphTargetDictionary = this.horseMesh.children[0].morphTargetDictionary;

        //points.scale.set(1, 1, 1)
        //points.rotateY(Math.PI / 2)

        this.horseMesh.rotateY(Math.PI / 2)

        this.setAnimation()

        //this.scene.add(this.horseMesh)
        this.horsePoints = points
        this.scene.add(points)

        // 第 6 页花仙子"手心手背"组: 整组转 = 相对静止旋转, 实体 + 粒子在组内背对背
        this.fairyGroup = new THREE.Group()
        this.scene.add(this.fairyGroup)

        this.treeMesh = this.resources.items.treeModel.scene
        this.treeMesh.scale.set(2.6667, 2.6667, 2.6667)  // 花仙子scale 4.0 → 2.6667 (调小到2/3)
        this.treeMesh.rotation.y = -Math.PI / 2  // 局部: face -x (背对中心朝外, 手心朝左)
        // 花仙子专属灯光已去掉(用emissive自发光)
// 花仙子:原始材质+自发光提亮(emissiveMap用贴图,均匀亮无阴影)
        // hologram overlay: cyan glow + scanlines, mouse brushes a hole to reveal the solid
        this.holoMeshes = []
        this.holoUniforms = {
          uTime: { value: 0 },
          uOpacity: { value: 0.85 },
          uColor: { value: new THREE.Color(0x00e5ff) },
          uCoreColor: { value: new THREE.Color(0x9bffff) },
          uHitPoint: { value: new THREE.Vector3(999, 999, 999) },
          uHitDir: { value: new THREE.Vector3(0, 0, -1) },
          uHitActive: { value: 0 },
          uBrushR: { value: 0.6 },
          uDissolve: { value: 0.0 }
        }
        this.treeMesh.traverse(o => {
          if (o.isMesh && o.material) {
            o.material.emissive = new THREE.Color(0x88aaff)  // soft blue glow
            o.material.emissiveIntensity = 0.4
            o.material.emissiveMap = o.material.map || null
            // make the solid itself translucent where the mouse brushes, so the
            // holo shell behind shows through (X-ray style local transparency)
            o.material.transparent = true
            o.material.onBeforeCompile = (shader) => {
              shader.uniforms.uHitPoint = this.holoUniforms.uHitPoint
              shader.uniforms.uHitDir = this.holoUniforms.uHitDir
              shader.uniforms.uHitActive = this.holoUniforms.uHitActive
              shader.uniforms.uBrushR = this.holoUniforms.uBrushR
              shader.vertexShader = 'varying vec3 vWorldPosSolid;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vWorldPosSolid = (modelMatrix * vec4(position,1.0)).xyz;')
              shader.fragmentShader = 'uniform vec3 uHitPoint; uniform vec3 uHitDir; uniform float uHitActive; uniform float uBrushR; varying vec3 vWorldPosSolid;\n' + shader.fragmentShader.replace('#include <opaque_fragment>', 'vec3 toFragS = vWorldPosSolid - uHitPoint; float alongS = dot(toFragS, uHitDir); float dSolid = length(toFragS - alongS * uHitDir); float brushSolid = uHitActive * (1.0 - smoothstep(uBrushR*0.6, uBrushR, dSolid)); diffuseColor.a *= 1.0 - brushSolid;\n#include <opaque_fragment>')
            }
            o.material.needsUpdate = true
            // overlay a holo shell on top of the solid mesh
            const holoMat = new THREE.ShaderMaterial({
              uniforms: this.holoUniforms,
              vertexShader: holoVertex,
              fragmentShader: holoFragment,
              transparent: true,
              depthWrite: false,
              blending: THREE.AdditiveBlending
            })
            const holoMesh = new THREE.Mesh(o.geometry, holoMat)
            // child of treeMesh: keep auto-update so it follows position.y changes
            this.holoMeshes.push({ src: o, holo: holoMat })
            this.treeMesh.add(holoMesh)

          }
          // put the fairy on its own layer so the bloom post-process
          // (which only renders layer 0 = particles) cannot fog it
          o.layers.set(1)
        })
        this.treeMesh.layers.set(1)

        // dedicated lights on layer 1 to light the fairy solid (the layer-0
        // scene lights are too dim for a clean PBR render)
        this.fairyLight = new THREE.DirectionalLight(0xffffff, 2.0)
        this.fairyLight.position.set(2, 3, 4)
        this.fairyLight.layers.set(1)
        this.scene.add(this.fairyLight)
        this.fairyAmbient = new THREE.AmbientLight(0xffffff, 1.0)
        this.fairyAmbient.layers.set(1)
        this.scene.add(this.fairyAmbient)
        this.treeMesh.position.set(0, 0, 0)  // 局部: 在 fairyGroup 原点 (整组随 scrollY 移动)
        this.fairyGroup.add(this.treeMesh)  // 加入 fairyGroup, 不直接 add to scene

        // ===== 实体狐狸(第一页): 滚动时从头顶往下溶解, 粒子同步渐显 =====

        // ===== 第 6 页独立粒子花仙子 (粉色, 跟 treeMesh 实体共存) =====
        // 从 treeModel 顶点取位置, page 6 fade in, 跟主粒子星空 + treeMesh 实体三样共存
        this.fairyPoints = null;
        this.fairyPointsMaterial = null;
        this.fairyPointsOpacity = 0;
        const treeSrcF = this.resources.items.treeModel;
        if (treeSrcF) {
          let treeMeshF = null;
          treeSrcF.scene.traverse(o => { if (o.isMesh && !treeMeshF) treeMeshF = o });
          if (treeMeshF) {
            const treePositionsF = treeMeshF.geometry.attributes.position.array;
            const fairyGeometry = new THREE.BufferGeometry();
            fairyGeometry.setAttribute('position', new THREE.BufferAttribute(treePositionsF.slice(), 3));
            fairyGeometry.scale(2.6667, 2.6667, 2.6667);  // 跟 treeGeometry 一致
            // 去掉 geometry.rotateY(π/2) bake: 之前 bake 让粒子在视觉上比实体多转 90°, 看着偏到实体右侧 90°. 改用 mesh.rotation 统一控制朝向
            // 不 translate -1 (treeGeometry 的 translate(-1) 是给 simulation.frag textureE 用的, 那里 +1 抵消, 我们直接用 treeMesh 实体位置)
            this.fairyPointsMaterial = new THREE.ShaderMaterial({
                uniforms: {
                    uSize: { value: 3 },
                    uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
                    uOpacity: { value: 0 },
                    uColor: { value: new THREE.Color(0xff9bcc) },  // 粉色
                },
                vertexShader: 'uniform float uSize; uniform float uPixelRatio; void main() { vec4 mvPos = modelViewMatrix * vec4(position, 1.0); gl_PointSize = uSize * uPixelRatio; gl_Position = projectionMatrix * mvPos; }',
                fragmentShader: 'uniform vec3 uColor; uniform float uOpacity; void main() { float d = distance(gl_PointCoord, vec2(0.5)); if (d > 0.5) discard; float a = (1.0 - d * 2.0) * uOpacity; gl_FragColor = vec4(uColor, a); }',
                transparent: true,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
            });
            this.fairyPoints = new THREE.Points(fairyGeometry, this.fairyPointsMaterial);
            // 局部位置: 实体右侧 0 单位 (跟实体完全叠在 fairyGroup 原点, 老大挪到底)
            this.fairyPoints.position.set(FAIRY_PARTICLE_OFFSET_X, 0, 0)
            // 局部 rotation: π/2 (face +x, 背对实体 — 实体的背在 -x 方向, 粒子的背在 -x 方向, 两背在中间相遇)
            this.fairyPoints.rotation.y = Math.PI / 2
            this.fairyPoints.layers.set(1);  // 不进 bloom
            this.fairyPoints.visible = false;
            this.fairyGroup.add(this.fairyPoints);  // 加入 fairyGroup, 跟实体一起整组转
          }
        }
        this.foxSolid = null
        this.foxUniforms = { uDissolve: { value: 0 } }
        const foxSrc = this.resources.items.fox9Model
        if (foxSrc) {
          let foxMesh = null
          foxSrc.scene.traverse(o => { if (o.isMesh && !foxMesh) foxMesh = o })
          if (foxMesh) {
            this.foxSolid = new THREE.Mesh(foxMesh.geometry.clone(), foxMesh.material.clone())
            this.foxSolid.scale.set(3.564, 3.564, 3.564)
            this.foxSolid.rotation.y = Math.PI * 1.25
            this.foxSolid.position.set(0, -0.3, 0)
            // emissive自发光(淡青,和全息壳同色系), 让实体本身发光融合
            this.foxSolid.material.emissive = new THREE.Color(0xaaeeff)
            this.foxSolid.material.emissiveIntensity = 2.0
            this.foxSolid.material.emissiveMap = this.foxSolid.material.map || null
            // 溶解: 按世界y从上(头顶)往下, uDissolve 0=完整 1=全溶
            this.foxSolid.material.transparent = true
            this.foxSolid.material.onBeforeCompile = (shader) => {
              shader.uniforms.uDissolve = this.foxUniforms.uDissolve
              shader.vertexShader = 'varying float vFoxY;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vFoxY = (modelMatrix * vec4(position,1.0)).y;')
              shader.fragmentShader = 'uniform float uDissolve; varying float vFoxY;\n' + shader.fragmentShader.replace('#include <opaque_fragment>', 'float foxH = clamp((vFoxY + 1.8) / 3.6, 0.0, 1.0); float dLine = 1.0 - uDissolve; float vis = 1.0 - smoothstep(dLine - 0.12, dLine, foxH); if (vis < 0.01) discard; diffuseColor.a *= vis;\n#include <opaque_fragment>')
            }
            this.foxSolid.material.needsUpdate = true
            this.foxSolid.layers.set(1)
            // 全息青光壳(和花仙子同款): 跟实体溶解一起消失
            this.foxHoloUniforms = {
              uTime: { value: 0 },
              uOpacity: { value: 0.85 },
              uColor: { value: new THREE.Color(0x00e5ff) },
              uCoreColor: { value: new THREE.Color(0x9bffff) },
              uHitPoint: { value: new THREE.Vector3(999, 999, 999) },
              uHitDir: { value: new THREE.Vector3(0, 0, -1) },
              uHitActive: { value: 0 },
              uBrushR: { value: 0.6 },
              uDissolve: this.foxUniforms.uDissolve
            }
            const foxHoloMat = new THREE.ShaderMaterial({
              uniforms: this.foxHoloUniforms,
              vertexShader: holoVertex,
              fragmentShader: holoFragment,
              transparent: true,
              depthWrite: false,
              blending: THREE.AdditiveBlending
            })
            this.foxHolo = new THREE.Mesh(this.foxSolid.geometry, foxHoloMat)
            this.foxHolo.scale.set(3.564, 3.564, 3.564)
            this.foxHolo.rotation.y = Math.PI * 1.25
            this.foxHolo.position.set(0, -0.3, 0)
            this.foxHolo.layers.set(1)
            this.scene.add(this.foxHolo)
            this.scene.add(this.foxSolid)
          }
        }

    }

    resize() {
        this.fbo.resize(this.sizes.width, this.sizes.height);
        this.renderMaterial.uniforms.uPixelRatio.value = Math.min(window.devicePixelRatio, 2)
        this.horsePointsMaterial.uniforms.uPixelRatio.value = Math.min(window.devicePixelRatio, 2)
        this.renderMaterial.uniforms.uResolution.value.set(this.sizes.width * this.sizes.pixelRatio, this.sizes.height * this.sizes.pixelRatio)
    }

    scroll()
    {
        this.scrollY = document.getElementById('fake-scroll').scrollTop

        //next center section
        if( !this.isMobile ){
            this.centerPrevSection = (Math.floor(this.scrollY / window.innerHeight)) * window.innerHeight
            this.centerNextSection = (Math.floor(this.scrollY / window.innerHeight) + 1) * window.innerHeight

            if ( this.scrollY + 100 > this.centerNextSection ) {
                this.scrollY = this.centerNextSection
            }

            if ( this.scrollY - 100 < this.centerPrevSection ) {
                this.scrollY = this.centerPrevSection
            }
        }

        this.normalizedScrollY = this.scrollY / (this.sectionCount * window.innerHeight);
        this.normalizedScrollY = Math.min(this.normalizedScrollY, 1.0)
    }

    scrollSet()
    {
        const lambda = this.isMobile ? 9 : 3
        this.normalizedTargetScrollY = MathUtils.damp(this.normalizedTargetScrollY, this.normalizedScrollY, lambda, this.time.delta);
        this.objectDistance = this.normalizedTargetScrollY / this.range

        this.simMaterial.uniforms.uScroll.value = this.normalizedTargetScrollY
        this.horsePointsMaterial.uniforms.uScroll.value = this.normalizedScrollY  // 用原始 scroll 让段 6 立即响应 (不用 damp 平滑)
        this.renderMaterial.uniforms.uScroll.value = this.normalizedTargetScrollY

        this.scrollTarget = MathUtils.damp(this.scrollTarget, this.scrollY, lambda, this.time.delta);

        const newSection = Math.round(this.scrollTarget / this.sizes.height)

        if(newSection !== this.currentSection)
        {
            this.currentSection = newSection
        }


        this.smoothScroll.style.webkitTransform = 'translate3d(0px, -' + this.scrollTarget + 'px, 0px)';
        this.smoothScroll.style.mozTransform = 'translate3d(0px, -' + this.scrollTarget + 'px, 0px)';
        this.smoothScroll.style.transform = 'translate3d(0px, -' + this.scrollTarget + 'px, 0px)';
    }

    setAnimation() {
        this.animation = {}

        // Mixer
        this.animation.mixer = new THREE.AnimationMixer(this.horseMesh)

        // Actions
        this.animation.actions = {}

        this.animation.actions.idle = this.animation.mixer.clipAction(this.resource.animations[0])
        this.animation.actions.open = this.animation.mixer.clipAction(this.resource.animations[0])

        this.animation.actions.current = this.animation.actions.idle
        this.animation.actions.current.timeScale = 0.25
        this.animation.actions.current.play()

        // Play the action
        this.animation.play = (name) =>
        {
            const newAction = this.animation.actions[name]
            const oldAction = this.animation.actions.current

            newAction.reset()
            newAction.play()
            newAction.crossFadeFrom(oldAction, 1)

            this.animation.actions.current = newAction
        }
    }

    setDebug() {
        // Debug
        if(this.debug.active)
        {
            //this.debugFolder = this.debug.gui.addFolder('Cube')
            //this.debugFolder.open()
        }
    }

    update() {
        if ( this.animation )
            this.animation.mixer.update(this.time.delta)

        this.simMaterial.uniforms.uTime.value = this.time.elapsed
        this.renderMaterial.uniforms.uTime.value = this.time.elapsed
        this.horsePointsMaterial.uniforms.uTime.value = this.time.elapsed

        //this.fbo.particles.rotateY(this.time.delta * 0.1)

        this.scrollSet()

        // fox page-1 solid: run + tail animation, only on page 1


        this.fbo.update();

        const speed = 2;
        const section = this.sectionCount * 2;
        const displacement = -1;
        // fairyGroup 整组跟随滚动 + modelYaw/Pitch (相对静止旋转: 实体+粒子一起转, 相对位置不变)
        const fairyY = (displacement - section * this.sectionCount) + this.objectDistance * this.sectionCount * speed
        if (this.fairyGroup) {
          this.fairyGroup.position.y = fairyY
          this.fairyGroup.rotation.y = this.modelYaw
          this.fairyGroup.rotation.x = this.modelPitch
        }
        this.simMaterial.uniforms.uTreePos.value = this.fairyGroup ? this.fairyGroup.position : this.treeMesh.position
        // 实体狐狸溶解: 第一段(scroll 0~range)从完整到全溶
        if (this.foxUniforms) {
          this.foxUniforms.uDissolve.value = MathUtils.clamp(this.normalizedTargetScrollY / this.range, 0, 1)
        }
        this.simMaterial.uniforms.uModelYaw.value = this.modelYaw
        // 第 6 页: scroll 0.9~1.0 时 uReverse 0→1, 粒子从 E (花仙子) 反向散开回 D (3D 星空)
        this.simMaterial.uniforms.uReverse.value = THREE.MathUtils.clamp((this.normalizedTargetScrollY - 0.9) / 0.1, 0, 1)

        // this.treeMesh.rotateY(-this.time.delta * 0.1)  // 花仙子不旋转

        // sync holo overlay transforms with the source meshes + drive the brush hole
        // ★ 老大要求: 只有松开左键时鼠标放上才漏出全息,按住左键旋转时关闭全息
        if (this.holoUniforms) {
            this.holoUniforms.uTime.value = this.time.elapsed
            if (!this.leftDown) {
                // 松开左键: 跑 raycast,击中则亮 uHitActive = 1
                this.treeMesh.updateMatrixWorld(true)
                this.raycaster.setFromCamera(this.pointerNDC, this.camera)
                this.holoUniforms.uHitDir.value.copy(this.raycaster.ray.direction).normalize()
                const hits = this.raycaster.intersectObject(this.treeMesh, true)
                if (hits.length) {
                    this.holoUniforms.uHitPoint.value.copy(hits[0].point)
                    this.holoUniforms.uHitActive.value = 1
                } else {
                    this.holoUniforms.uHitActive.value = 0
                }
            } else {
                // 按住左键旋转时: 主动关闭 holo,防止按住左键拖动时全息闪烁/残留
                this.holoUniforms.uHitActive.value = 0
            }
        }

        // 整组转由 fairyGroup 接管 (L675-676): fairyGroup.rotation.y = modelYaw, x = modelPitch
        // 实体的局部 rotation 在 init 锁死 -π/2 (face -x, 手心朝左)
        // 粒子的局部 rotation 在 init 锁死 +π/2 (face +x, 手背朝右)
        // 总旋转各为 modelYaw-π/2 / modelYaw+π/2, 永远差 π = 背对背 = "手心手背"
        // 不要再写 treeMesh.rotation.y = modelYaw (会覆盖 init 的 -π/2, 之前 v16c 的 bug)
        // particles stay back-facing: same yaw as the solid + 180deg
        this.fbo.particles.rotation.y = this.modelYaw + Math.PI / 2
        this.fbo.particles.rotation.x = this.modelPitch
        // 实体狐狸: 跟随左键旋转 + 对齐粒子朝向(粒子有两层旋转, 实体要补上)
        if (this.foxSolid) {
          this.foxSolid.rotation.y = Math.PI * 1.25 + this.modelYaw + Math.PI / 2
          this.foxSolid.rotation.x = this.modelPitch
        }
        if (this.foxHolo) {
          this.foxHoloUniforms.uTime.value = this.time.elapsed
          this.foxHolo.rotation.y = Math.PI * 1.25 + this.modelYaw + Math.PI / 2
          this.foxHolo.rotation.x = this.modelPitch
        }
        // 马粒子: 跟随左键旋转(基础PI/2 + modelYaw)
        if (this.horsePoints) {
          this.horsePoints.rotation.y = Math.PI / 2 + this.modelYaw
          this.horsePoints.rotation.x = this.modelPitch
        }
        // Smooth zoom: wheel mutates target, cameraDist lerps to follow (~250ms convergence at 60fps, clamped for large dt)

        // 花仙子粒子: page 6 fade in (跟主粒子 uReverse 同步)
        // 位置: 实体右侧 0 单位 (FAIRY_PARTICLE_OFFSET_X, 老大挪到底, 跟实体叠在同一 x)
        // 旋转: modelYaw + π (face -x, 背对实体 — 实体的背在 -x, 粒子的背在 +x, 两个背在中间相遇)
        if (this.fairyPoints) {
          const fairyTarget = THREE.MathUtils.clamp((this.normalizedTargetScrollY - 0.9) / 0.1, 0, 1)
          this.fairyPointsOpacity += (fairyTarget - this.fairyPointsOpacity) * Math.min(1, 8 * this.time.delta)
          this.fairyPoints.visible = this.fairyPointsOpacity > 0.01
          if (this.fairyPointsMaterial) this.fairyPointsMaterial.uniforms.uOpacity.value = this.fairyPointsOpacity
          // 粒子 position/rotation 都在 init 锁死 (局部), fairyGroup 整组带 — 不需要每帧重设
        }
        this.cameraDist += (this.targetCameraDist - this.cameraDist) * Math.min(1, 8 * this.time.delta)
        this.camera.position.z = -this.cameraDist

        // 第 1 页大字接力: 段 2 标题 (The Knight Awakens) 顶刚到 viewport 底部 (= 老大说的 "从底部露出来" 那一刻), MORPH 开始 1:1 同步上移
        //   触发条件: h2.top <= vh (h2 顶刚到 viewport 底部 = "从底部露出来"那一刻, 段 2 开始处)
        //   公式: translateY(h2.top - vh) px (触发瞬间 = 0, 之后 h2.top 减小, translateY 变负 = MORPH 上移 = 1:1 同步)
        if (this.introEl && this.secondTitleEl) {
            const _tRect = this.secondTitleEl.getBoundingClientRect()
            const _vh = window.innerHeight
            if (_tRect.top <= _vh) {
                this.introEl.style.transform = `translateY(${_tRect.top - _vh}px)`
            } else {
                this.introEl.style.transform = 'translateY(0)'
            }
        }

        // parallax nudges camera x/y while not dragging
        // ★ 老大要求: 第 6 页 (currentSection === sectionCount === 5, 即 page-fairy) 不跟随鼠标晃动
        // leftDown (拖拽旋转) 守卫原本就有,继续保留;滚轮缩放(cameraDist)走自己的逻辑,完全不动
        const isPage6 = this.currentSection === this.sectionCount
        if (!this.leftDown && !isPage6) {
            this.camera.position.x += (this.cursor.x * 0.5 - this.camera.position.x) * 5 * this.time.delta
            this.camera.position.y += (- this.cursor.y * 0.5 - this.camera.position.y) * 5 * this.time.delta
        }
    }
}