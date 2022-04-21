// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import EventEmitter from "eventemitter3";
import * as THREE from "three";

import Logger from "@foxglove/log";
import { CameraState } from "@foxglove/regl-worldview";
import { ScreenOverlay } from "@foxglove/studio-base/panels/ThreeDeeRender/ScreenOverlay";

import { Input } from "./Input";
import { LayerErrors } from "./LayerErrors";
import { MaterialCache } from "./MaterialCache";
import { ModelCache } from "./ModelCache";
import { Picker } from "./Picker";
import { DetailLevel, msaaSamples } from "./lod";
import { FrameAxes } from "./renderables/FrameAxes";
import { Markers } from "./renderables/Markers";
import { OccupancyGrids } from "./renderables/OccupancyGrids";
import { PointClouds } from "./renderables/PointClouds";
import { Marker, OccupancyGrid, PointCloud2, TF } from "./ros";
import { TransformTree } from "./transforms/TransformTree";

const log = Logger.getLogger(__filename);

export type RendererEvents = {
  startFrame: (currentTime: bigint, renderer: Renderer) => void;
  endFrame: (currentTime: bigint, renderer: Renderer) => void;
  cameraMove: (renderer: Renderer) => void;
  renderableSelected: (renderable: THREE.Object3D | undefined, renderer: Renderer) => void;
  transformTreeUpdated: (renderer: Renderer) => void;
  showLabel: (labelId: string, labelMarker: Marker, renderer: Renderer) => void;
  removeLabel: (labelId: string, renderer: Renderer) => void;
};

const DEBUG_PICKING = false;

// NOTE: These do not use .convertSRGBToLinear() since background color is not
// affected by gamma correction
const LIGHT_BACKDROP = new THREE.Color(0xececec);
const DARK_BACKDROP = new THREE.Color(0x121217);

const LIGHT_OUTLINE = new THREE.Color(0x000000).convertSRGBToLinear();
const DARK_OUTLINE = new THREE.Color(0xffffff).convertSRGBToLinear();

const LAYER_DEFAULT = 0;
const LAYER_SELECTED = 1;

const TRANSFORM_STORAGE_TIME_NS = 60n * BigInt(1e9);

const UNIT_X = new THREE.Vector3(1, 0, 0);
const PI_2 = Math.PI / 2;

const tempVec = new THREE.Vector3();
const tempVec2 = new THREE.Vector2();
const tempSpherical = new THREE.Spherical();
const tempEuler = new THREE.Euler();

export class Renderer extends EventEmitter<RendererEvents> {
  canvas: HTMLCanvasElement;
  gl: THREE.WebGLRenderer;
  maxLod = DetailLevel.High;
  // TODO(jhurliman): Use multi-pass rendering with an OutlinePass for selected
  // objects when <https://github.com/mrdoob/three.js/issues/23019> is resolved
  // target: THREE.WebGLRenderTarget;
  // composer: EffectComposer;
  // outlinePass: OutlinePass;
  scene: THREE.Scene;
  dirLight: THREE.DirectionalLight;
  hemiLight: THREE.HemisphereLight;
  input: Input;
  camera: THREE.PerspectiveCamera;
  picker: Picker;
  selectionBackdrop: ScreenOverlay;
  selectedObject: THREE.Object3D | undefined;
  materialCache = new MaterialCache();
  layerErrors = new LayerErrors();
  colorScheme: "dark" | "light" | undefined;
  modelCache: ModelCache;
  renderables = new Map<string, THREE.Object3D>();
  transformTree = new TransformTree(TRANSFORM_STORAGE_TIME_NS);
  currentTime: bigint | undefined;
  fixedFrameId: string | undefined;
  renderFrameId: string | undefined;

  frameAxes = new FrameAxes(this);
  occupancyGrids = new OccupancyGrids(this);
  pointClouds = new PointClouds(this);
  markers = new Markers(this);

