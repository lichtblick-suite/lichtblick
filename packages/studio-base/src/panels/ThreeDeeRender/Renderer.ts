// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import EventEmitter from "eventemitter3";
import { Immutable, produce } from "immer";
import * as THREE from "three";
import { DeepPartial } from "ts-essentials";

import Logger from "@foxglove/log";
import { CameraState } from "@foxglove/regl-worldview";
import { toNanoSec } from "@foxglove/rostime";
import { MessageEvent } from "@foxglove/studio";

import { Input } from "./Input";
import { Labels } from "./Labels";
import { LayerErrors } from "./LayerErrors";
import { MaterialCache } from "./MaterialCache";
import { ModelCache } from "./ModelCache";
import { Picker } from "./Picker";
import { ScreenOverlay } from "./ScreenOverlay";
import { stringToRgb } from "./color";
import { DetailLevel, msaaSamples } from "./lod";
import {
  normalizeCameraInfo,
  normalizeCompressedImage,
  normalizeImage,
  normalizeMarker,
  normalizePolygonStamped,
  normalizePoseStamped,
  normalizePoseWithCovarianceStamped,
} from "./normalizeMessages";
import { Cameras } from "./renderables/Cameras";
import { FrameAxes } from "./renderables/FrameAxes";
import { Grids } from "./renderables/Grids";
import { Images } from "./renderables/Images";
import { Markers } from "./renderables/Markers";
import { OccupancyGrids } from "./renderables/OccupancyGrids";
import { PointClouds } from "./renderables/PointClouds";
import { Polygons } from "./renderables/Polygons";
import { Poses } from "./renderables/Poses";
import {
  CAMERA_INFO_DATATYPES,
  CameraInfo,
  COMPRESSED_IMAGE_DATATYPES,
  CompressedImage,
  Header,
  IMAGE_DATATYPES,
  Image,
  MARKER_ARRAY_DATATYPES,
  MARKER_DATATYPES,
  Marker,
  MarkerArray,
  OCCUPANCY_GRID_DATATYPES,
  OccupancyGrid,
  POINTCLOUD_DATATYPES,
  PointCloud2,
  POLYGON_STAMPED_DATATYPES,
  PolygonStamped,
  POSE_STAMPED_DATATYPES,
  POSE_WITH_COVARIANCE_STAMPED_DATATYPES,
  PoseStamped,
  PoseWithCovarianceStamped,
  TF_DATATYPES,
  TF,
  TRANSFORM_STAMPED_DATATYPES,
} from "./ros";
import {
  LayerSettingsCameraInfo,
  LayerSettingsGrid,
  LayerSettingsImage,
  LayerSettingsMarker,
  LayerSettingsMarkerNamespace,
  LayerSettingsOccupancyGrid,
  LayerSettingsPointCloud2,
  LayerSettingsPolygon,
  LayerSettingsPose,
  LayerSettingsTransform,
  LayerType,
  SettingsNodeProvider,
  ThreeDeeRenderConfig,
} from "./settings";
import { TransformTree } from "./transforms/TransformTree";

const log = Logger.getLogger(__filename);

export type RendererEvents = {
  startFrame: (currentTime: bigint, renderer: Renderer) => void;
  endFrame: (currentTime: bigint, renderer: Renderer) => void;
  cameraMove: (renderer: Renderer) => void;
  renderableSelected: (renderable: THREE.Object3D | undefined, renderer: Renderer) => void;
  transformTreeUpdated: (renderer: Renderer) => void;
  settingsTreeChange: (update: { path: string[] }) => void;
  layerErrorUpdate: (
    path: ReadonlyArray<string>,
    errorId: string | undefined,
    errorMessage: string | undefined,
    renderer: Renderer,
  ) => void;
};

const DEBUG_PICKING: true | false = false;

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

const TRANSFORMS_PATH = ["transforms"];

export const SUPPORTED_DATATYPES = new Set<string>();
mergeSetInto(SUPPORTED_DATATYPES, TRANSFORM_STAMPED_DATATYPES);
mergeSetInto(SUPPORTED_DATATYPES, TF_DATATYPES);
mergeSetInto(SUPPORTED_DATATYPES, MARKER_DATATYPES);
mergeSetInto(SUPPORTED_DATATYPES, MARKER_ARRAY_DATATYPES);
mergeSetInto(SUPPORTED_DATATYPES, OCCUPANCY_GRID_DATATYPES);
mergeSetInto(SUPPORTED_DATATYPES, POINTCLOUD_DATATYPES);
mergeSetInto(SUPPORTED_DATATYPES, POLYGON_STAMPED_DATATYPES);
mergeSetInto(SUPPORTED_DATATYPES, POSE_STAMPED_DATATYPES);
mergeSetInto(SUPPORTED_DATATYPES, POSE_WITH_COVARIANCE_STAMPED_DATATYPES);
mergeSetInto(SUPPORTED_DATATYPES, CAMERA_INFO_DATATYPES);
mergeSetInto(SUPPORTED_DATATYPES, IMAGE_DATATYPES);
mergeSetInto(SUPPORTED_DATATYPES, COMPRESSED_IMAGE_DATATYPES);

