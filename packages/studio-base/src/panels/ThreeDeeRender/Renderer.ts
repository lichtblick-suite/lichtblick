// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import EventEmitter from "eventemitter3";
import { Immutable, produce } from "immer";
import * as THREE from "three";
import { DeepPartial } from "ts-essentials";
import { v4 as uuidv4 } from "uuid";

import Logger from "@foxglove/log";
import { CameraState } from "@foxglove/regl-worldview";
import { toNanoSec } from "@foxglove/rostime";
import { MessageEvent, Topic } from "@foxglove/studio";
import type * as CommonIcons from "@foxglove/studio-base/components/CommonIcons";
import {
  SettingsTreeAction,
  SettingsTreeNodeActionItem,
  SettingsTreeRoots,
} from "@foxglove/studio-base/components/SettingsTreeEditor/types";

import { Input } from "./Input";
import { Labels } from "./Labels";
import { MaterialCache } from "./MaterialCache";
import { ModelCache } from "./ModelCache";
import { Picker } from "./Picker";
import { SceneExtension } from "./SceneExtension";
import { ScreenOverlay } from "./ScreenOverlay";
import { SettingsManager, SettingsTreeEntry } from "./SettingsManager";
import { stringToRgb } from "./color";
import { DetailLevel, msaaSamples } from "./lod";
import { normalizeTFMessage, normalizeTransformStamped } from "./normalizeMessages";
import { Cameras } from "./renderables/Cameras";
import { CoreSettings } from "./renderables/CoreSettings";
import { FrameAxes, LayerSettingsTransform } from "./renderables/FrameAxes";
import { Grids } from "./renderables/Grids";
import { Images } from "./renderables/Images";
import { Markers } from "./renderables/Markers";
import { OccupancyGrids } from "./renderables/OccupancyGrids";
import { PointClouds } from "./renderables/PointClouds";
import { Polygons } from "./renderables/Polygons";
import { Poses } from "./renderables/Poses";
import {
  Header,
  TFMessage,
  TF_DATATYPES,
  TransformStamped,
  TRANSFORM_STAMPED_DATATYPES,
} from "./ros";
import { BaseSettings, CustomLayerSettings, SelectEntry } from "./settings";
import { Transform, TransformTree } from "./transforms";

const log = Logger.getLogger(__filename);

export type RendererEvents = {
  startFrame: (currentTime: bigint, renderer: Renderer) => void;
  endFrame: (currentTime: bigint, renderer: Renderer) => void;
  cameraMove: (renderer: Renderer) => void;
  renderableSelected: (renderable: THREE.Object3D | undefined, renderer: Renderer) => void;
  transformTreeUpdated: (renderer: Renderer) => void;
  settingsTreeChange: (renderer: Renderer) => void;
  configChange: (renderer: Renderer) => void;
};

export type RendererConfig = {
  /** Camera settings for the currently rendering scene */
  cameraState: CameraState;
  /** Coordinate frameId of the rendering frame */
  followTf: string | undefined;
  scene: {
    /** Show rendering metrics in a DOM overlay */
    enableStats?: boolean;
    /** Background color override for the scene, sent to `glClearColor()` */
    backgroundColor?: string;
  };
  /** frameId -> settings */
  transforms: Record<string, Partial<LayerSettingsTransform>>;
  /** topicName -> settings */
  topics: Record<string, Partial<BaseSettings> | undefined>;
  /** instanceId -> settings */
  layers: Record<string, Partial<CustomLayerSettings> | undefined>;
};

/** Callback for handling a message received on a topic */
export type MessageHandler = (messageEvent: MessageEvent<unknown>) => void;

/** Menu item entry and callback for the "Custom Layers" menu */
export type CustomLayerAction = {
  action: SettingsTreeNodeActionItem;
  handler: (instanceId: string) => void;
};

// Enable this to render the hitmap to the screen after clicking
const DEBUG_PICKING: true | false = false;