  constructor(canvas: HTMLCanvasElement) {
    super();

    // NOTE: Global side effect
    THREE.Object3D.DefaultUp = new THREE.Vector3(0, 0, 1);

    // TODO: Remove this hack when the user can set the renderFrameId themselves
    this.renderFrameId = "base_link";

    this.canvas = canvas;
    this.gl = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
    });
    if (!this.gl.capabilities.isWebGL2) {
      throw new Error("WebGL2 is not supported");
    }
    this.gl.outputEncoding = THREE.sRGBEncoding;
    this.gl.toneMapping = THREE.NoToneMapping;
    this.gl.autoClear = false;
    this.gl.info.autoReset = false;
    this.gl.shadowMap.enabled = false;
    this.gl.shadowMap.type = THREE.VSMShadowMap;
    this.gl.setPixelRatio(window.devicePixelRatio);

    let width = canvas.width;
    let height = canvas.height;
    if (canvas.parentElement) {
      width = canvas.parentElement.clientWidth;
      height = canvas.parentElement.clientHeight;
      this.gl.setSize(width, height);
    }

    this.modelCache = new ModelCache({ ignoreColladaUpAxis: true });

    this.scene = new THREE.Scene();
    this.scene.add(this.frameAxes);
    this.scene.add(this.occupancyGrids);
    this.scene.add(this.pointClouds);
    this.scene.add(this.markers);

    this.dirLight = new THREE.DirectionalLight();
    this.dirLight.position.set(1, 1, 1);
    this.dirLight.castShadow = true;
    this.dirLight.layers.enableAll();

    this.dirLight.shadow.mapSize.width = 2048;
    this.dirLight.shadow.mapSize.height = 2048;
    this.dirLight.shadow.camera.near = 0.5;
    this.dirLight.shadow.camera.far = 500;
    this.dirLight.shadow.bias = -0.00001;

    this.hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 0.5);
    this.hemiLight.layers.enableAll();

    this.scene.add(this.dirLight);
    this.scene.add(this.hemiLight);

    this.input = new Input(canvas);
    this.input.on("resize", (size) => this.resizeHandler(size));
    this.input.on("click", (cursorCoords) => this.clickHandler(cursorCoords));

    const fov = 79;
    const near = 0.01; // 1cm
    const far = 10_000; // 10km
    this.camera = new THREE.PerspectiveCamera(fov, width / height, near, far);
    this.camera.up.set(0, 0, 1);
    this.camera.position.set(1, -3, 1);
    this.camera.lookAt(0, 0, 0);

    this.picker = new Picker(this.gl, this.scene, this.camera, { debug: DEBUG_PICKING });

    this.selectionBackdrop = new ScreenOverlay();
    this.selectionBackdrop.visible = false;
    this.scene.add(this.selectionBackdrop);

    const samples = msaaSamples(this.maxLod, this.gl.capabilities);
    const renderSize = this.gl.getDrawingBufferSize(tempVec2);

    log.debug(`Initialized ${renderSize.width}x${renderSize.height} renderer (${samples}x MSAA)`);

    this.animationFrame();
  }

  dispose(): void {
    this.removeAllListeners();
    this.picker.dispose();
    this.input.dispose();
    this.frameAxes.dispose();
    this.occupancyGrids.dispose();
    this.pointClouds.dispose();
    this.markers.dispose();
    this.gl.dispose();
  }

  setColorScheme(colorScheme: "dark" | "light"): void {
    log.debug(`Setting color scheme to "${colorScheme}"`);
    this.colorScheme = colorScheme;
    if (colorScheme === "dark") {
      this.gl.setClearColor(DARK_BACKDROP);
      this.materialCache.outlineMaterial.color.set(DARK_OUTLINE);
      this.materialCache.outlineMaterial.needsUpdate = true;
    } else {
      this.gl.setClearColor(LIGHT_BACKDROP);
      this.materialCache.outlineMaterial.color.set(LIGHT_OUTLINE);
      this.materialCache.outlineMaterial.needsUpdate = true;
    }
  }

  addTransformMessage(tf: TF): void {
    this.frameAxes.addTransformMessage(tf);
  }

  addOccupancyGridMessage(topic: string, occupancyGrid: OccupancyGrid): void {
    this.occupancyGrids.addOccupancyGridMessage(topic, occupancyGrid);
  }

  addPointCloud2Message(topic: string, pointCloud: PointCloud2): void {
    this.pointClouds.addPointCloud2Message(topic, pointCloud);
  }

  addMarkerMessage(topic: string, marker: Marker): void {
    this.markers.addMarkerMessage(topic, marker);
  }

  markerWorldPosition(markerId: string): Readonly<THREE.Vector3> | undefined {
    const renderable = this.renderables.get(markerId);
    if (!renderable) {
      return undefined;
    }

    tempVec.set(0, 0, 0);
    tempVec.applyMatrix4(renderable.matrixWorld);
    return tempVec;
  }

  // Callback handlers

  animationFrame = (): void => {
    if (this.currentTime != undefined) {
      this.frameHandler(this.currentTime);
    }
  };

  frameHandler = (currentTime: bigint): void => {
    this.emit("startFrame", currentTime, this);

    this._updateFrames();
    this.materialCache.update(this.input.canvasSize);

    this.frameAxes.startFrame(currentTime);
    this.occupancyGrids.startFrame(currentTime);
    this.pointClouds.startFrame(currentTime);
    this.markers.startFrame(currentTime);

    this.gl.clear();
    this.camera.layers.set(LAYER_DEFAULT);
    this.selectionBackdrop.visible = this.selectedObject != undefined;
    this.gl.render(this.scene, this.camera);

    if (this.selectedObject) {
      this.gl.clearDepth();
      this.camera.layers.set(LAYER_SELECTED);
      this.selectionBackdrop.visible = false;
      this.gl.render(this.scene, this.camera);
    }

    this.emit("endFrame", currentTime, this);

    this.gl.info.reset();
  };

  /** Translate a Worldview CameraState to the three.js coordinate system */
  setCameraState(cameraState: CameraState): void {
    this.camera.position
      .setFromSpherical(
        tempSpherical.set(cameraState.distance, cameraState.phi, -cameraState.thetaOffset),
      )
      .applyAxisAngle(UNIT_X, PI_2);
    this.camera.position.add(
      tempVec.set(
        cameraState.targetOffset[0],
        cameraState.targetOffset[1],
        cameraState.targetOffset[2], // always 0 in Worldview CameraListener
      ),
    );
    this.camera.quaternion.setFromEuler(
      tempEuler.set(cameraState.phi, 0, -cameraState.thetaOffset, "ZYX"),
    );
    this.camera.updateProjectionMatrix();
  }

  resizeHandler = (size: THREE.Vector2): void => {
    this.gl.setPixelRatio(window.devicePixelRatio);
    this.gl.setSize(size.width, size.height);

    const renderSize = this.gl.getDrawingBufferSize(tempVec2);
    this.camera.aspect = renderSize.width / renderSize.height;
    this.camera.updateProjectionMatrix();

    log.debug(`Resized renderer to ${renderSize.width}x${renderSize.height}`);
    this.animationFrame();
  };

  clickHandler = (cursorCoords: THREE.Vector2): void => {
    // Deselect the currently selected object
    if (this.selectedObject) {
      deselectObject(this.selectedObject);
      this.selectedObject = undefined;
    }

    // Re-render the scene to update the render lists
    this.animationFrame();

    // Render a single pixel using a fragment shader that writes object IDs as
    // colors, then read the value of that single pixel back
    const objectId = this.picker.pick(cursorCoords.x, cursorCoords.y);
    if (objectId < 0) {
      log.debug(`Background selected`);
      this.emit("renderableSelected", undefined, this);
      return;
    }

    // Traverse the scene looking for this objectId
    const obj = this.scene.getObjectById(objectId);

    // Find the first ancestor of the clicked object that has a name
    // TODO: We should probably use a better way to identify the clicked object
    let selectedObj = obj;
    while (selectedObj && selectedObj.name === "") {
      selectedObj = selectedObj.parent ?? undefined;
    }
    this.selectedObject = selectedObj;

    if (!selectedObj) {
      log.warn(`No renderable found for objectId ${objectId}`);
      this.emit("renderableSelected", undefined, this);
      return;
    }

    // Select the newly selected object
    selectObject(selectedObj);
    this.emit("renderableSelected", selectedObj, this);
    log.debug(`Selected object ${selectedObj.name}`);

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!DEBUG_PICKING) {
      // Re-render with the selected object
      this.animationFrame();
    }
  };

  private _updateFrames(): void {
    const frameId = this.renderFrameId;
    if (frameId == undefined) {
      this.fixedFrameId = undefined;
      return;
    }

    const frame = this.transformTree.frame(frameId);
    if (!frame) {
      this.fixedFrameId = undefined;
      return;
    }

    const rootFrameId = frame.root().id;
    if (this.fixedFrameId !== rootFrameId) {
      log.debug(`Changing fixed frame from "${this.fixedFrameId}" to "${rootFrameId}"`);
      this.fixedFrameId = rootFrameId;
    }
  }
}

function selectObject(object: THREE.Object3D) {
  object.layers.set(LAYER_SELECTED);
  object.traverse((child) => {
    child.layers.set(LAYER_SELECTED);
  });
}

function deselectObject(object: THREE.Object3D) {
  object.layers.set(LAYER_DEFAULT);
  object.traverse((child) => {
    child.layers.set(LAYER_DEFAULT);
  });
}