const tempColor = new THREE.Color();
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
  config: Immutable<ThreeDeeRenderConfig>;
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
  colorScheme: "dark" | "light" = "light";
  modelCache: ModelCache;
  transformTree = new TransformTree(TRANSFORM_STORAGE_TIME_NS);
  currentTime: bigint | undefined;
  fixedFrameId: string | undefined;
  renderFrameId: string | undefined;
  settingsNodeProviders = new Map<LayerType, SettingsNodeProvider>();

  labels = new Labels(this);
  frameAxes = new FrameAxes(this);
  occupancyGrids = new OccupancyGrids(this);
  pointClouds = new PointClouds(this);
  markers = new Markers(this);
  polygons = new Polygons(this);
  poses = new Poses(this);
  cameras = new Cameras(this);
  images = new Images(this);
  grids = new Grids(this);

  constructor(canvas: HTMLCanvasElement, config: ThreeDeeRenderConfig) {
    super();

    // NOTE: Global side effect
    THREE.Object3D.DefaultUp = new THREE.Vector3(0, 0, 1);

    this.layerErrors.on("update", (path, errorId, errorMessage) =>
      this.emit("layerErrorUpdate", path, errorId, errorMessage, this),
    );
    this.layerErrors.on("remove", (path, errorId) =>
      this.emit("layerErrorUpdate", path, errorId, undefined, this),
    );
    this.layerErrors.on("clear", (path) =>
      this.emit("layerErrorUpdate", path, undefined, undefined, this),
    );

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
    this.scene.add(this.frameAxes);
    this.scene.add(this.occupancyGrids);
    this.scene.add(this.pointClouds);
    this.scene.add(this.markers);
    this.scene.add(this.polygons);
    this.scene.add(this.poses);
    this.scene.add(this.cameras);
    this.scene.add(this.images);
    this.scene.add(this.grids);

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

  updateConfig(updateHandler: (draft: ThreeDeeRenderConfig) => void): void {
    this.config = produce(this.config, updateHandler);
  }

  setSettingsNodeProvider(layerType: LayerType, provider: SettingsNodeProvider): void {
    this.settingsNodeProviders.set(layerType, provider);
    this.settingsNodeProviders = new Map(this.settingsNodeProviders);
  }

  setColorScheme(colorScheme: "dark" | "light", backgroundColor: string | undefined): void {
    this.colorScheme = colorScheme;

    const bgColor = backgroundColor ? stringToRgb(tempColor, backgroundColor) : undefined;

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

  addMessageEvent(messageEvent: Readonly<MessageEvent<unknown>>, datatype: string): void {
    const { topic, message } = messageEvent;

    // If this message has a Header, scrape the frame_id from it
    const maybeHasHeader = message as Partial<{ header: Partial<Header> }>;
    if (maybeHasHeader.header) {
      const frameId = maybeHasHeader.header.frame_id ?? "";
      if (!this.transformTree.hasFrame(frameId)) {
        this.transformTree.getOrCreateFrame(frameId);
        log.debug(`Added coordinate frame "${frameId}"`);
        this.emit("transformTreeUpdated", this);
        this.frameAxes.addCoordinateFrame(frameId);
      }
    }

    if (TF_DATATYPES.has(datatype)) {
      // tf2_msgs/TFMessage - Ingest the list of transforms into our TF tree
      const tfMessage = message as { transforms: TF[] };
      for (const tf of tfMessage.transforms) {
        this.frameAxes.addTransformMessage(tf);
      }
      this.emit("settingsTreeChange", { path: TRANSFORMS_PATH });
    } else if (TRANSFORM_STAMPED_DATATYPES.has(datatype)) {
      // geometry_msgs/TransformStamped - Ingest this single transform into our TF tree
      const tf = message as TF;
      this.frameAxes.addTransformMessage(tf);
      this.emit("settingsTreeChange", { path: TRANSFORMS_PATH });
    } else if (MARKER_ARRAY_DATATYPES.has(datatype)) {
      // visualization_msgs/MarkerArray - Ingest the list of markers
      const receiveTime = toNanoSec(messageEvent.receiveTime);
      const markerArray = message as DeepPartial<MarkerArray>;
      for (const markerMsg of markerArray.markers ?? []) {
        const marker = normalizeMarker(markerMsg);
        this.markers.addMarkerMessage(topic, marker, receiveTime);
      }
    } else if (MARKER_DATATYPES.has(datatype)) {
      // visualization_msgs/Marker - Ingest this single marker
      const receiveTime = toNanoSec(messageEvent.receiveTime);
      const marker = normalizeMarker(message as DeepPartial<Marker>);
      this.markers.addMarkerMessage(topic, marker, receiveTime);
    } else if (OCCUPANCY_GRID_DATATYPES.has(datatype)) {
      // nav_msgs/OccupancyGrid - Ingest this occupancy grid
      const occupancyGrid = message as OccupancyGrid;
      this.occupancyGrids.addOccupancyGridMessage(topic, occupancyGrid);
    } else if (POINTCLOUD_DATATYPES.has(datatype)) {
      // sensor_msgs/PointCloud2 - Ingest this point cloud
      const pointCloud = message as PointCloud2;
      this.pointClouds.addPointCloud2Message(topic, pointCloud);
    } else if (POSE_STAMPED_DATATYPES.has(datatype)) {
      const poseStamped = normalizePoseStamped(message as DeepPartial<PoseStamped>);
      this.poses.addPoseMessage(topic, poseStamped);
    } else if (POSE_WITH_COVARIANCE_STAMPED_DATATYPES.has(datatype)) {
      const poseWithCovariance = normalizePoseWithCovarianceStamped(
        message as DeepPartial<PoseWithCovarianceStamped>,
      );
      this.poses.addPoseMessage(topic, poseWithCovariance);
    } else if (POLYGON_STAMPED_DATATYPES.has(datatype)) {
      const polygonStamped = normalizePolygonStamped(message as DeepPartial<PolygonStamped>);
      this.polygons.addPolygonStamped(topic, polygonStamped);
    } else if (CAMERA_INFO_DATATYPES.has(datatype)) {
      const cameraInfo = normalizeCameraInfo(message as DeepPartial<CameraInfo>);
      this.cameras.addCameraInfoMessage(topic, cameraInfo);
      this.images.addCameraInfoMessage(topic, cameraInfo);
    } else if (IMAGE_DATATYPES.has(datatype)) {
      const image = normalizeImage(message as DeepPartial<Image>);
      this.images.addImageMessage(topic, image);
    } else if (COMPRESSED_IMAGE_DATATYPES.has(datatype)) {
      const compressedImage = normalizeCompressedImage(message as DeepPartial<CompressedImage>);
      this.images.addImageMessage(topic, compressedImage);
    }
  }

  setTransformSettings(frameId: string, settings: Partial<LayerSettingsTransform>): void {
    this.frameAxes.setTransformSettings(frameId, settings);
  }

  setOccupancyGridSettings(topic: string, settings: Partial<LayerSettingsOccupancyGrid>): void {
    this.occupancyGrids.setTopicSettings(topic, settings);
  }

  setPointCloud2Settings(topic: string, settings: Partial<LayerSettingsPointCloud2>): void {
    this.pointClouds.setTopicSettings(topic, settings);
  }

  setMarkerSettings(topic: string, settings: Record<string, unknown>): void {
    // Convert the { visible, ns:a, ns:b, ... } format to { visible, namespaces: { a, b, ... } }
    const topicSettings: DeepPartial<LayerSettingsMarker> = { namespaces: {} };
    topicSettings.visible = settings.visible as boolean | undefined;
    for (const [key, value] of Object.entries(settings)) {
      if (key.startsWith("ns:")) {
        const ns = key.substring(3);
        topicSettings.namespaces![ns] = value as Partial<LayerSettingsMarkerNamespace>;
      }
    }

    this.markers.setTopicSettings(topic, topicSettings);
  }

  setPolygonSettings(topic: string, settings: Partial<LayerSettingsPolygon>): void {
    this.polygons.setTopicSettings(topic, settings);
  }

  setPoseSettings(topic: string, settings: Partial<LayerSettingsPose>): void {
    this.poses.setTopicSettings(topic, settings);
  }

  setCameraInfoSettings(topic: string, settings: Partial<LayerSettingsCameraInfo>): void {
    this.cameras.setTopicSettings(topic, settings);
  }

  setImageSettings(topic: string, settings: Partial<LayerSettingsImage>): void {
    this.images.setTopicSettings(topic, settings);
  }

  setGridSettings(id: string, settings: Partial<LayerSettingsGrid> | undefined): void {
    this.grids.setLayerSettings(id, settings);
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
    this.polygons.startFrame(currentTime);
    this.poses.startFrame(currentTime);
    this.cameras.startFrame(currentTime);
    this.images.startFrame(currentTime);
    this.grids.startFrame(currentTime);

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
    this.camera.fov = cameraState.fovy * (180 / Math.PI);
    this.camera.near = cameraState.near;
    this.camera.far = cameraState.far;
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
      log.debug(`Deselecting previously selected object ${prevSelected?.id}`);
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
    log.debug(`Selected object ${selectedObj.name}`);

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

function mergeSetInto(output: Set<string>, input: ReadonlySet<string>) {
  for (const value of input) {
    output.add(value);
  }
}