// NOTE: These do not use .convertSRGBToLinear() since background color is not
// affected by gamma correction
const LIGHT_BACKDROP = new THREE.Color(0xececec);
const DARK_BACKDROP = new THREE.Color(0x121217);

const LIGHT_OUTLINE = new THREE.Color(0x000000).convertSRGBToLinear();
const DARK_OUTLINE = new THREE.Color(0xffffff).convertSRGBToLinear();

// Define rendering layers for multipass rendering used for the selection effect
const LAYER_DEFAULT = 0;
const LAYER_SELECTED = 1;

// Keep a 60 second window of transforms by default
const TRANSFORM_STORAGE_TIME_NS = 60n * BigInt(1e9);

const UNIT_X = new THREE.Vector3(1, 0, 0);
const PI_2 = Math.PI / 2;

// Coordinate frames named in [REP-105](https://www.ros.org/reps/rep-0105.html)
const DEFAULT_FRAME_IDS = ["base_link", "odom", "map", "earth"];

// An extensionId for injecting the "Custom Layers" node and its menu actions
const CUSTOM_LAYERS_ID = "foxglove.CustomLayers";

const tempColor = new THREE.Color();
const tempVec = new THREE.Vector3();
const tempVec2 = new THREE.Vector2();
const tempSpherical = new THREE.Spherical();
const tempEuler = new THREE.Euler();

/**
 * An extensible 3D renderer attached to a `HTMLCanvasElement`,
 * `WebGLRenderingContext`, and `SettingsTree`.
 */
export class Renderer extends EventEmitter<RendererEvents> {
  canvas: HTMLCanvasElement;
  gl: THREE.WebGLRenderer;
  maxLod = DetailLevel.High;
  config: Immutable<RendererConfig>;
  settings: SettingsManager;
  topics: ReadonlyArray<Topic> | undefined;
  // extensionId -> SceneExtension
  sceneExtensions = new Map<string, SceneExtension>();
  // datatype -> handler[]
  datatypeHandlers = new Map<string, MessageHandler[]>();
  // layerId -> { action, handler }
  customLayerActions = new Map<string, CustomLayerAction>();
  scene: THREE.Scene;
  dirLight: THREE.DirectionalLight;
  hemiLight: THREE.HemisphereLight;
  input: Input;
  camera: THREE.PerspectiveCamera;
  picker: Picker;
  selectionBackdrop: ScreenOverlay;
  selectedObject: THREE.Object3D | undefined;
  materialCache = new MaterialCache();
  colorScheme: "dark" | "light" = "light";
  modelCache: ModelCache;
  transformTree = new TransformTree(TRANSFORM_STORAGE_TIME_NS);
  coordinateFrameList: SelectEntry[] = [];
  currentTime: bigint | undefined;
  fixedFrameId: string | undefined;
  renderFrameId: string | undefined;

  labels = new Labels(this);

  constructor(canvas: HTMLCanvasElement, config: RendererConfig) {
    super();

    // NOTE: Global side effect
    THREE.Object3D.DefaultUp = new THREE.Vector3(0, 0, 1);

    this.settings = new SettingsManager(baseSettingsTree());
    this.settings.on("update", () => this.emit("settingsTreeChange", this));
    // Add the "Custom Layers" node first so merging happens in the correct order.
    // Another approach would be to modify SettingsManager to allow merging parent
    // nodes in after their children
    this.settings.setNodesForKey(CUSTOM_LAYERS_ID, []);

    this.canvas = canvas;
    this.config = config;
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
    this.gl.sortObjects = false;
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
    this.scene.add(this.labels);

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

    this.renderFrameId = config.followTf;

    const samples = msaaSamples(this.maxLod, this.gl.capabilities);
    const renderSize = this.gl.getDrawingBufferSize(tempVec2);
    log.debug(`Initialized ${renderSize.width}x${renderSize.height} renderer (${samples}x MSAA)`);

    this.addSceneExtension(new CoreSettings(this));
    this.addSceneExtension(new Cameras(this));
    this.addSceneExtension(new FrameAxes(this));
    this.addSceneExtension(new Grids(this));
    this.addSceneExtension(new Images(this));
    this.addSceneExtension(new Markers(this));
    this.addSceneExtension(new OccupancyGrids(this));
    this.addSceneExtension(new PointClouds(this));
    this.addSceneExtension(new Polygons(this));
    this.addSceneExtension(new Poses(this));

    this.animationFrame();
  }

