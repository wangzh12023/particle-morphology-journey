import * as THREE from 'three'
import Experience from './Experience.js'
import gsap from "gsap";

export default class Camera
{
    constructor()
    {
        this.experience = new Experience()
        this.sizes = this.experience.sizes
        this.scene = this.experience.scene
        this.time = this.experience.time
        this.canvas = this.experience.canvas
        this.timeline = this.experience.timeline
        this.cursorEnabled = false

        this.lerpVector = new THREE.Vector3();

        this.setInstance()
        this.setControls()
    }

    setInstance()
    {
        this.instance = new THREE.PerspectiveCamera(45, this.sizes.width / this.sizes.height, 0.1, 10000)
        this.defaultCameraPosition = new THREE.Vector3(0, 0, -4);

        this.instance.position.copy(this.defaultCameraPosition)
        this.instance.lookAt(new THREE.Vector3(0, 0, 0));

        this.lerpVector.copy(this.instance.position);

        this.scene.add(this.instance)
    }

    setControls()
    {
        // rotation is now done on the model (Page.js), not the camera.
        // keep a stub so existing references to controls.minDistance / maxDistance work.
        this.controls = { minDistance: 1.5, maxDistance: 12, target: new THREE.Vector3(0, -0.5, 0) }
    }

    resize()
    {
        this.instance.aspect = this.sizes.width / this.sizes.height
        this.instance.updateProjectionMatrix()
    }

    update()
    {
        this.instance.updateMatrixWorld() // To be used in projection
    }

    animateCameraPosition() {

    }
}
