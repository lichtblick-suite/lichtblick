// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import EventEmitter from "eventemitter3";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { URDFRobot } from "urdf-loader";

import { EventTypes } from "./types";

// https://github.com/gkjohnson/urdf-loaders/issues/205
function cloneModel(robot: URDFRobot): URDFRobot {
  const copy = robot.clone();
  copy.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      if (Array.isArray(obj.material)) {
        obj.material = obj.material.map((material) => material.clone());
      } else if (obj.material != undefined) {
        obj.material = obj.material.clone();
      }
    }
  });
  return copy;
}

export class Renderer extends EventEmitter<EventTypes> {
  private scene = new THREE.Scene();
  private world = new THREE.Object3D();
  private camera = new THREE.PerspectiveCamera();
  private renderer?: THREE.WebGLRenderer;
  private ambientLight: THREE.HemisphereLight;
  private dirLight: THREE.DirectionalLight;
  private model?: URDFRobot;
  private opacity: number = 1;
  private jointValues: Record<string, number> = {};
  private controls?: OrbitControls;

  public constructor() {
    super();
    this.scene.add(this.world);
    this.world.rotation.set(-Math.PI / 2, 0, 0);

    this.ambientLight = new THREE.HemisphereLight("#666666", "#000");
    this.ambientLight.groundColor.lerp(this.ambientLight.color, 0.5);
    this.ambientLight.intensity = 0.8;
    this.ambientLight.position.set(0, 1, 0);
    this.scene.add(this.ambientLight);

    this.dirLight = new THREE.DirectionalLight(0xffffff);
    this.scene.add(this.dirLight);
    this.scene.add(this.dirLight.target);

    this.camera.position.setFromSpherical(new THREE.Spherical(5, Math.PI / 3, Math.PI / 4));
    this.camera.lookAt(0, 0, 0);
  }

  public centerCamera(): void {
    this.controls?.reset();
  }

  public setCanvas(canvas: HTMLCanvasElement): void {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setClearColor(0xffffff);
    this.renderer.setClearAlpha(0.5);
    this.renderer.outputEncoding = THREE.sRGBEncoding;

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.screenSpacePanning = false; // only allow panning in the XY plane
    this.controls.mouseButtons.LEFT = THREE.MOUSE.PAN;
    this.controls.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;
    this.controls.touches.ONE = THREE.TOUCH.PAN;
    this.controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE;
    const controls = this.controls;
    this.controls.addEventListener("change", () => {
      this.emit("cameraMove", controls.target);
    });
  }

  public setSize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer?.setSize(width, height);
  }

  public setModel(model?: URDFRobot): void {
    if (this.model) {
      this.model.traverse((obj) => (obj as { dispose?(): void }).dispose?.());
      this.world.remove(this.model);
    }

    // Clone models so they can be displayed in multiple URDF panels at once without interfering.
    this.model = model ? cloneModel(model) : undefined;
    if (this.model) {
      this.world.add(this.model);
    }
    // Re-apply customized values to new model
    this.setOpacity(this.opacity);
    this.setJointValues(this.jointValues);
  }

  public setOpacity(opacity: number): void {
    this.opacity = opacity;
    this.model?.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        if (Array.isArray(obj.material)) {
          for (const material of obj.material) {
            const transparent = opacity < 1;
            material.opacity = opacity;
            material.transparent = transparent;
            material.depthWrite = !transparent;
          }
        } else if (obj.material != undefined) {
          const transparent = opacity < 1;
          obj.material.opacity = opacity;
          obj.material.transparent = transparent;
          obj.material.depthWrite = !transparent;
        }
      }
    });
  }

  public render(): void {
    // The light should follow the viewer's position
    this.dirLight.position.copy(this.camera.position);

    this.renderer?.render(this.scene, this.camera);
  }

  public setJointValues(values: Record<string, number>): void {
    this.jointValues = values;
    this.model?.setJointValues(values);
  }

  public dispose(): void {
    this.scene.traverse((obj) => obj !== this.scene && (obj as { dispose?(): void }).dispose?.());
  }
}