  dispose(): void {
    this.removeAllListeners();

    for (const extension of this.sceneExtensions.values()) {
      extension.dispose();
    }
    this.sceneExtensions.clear();

    this.picker.dispose();
    this.input.dispose();
    this.gl.dispose();
  }

  addSceneExtension(extension: SceneExtension): void {
    if (this.sceneExtensions.has(extension.extensionId)) {
      throw new Error(`Attempted to add duplicate extensionId "${extension.extensionId}"`);
    }
    this.sceneExtensions.set(extension.extensionId, extension);
    this.scene.add(extension);
  }

  updateConfig(updateHandler: (draft: RendererConfig) => void): void {
    this.config = produce(this.config, updateHandler);
    this.emit("configChange", this);
  }

  addDatatypeSubscriptions<T>(
    datatypes: Iterable<string>,
    handler: (messageEvent: MessageEvent<T>) => void,
  ): void {
    const genericHandler = handler as (messageEvent: MessageEvent<unknown>) => void;
    for (const datatype of datatypes) {
      let handlers = this.datatypeHandlers.get(datatype);
      if (!handlers) {
        handlers = [];
        this.datatypeHandlers.set(datatype, handlers);
      }
      if (!handlers.includes(genericHandler)) {
        handlers.push(genericHandler);
      }
    }
  }

  addCustomLayerAction(options: {
    layerId: string;
    label: string;
    icon?: keyof typeof CommonIcons;
    handler: (instanceId: string) => void;
  }): void {
    const handler = options.handler;
    // A unique id is assigned to each action to deduplicate selection events
    // The layerId is used to map selection events back to their handlers
    const instanceId = uuidv4();
    const action: SettingsTreeNodeActionItem = {
      type: "action",
      id: `${options.layerId}-${instanceId}`,
      label: options.label,
      icon: options.icon,
    };
    this.customLayerActions.set(options.layerId, { action, handler });

    // Rebuild the "Custom Layers" settings tree node
    const actions: SettingsTreeNodeActionItem[] = Array.from(this.customLayerActions.values()).map(
      (entry) => entry.action,
    );
    const entry: SettingsTreeEntry = {
      path: ["layers"],
      node: {
        label: "Custom Layers",
        defaultExpansionState: "expanded",
        actions,
        handler: this.handleCustomLayersAction,
      },
    };
    this.settings.setNodesForKey(CUSTOM_LAYERS_ID, [entry]);
  }

  defaultFrameId(): string | undefined {
    // Prefer frames from [REP-105](https://www.ros.org/reps/rep-0105.html)
    for (const frameId of DEFAULT_FRAME_IDS) {
      const frame = this.transformTree.frame(frameId);
      if (frame) {
        return frame.id;
      }
    }

    // Choose the root frame with the most children
    const rootsToCounts = new Map<string, number>();
    for (const frame of this.transformTree.frames().values()) {
      const rootId = frame.root().id;
      rootsToCounts.set(rootId, (rootsToCounts.get(rootId) ?? 0) + 1);
    }
    const rootsArray = Array.from(rootsToCounts.entries());
    const rootId = rootsArray.sort((a, b) => b[1] - a[1])[0]?.[0];
    return rootId;
  }

  /** Update the color scheme and background color, rebuilding any materials as necessary */
  setColorScheme(colorScheme: "dark" | "light", backgroundColor: string | undefined): void {
    this.colorScheme = colorScheme;

    const bgColor = backgroundColor ? stringToRgb(tempColor, backgroundColor) : undefined;

    for (const extension of this.sceneExtensions.values()) {
      extension.setColorScheme(colorScheme, bgColor);
    }

    this.labels.setColorScheme(colorScheme, bgColor);

    if (colorScheme === "dark") {
      this.gl.setClearColor(bgColor ?? DARK_BACKDROP);
      this.materialCache.outlineMaterial.color.set(DARK_OUTLINE);
      this.materialCache.outlineMaterial.needsUpdate = true;
    } else {
      this.gl.setClearColor(bgColor ?? LIGHT_BACKDROP);
      this.materialCache.outlineMaterial.color.set(LIGHT_OUTLINE);
      this.materialCache.outlineMaterial.needsUpdate = true;
    }
  }

  /** Update the list of topics and rebuild all settings nodes when the identity
   * of the topics list changes */
  setTopics(topics: ReadonlyArray<Topic> | undefined): void {
    const changed = this.topics !== topics;
    this.topics = topics;
    if (changed) {
      // Rebuild the settings nodes for all scene extensions
      for (const extension of this.sceneExtensions.values()) {
        this.settings.setNodesForKey(extension.extensionId, extension.settingsNodes());
      }
    }
  }

  /** Translate a @foxglove/regl-worldview CameraState to the three.js coordinate system */
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
    this.camera.fov = cameraState.fovy * (180 / Math.PI);
    this.camera.near = cameraState.near;
    this.camera.far = cameraState.far;
    this.camera.updateProjectionMatrix();

    this.emit("cameraMove", this);
  }

  addMessageEvent(messageEvent: Readonly<MessageEvent<unknown>>, datatype: string): void {
    const { message } = messageEvent;

    // If this message has a Header, scrape the frame_id from it
    const maybeHasHeader = message as Partial<{ header: Partial<Header> }>;
    if (maybeHasHeader.header) {
      const frameId = maybeHasHeader.header.frame_id ?? "";
      this.addCoordinateFrame(frameId);
    }

    if (TF_DATATYPES.has(datatype)) {
      // tf2_msgs/TFMessage - Ingest the list of transforms into our TF tree
      const tfMessage = normalizeTFMessage(message as DeepPartial<TFMessage>);
      for (const tf of tfMessage.transforms) {
        this.addTransformMessage(tf);
      }
    } else if (TRANSFORM_STAMPED_DATATYPES.has(datatype)) {
      // geometry_msgs/TransformStamped - Ingest this single transform into our TF tree
      const tf = normalizeTransformStamped(message as DeepPartial<TransformStamped>);
      this.addTransformMessage(tf);
    }

    const handlers = this.datatypeHandlers.get(datatype);
    if (handlers) {
      for (const handler of handlers) {
        handler(messageEvent);
      }
    }
  }

  addCoordinateFrame(frameId: string): void {
    if (!this.transformTree.hasFrame(frameId)) {
      this.transformTree.getOrCreateFrame(frameId);
      this.coordinateFrameList = this.transformTree.frameList();
      log.debug(`Added coordinate frame "${frameId}"`);
      this.emit("transformTreeUpdated", this);
    }
  }

  addTransformMessage(tf: TransformStamped): void {
    const addParent = !this.transformTree.hasFrame(tf.header.frame_id);
    const addChild = !this.transformTree.hasFrame(tf.child_frame_id);

    // Create a new transform and add it to the renderer's TransformTree
    const stamp = toNanoSec(tf.header.stamp);
    const t = tf.transform.translation;
    const q = tf.transform.rotation;
    const transform = new Transform([t.x, t.y, t.z], [q.x, q.y, q.z, q.w]);
    const updated = this.transformTree.addTransform(
      tf.child_frame_id,
      tf.header.frame_id,
      stamp,
      transform,
    );

    if (addParent || addChild) {
      this.coordinateFrameList = this.transformTree.frameList();
      log.debug(`Added transform "${tf.header.frame_id}_T_${tf.child_frame_id}"`);
      this.emit("transformTreeUpdated", this);
    } else if (updated) {
      this.coordinateFrameList = this.transformTree.frameList();
      log.debug(`Updated transform "${tf.header.frame_id}_T_${tf.child_frame_id}"`);
      this.emit("transformTreeUpdated", this);
    }
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

    this.gl.clear();
    this.camera.layers.set(LAYER_DEFAULT);
    this.selectionBackdrop.visible = this.selectedObject != undefined;

    const renderFrameId = this.renderFrameId;
    const fixedFrameId = this.fixedFrameId;
    if (renderFrameId == undefined || fixedFrameId == undefined) {
      return;
    }

    for (const sceneExtension of this.sceneExtensions.values()) {
      sceneExtension.startFrame(currentTime, renderFrameId, fixedFrameId);
    }

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
    // Deselect the currently selected object, if one is selected
    let prevSelected: THREE.Object3D | undefined;
    if (this.selectedObject) {
      prevSelected = this.selectedObject;
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

    // Find the first ancestor of the clicked object that has a Pose
    let selectedObj = obj;
    while (selectedObj && selectedObj.userData.pose == undefined) {
      selectedObj = selectedObj.parent ?? undefined;
    }

    if (selectedObj === prevSelected) {
      log.debug(
        `Deselecting previously selected object ${prevSelected?.id} (${prevSelected?.name})`,
      );
      if (!DEBUG_PICKING) {
        // Re-render with no object selected
        this.animationFrame();
      }
      return;
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
    log.debug(`Selected object ${selectedObj.id} (${selectedObj.name})`);

    if (!DEBUG_PICKING) {
      // Re-render with the selected object
      this.animationFrame();
    }
  };

  handleCustomLayersAction = (action: SettingsTreeAction): void => {
    const path = action.payload.path;
    if (action.action !== "perform-node-action" || path.length !== 1 || path[0] !== "layers") {
      return;
    }

    log.debug(`handleCustomLayersAction(${action.payload.id})`);

    // Remove `-{uuid}` from the actionId to get the layerId
    const actionId = action.payload.id;
    const layerId = actionId.slice(0, -37);
    const instanceId = actionId.slice(-36);

    const entry = this.customLayerActions.get(layerId);
    if (!entry) {
      throw new Error(`No custom layer action found for "${layerId}"`);
    }

    // Regenerate the action menu entry with a new instanceId. The unique instanceId is generated
    // here so we can deduplicate multiple callbacks for the same menu click event
    const { label, icon } = entry.action;
    this.addCustomLayerAction({ layerId, label, icon, handler: entry.handler });

    // Trigger the add custom layer action handler
    entry.handler(instanceId);
  };

  private _updateFrames(): void {
    if (this.renderFrameId == undefined) {
      this.renderFrameId = this.defaultFrameId();

      if (this.renderFrameId == undefined) {
        this.fixedFrameId = undefined;
        return;
      } else {
        log.debug(`Setting render frame to ${this.renderFrameId}`);
      }
    }

    const frame = this.transformTree.frame(this.renderFrameId);
    if (!frame) {
      this.fixedFrameId = undefined;
      return;
    }

    const rootFrameId = frame.root().id;
    if (this.fixedFrameId !== rootFrameId) {
      if (this.fixedFrameId == undefined) {
        log.debug(`Setting fixed frame to ${rootFrameId}`);
      } else {
        log.debug(`Changing fixed frame from "${this.fixedFrameId}" to "${rootFrameId}"`);
      }
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

// Creates a skeleton settings tree. The tree contents are filled in by scene extensions
function baseSettingsTree(): SettingsTreeRoots {
  return {
    general: {},
    scene: {},
    cameraState: {},
    transforms: {
      label: "Transforms",
      defaultExpansionState: "expanded",
    },
    topics: {
      label: "Topics",
      defaultExpansionState: "expanded",
    },
  };
}
