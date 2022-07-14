// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { maxBy } from "lodash";

import { UrdfGeometryMesh, UrdfRobot, UrdfVisual, parseRobot } from "@foxglove/den/urdf";
import Logger from "@foxglove/log";
import { Pose } from "@foxglove/regl-worldview";
import { SettingsTreeAction, SettingsTreeFields } from "@foxglove/studio";
import { eulerToQuaternion } from "@foxglove/studio-base/util/geometry";
import isDesktopApp from "@foxglove/studio-base/util/isDesktopApp";

import { BaseUserData, Renderable } from "../Renderable";
import { Renderer } from "../Renderer";
import { PartialMessageEvent, SceneExtension } from "../SceneExtension";
import { SettingsTreeEntry } from "../SettingsManager";
import { ColorRGBA, Marker, MarkerAction, MarkerType, Quaternion, Vector3 } from "../ros";
import { BaseSettings, CustomLayerSettings } from "../settings";
import { makePose } from "../transforms";
import { updatePose } from "../updatePose";
import { RenderableCube } from "./markers/RenderableCube";
import { RenderableCylinder } from "./markers/RenderableCylinder";
import { RenderableMeshResource } from "./markers/RenderableMeshResource";
import { RenderableSphere } from "./markers/RenderableSphere";
import { missingTransformMessage, MISSING_TRANSFORM } from "./transforms";

const log = Logger.getLogger(__filename);

const LAYER_ID = "foxglove.Urdf";
const TOPIC_NAME = "/robot_description"; // Also doubles as the ROS parameter name

const VALID_URL_ERR = "ValidUrl";
const FETCH_URDF_ERR = "FetchUrdf";
const PARSE_URDF_ERR = "ParseUrdf";

const DEFAULT_COLOR = { r: 1, g: 1, b: 1, a: 1 };
const VEC3_ONE = { x: 1, y: 1, z: 1 };

export type LayerSettingsUrdf = BaseSettings & {
  instanceId: string; // This will be set to the topic name
};

export type LayerSettingsCustomUrdf = CustomLayerSettings & {
  layerId: "foxglove.Urdf";
  url: string;
};

const DEFAULT_SETTINGS: LayerSettingsUrdf = {
  visible: false,
  frameLocked: true,
  instanceId: "invalid",
};

const DEFAULT_CUSTOM_SETTINGS: LayerSettingsCustomUrdf = {
  visible: true,
  frameLocked: true,
  label: "URDF",
  instanceId: "invalid",
  layerId: LAYER_ID,
  url: "",
};

export type UrdfUserData = BaseUserData & {
  settings: LayerSettingsUrdf | LayerSettingsCustomUrdf;
  fetching?: { url: string; control: AbortController };
  url: string | undefined;
  urdf: string | undefined;
  renderables: Map<string, Renderable>;
};

enum EmbeddedMaterialUsage {
  Use,
  Ignore,
}

type TransformData = {
  parent: string;
  child: string;
  translation: Vector3;
  rotation: Quaternion;
};

type ParsedUrdf = {
  robot: UrdfRobot;
  transforms: TransformData[];
};

// One day we can think about using feature detection. Until that day comes we acknowledge the
// realities of only having two platforms: web and desktop.
const supportsPackageUrl = isDesktopApp();

export class UrdfRenderable extends Renderable<UrdfUserData> {
  override dispose(): void {
    this.removeChildren();
    this.userData.urdf = undefined;
    super.dispose();
  }

  removeChildren(): void {
    for (const childRenderable of this.userData.renderables.values()) {
      childRenderable.dispose();
    }
    this.children.length = 0;
    this.userData.renderables.clear();
  }
}

export class Urdfs extends SceneExtension<UrdfRenderable> {
  constructor(renderer: Renderer) {
    super("foxglove.Urdfs", renderer);

    renderer.addTopicSubscription(TOPIC_NAME, this.handleRobotDescription);
    renderer.on("parametersChange", this.handleParametersChange);
    renderer.addCustomLayerAction({
      layerId: LAYER_ID,
      label: "Add Unified Robot Description Format (URDF)",
      icon: "PrecisionManufacturing",
      handler: this.handleAddUrdf,
    });

    // Load existing URDF layers from the config
    for (const [instanceId, entry] of Object.entries(renderer.config.layers)) {
      if (entry?.layerId === LAYER_ID) {
        this._loadUrdf(instanceId, undefined);
      }
    }
  }

  override settingsNodes(): SettingsTreeEntry[] {
    const configTopics = this.renderer.config.topics;
    const topicHandler = this.handleTopicSettingsAction;
    const layerHandler = this.handleLayerSettingsAction;
    const entries: SettingsTreeEntry[] = [];

    // Topic entry (also used for `/robot_description` parameter)
    const topic = this.renderer.topicsByName?.get(TOPIC_NAME);
    const parameter = this.renderer.parameters?.get(TOPIC_NAME);
    if (topic != undefined || parameter != undefined) {
      const config = (configTopics[TOPIC_NAME] ?? {}) as Partial<LayerSettingsUrdf>;

      const fields: SettingsTreeFields = {};

      entries.push({
        path: ["topics", TOPIC_NAME],
        node: {
          label: TOPIC_NAME,
          icon: "PrecisionManufacturing",
          fields,
          visible: config.visible ?? DEFAULT_SETTINGS.visible,
          handler: topicHandler,
        },
      });
    }

    // Custom layer entries
    for (const [instanceId, layerConfig] of Object.entries(this.renderer.config.layers)) {
      if (layerConfig?.layerId === LAYER_ID) {
        const config = layerConfig as Partial<LayerSettingsCustomUrdf>;
        const placeholder = supportsPackageUrl ? "package://" : undefined;
        const help = supportsPackageUrl
          ? "package:// URL or http(s) URL pointing to a Unified Robot Description Format (URDF) XML file"
          : "http(s) URL pointing to a Unified Robot Description Format (URDF) XML file";

        const fields: SettingsTreeFields = {
          url: { label: "URL", input: "string", placeholder, help, value: config.url ?? "" },
        };

        entries.push({
          path: ["layers", instanceId],
          node: {
            label: config.label ?? "Grid",
            icon: "PrecisionManufacturing",
            fields,
            visible: config.visible ?? DEFAULT_CUSTOM_SETTINGS.visible,
            actions: [{ type: "action", id: "delete", label: "Delete" }],
            order: layerConfig.order,
            handler: layerHandler,
          },
        });
      }
    }

    return entries;
  }

  override removeAllRenderables(): void {
    // no-op
  }

  override startFrame(currentTime: bigint, renderFrameId: string, fixedFrameId: string): void {
    for (const renderable of this.renderables.values()) {
      const path = renderable.userData.settingsPath;
      let hasTfError = false;

      renderable.visible = renderable.userData.settings.visible;
      if (!renderable.visible) {
        this.renderer.settings.errors.clearPath(path);
        continue;
      }

      // UrdfRenderables always stay at the origin. Their children renderables
      // are individually updated since each child exists in a different frame
      for (const childRenderable of renderable.userData.renderables.values()) {
        const srcTime = currentTime;
        const frameId = childRenderable.userData.frameId;
        const updated = updatePose(
          childRenderable,
          this.renderer.transformTree,
          renderFrameId,
          fixedFrameId,
          frameId,
          currentTime,
          srcTime,
        );
        if (!updated) {
          const message = missingTransformMessage(renderFrameId, fixedFrameId, frameId);
          this.renderer.settings.errors.add(path, MISSING_TRANSFORM, message);
          hasTfError = true;
        }
      }

      if (!hasTfError) {
        this.renderer.settings.errors.remove(path, MISSING_TRANSFORM);
      }
    }
  }

  handleTopicSettingsAction = (_action: SettingsTreeAction): void => {
    // no-op until there are editable fields for URDF topics
  };

  handleLayerSettingsAction = (action: SettingsTreeAction): void => {
    const path = action.payload.path;

    // Handle menu actions (delete)
    if (action.action === "perform-node-action") {
      if (path.length === 2 && action.payload.id === "delete") {
        const instanceId = path[1]!;

        // Remove this instance from the config
        this.renderer.updateConfig((draft) => {
          delete draft.layers[instanceId];
        });

        // Remove the renderable
        const renderable = this.renderables.get(instanceId);
        if (renderable) {
          renderable.dispose();
          this.remove(renderable);
          this.renderables.delete(instanceId);
        }

        // Update the settings tree
        this.updateSettingsTree();
        this.renderer.updateCustomLayersCount();
      }
      return;
    }

    if (path.length !== 3) {
      return; // Doesn't match the pattern of ["layers", instanceId, field]
    }

    this.saveSetting(path, action.payload.value);

    const instanceId = path[1]!;
    this._loadUrdf(instanceId, undefined);
  };

  handleRobotDescription = (messageEvent: PartialMessageEvent<{ data: string }>): void => {
    const robotDescription = messageEvent.message.data;
    if (typeof robotDescription !== "string") {
      return;
    }
    this._loadUrdf(TOPIC_NAME, robotDescription);
  };

  handleParametersChange = (parameters: ReadonlyMap<string, unknown> | undefined): void => {
    const robotDescription = parameters?.get(TOPIC_NAME);
    if (typeof robotDescription !== "string") {
      return;
    }
    this._loadUrdf(TOPIC_NAME, robotDescription);
  };

  handleAddUrdf = (instanceId: string): void => {
    log.info(`Creating ${LAYER_ID} layer ${instanceId}`);

    const config: LayerSettingsCustomUrdf = { ...DEFAULT_CUSTOM_SETTINGS, instanceId };

    // Add this instance to the config
    this.renderer.updateConfig((draft) => {
      const maxOrderLayer = maxBy(Object.values(draft.layers), (layer) => layer?.order);
      const order = 1 + (maxOrderLayer?.order ?? 0);
      draft.layers[instanceId] = { ...config, order };
    });

    // Add the URDF renderable
    this._loadUrdf(instanceId, undefined);

    // Update the settings tree
    this.updateSettingsTree();
  };

  private _fetchUrdf(instanceId: string, url: string): void {
    const renderable = this.renderables.get(instanceId);
    if (!renderable) {
      throw new Error(`_fetchUrdf() should only be called for existing renderables`);
    }

    // Check if a valid URL was provided
    if (!isValidUrl(url)) {
      const path = renderable.userData.settingsPath;
      this.renderer.settings.errors.add(path, VALID_URL_ERR, `Invalid URDF URL: "${url}"`);
      return;
    }
    this.renderer.settings.errors.remove(renderable.userData.settingsPath, VALID_URL_ERR);

    // Check if this URL has already been fetched
    if (renderable.userData.url === url) {
      return;
    }

    if (renderable.userData.fetching) {
      // Check if this fetch is already in progress
      if (renderable.userData.fetching.url === url) {
        return;
      }

      // Cancel the previous fetch
      renderable.userData.fetching.control.abort();
    }

    log.debug(`Fetching URDF from ${url}`);
    renderable.userData.fetching = { url, control: new AbortController() };
    fetch(url, { signal: renderable.userData.fetching.control.signal })
      // eslint-disable-next-line @typescript-eslint/promise-function-async
      .then((res) => res.text())
      .then((urdf) => {
        log.debug(`Fetched ${urdf.length} byte URDF from ${url}`);
        this.renderer.settings.errors.remove(["layers", instanceId], FETCH_URDF_ERR);
        this._loadUrdf(instanceId, urdf);
      })
      .catch((unknown) => {
        const err = unknown as Error;
        const hasError = !err.message.startsWith("Failed to fetch");
        const errMessage = `Failed to load URDF from "${url}"${hasError ? `: ${err.message}` : ""}`;
        this.renderer.settings.errors.add(["layers", instanceId], FETCH_URDF_ERR, errMessage);
      });
  }

  private _loadUrdf(instanceId: string, urdf: string | undefined): void {
    let renderable = this.renderables.get(instanceId);
    if (renderable && urdf != undefined && renderable.userData.urdf === urdf) {
      return;
    }

    const isTopic = instanceId === TOPIC_NAME;
    const frameId = this.renderer.fixedFrameId ?? ""; // Unused
    const settingsPath = isTopic ? ["topics", TOPIC_NAME] : ["layers", instanceId];
    const baseSettings = isTopic ? DEFAULT_SETTINGS : DEFAULT_CUSTOM_SETTINGS;
    const userSettings = isTopic
      ? this.renderer.config.topics[instanceId]
      : this.renderer.config.layers[instanceId];
    const settings = { ...baseSettings, ...userSettings, instanceId };
    const url = (settings as Partial<LayerSettingsCustomUrdf>).url;

    // Create a UrdfRenderable if it does not already exist
    if (!renderable) {
      renderable = new UrdfRenderable(instanceId, this.renderer, {
        urdf,
        url: urdf != undefined ? url : undefined,
        fetching: undefined,
        renderables: new Map(),
        receiveTime: 0n,
        messageTime: 0n,
        frameId,
        pose: makePose(),
        settingsPath,
        settings,
      });
      this.add(renderable);
      this.renderables.set(instanceId, renderable);
    }

    renderable.userData.urdf = urdf;
    renderable.userData.url = urdf != undefined ? url : undefined;
    renderable.userData.settings = settings;
    renderable.userData.fetching = undefined;

    if (!urdf) {
      renderable.removeChildren();

      // Fetch the URDF from the URL if we have one
      if (url != undefined) {
        this._fetchUrdf(instanceId, url);
      }
      return;
    }

    // Parse the URDF
    const loadedRenderable = renderable;
    parseUrdf(urdf)
      .then((parsed) => this._loadRobot(loadedRenderable, parsed))
      .catch((unknown) => {
        const err = unknown as Error;
        log.error(`Failed to parse URDF: ${err.message}`);
        this.renderer.settings.errors.add(
          settingsPath,
          PARSE_URDF_ERR,
          `Failed to parse URDF: ${err.message}`,
        );
      });
  }

  private _loadRobot(renderable: UrdfRenderable, { robot, transforms }: ParsedUrdf): void {
    const renderer = this.renderer;

    // Import all transforms from the URDF into the scene
    for (const { parent, child, translation, rotation } of transforms) {
      renderer.addTransform(parent, child, 0n, translation, rotation);
    }

    // Dispose any existing renderables
    renderable.removeChildren();

    const createChild = (frameId: string, i: number, visual: UrdfVisual): void => {
      const childRenderable = createRenderable(visual, robot, i, frameId, renderer);
      // Set the childRenderable settingsPath so errors route to the correct place
      childRenderable.userData.settingsPath = renderable.userData.settingsPath;
      renderable.userData.renderables.set(childRenderable.name, childRenderable);
      renderable.add(childRenderable);
    };

    // Create a renderable for each link
    for (const link of robot.links.values()) {
      const frameId = link.name;

      for (let i = 0; i < link.visuals.length; i++) {
        createChild(frameId, i, link.visuals[i]!);
      }

      if (link.visuals.length === 0 && link.colliders.length > 0) {
        // If there are no visuals, but there are colliders, render those instead
        for (let i = 0; i < link.colliders.length; i++) {
          createChild(frameId, i, link.colliders[i]!);
        }
      }
    }
  }
}

async function parseUrdf(text: string): Promise<{ robot: UrdfRobot; transforms: TransformData[] }> {
  const fileFetcher = getFileFetch();

  try {
    log.debug(`Parsing ${text.length} byte URDF`);
    const robot = await parseRobot(text, fileFetcher);

    const transforms = Array.from(robot.joints.values(), (joint) => {
      const translation = joint.origin.xyz;
      const rotation = eulerToQuaternion(joint.origin.rpy);
      const transform: TransformData = {
        parent: joint.parent,
        child: joint.child,
        translation,
        rotation,
      };
      return transform;
    });

    return { robot, transforms };
  } catch (err) {
    throw new Error(`Failed to parse ${text.length} byte URDF: ${err}`);
  }
}

function getFileFetch(): (url: string) => Promise<string> {
  return async (url: string) => {
    try {
      log.debug(`fetch(${url}) requested`);
      const res = await fetch(url);
      return await res.text();
    } catch (err) {
      throw new Error(`Failed to fetch "${url}": ${err}`);
    }
  };
}

function createRenderable(
  visual: UrdfVisual,
  robot: UrdfRobot,
  id: number,
  frameId: string,
  renderer: Renderer,
): Renderable {
  const name = `${frameId}-${id}-${visual.geometry.geometryType}`;
  const orientation = eulerToQuaternion(visual.origin.rpy);
  const pose = { position: visual.origin.xyz, orientation };
  const color = getColor(visual, robot);
  const type = visual.geometry.geometryType;
  switch (type) {
    case "box": {
      const scale = visual.geometry.size;
      const marker = createMarker(frameId, MarkerType.CUBE, pose, scale, color);
      return new RenderableCube(name, marker, undefined, renderer);
    }
    case "cylinder": {
      const cylinder = visual.geometry;
      const scale = { x: cylinder.radius * 2, y: cylinder.radius * 2, z: cylinder.length };
      const marker = createMarker(frameId, MarkerType.CUBE, pose, scale, color);
      return new RenderableCylinder(name, marker, undefined, renderer);
    }
    case "sphere": {
      const sphere = visual.geometry;
      const scale = { x: sphere.radius * 2, y: sphere.radius * 2, z: sphere.radius * 2 };
      const marker = createMarker(frameId, MarkerType.CUBE, pose, scale, color);
      return new RenderableSphere(name, marker, undefined, renderer);
    }
    case "mesh": {
      // Use embedded materials only when no override material is defined in the URDF
      const embedded = !visual.material ? EmbeddedMaterialUsage.Use : EmbeddedMaterialUsage.Ignore;
      const marker = createMeshMarker(frameId, pose, embedded, visual.geometry, color);
      return new RenderableMeshResource(name, marker, undefined, renderer);
    }
    default:
      throw new Error(`Unrecognized visual geometryType: ${type}`);
  }
}

function getColor(visual: UrdfVisual, robot: UrdfRobot): ColorRGBA {
  if (!visual.material) {
    return DEFAULT_COLOR;
  }
  if (visual.material.color) {
    return visual.material.color;
  }
  if (visual.material.name) {
    return robot.materials.get(visual.material.name)?.color ?? DEFAULT_COLOR;
  }
  return DEFAULT_COLOR;
}

function createMarker(
  frameId: string,
  type: MarkerType,
  pose: Pose,
  scale: Vector3,
  color: ColorRGBA,
): Marker {
  return {
    header: { frame_id: frameId, stamp: { sec: 0, nsec: 0 } },
    ns: "",
    id: 0,
    type,
    action: MarkerAction.ADD,
    pose,
    scale,
    color,
    lifetime: { sec: 0, nsec: 0 },
    frame_locked: true,
    points: [],
    colors: [],
    text: "",
    mesh_resource: "",
    mesh_use_embedded_materials: false,
  };
}

function createMeshMarker(
  frameId: string,
  pose: Pose,
  embeddedMaterialUsage: EmbeddedMaterialUsage,
  mesh: UrdfGeometryMesh,
  color: ColorRGBA,
): Marker {
  const scale = mesh.scale ?? VEC3_ONE;
  return {
    header: { frame_id: frameId, stamp: { sec: 0, nsec: 0 } },
    ns: "",
    id: 0,
    type: MarkerType.MESH_RESOURCE,
    action: MarkerAction.ADD,
    pose,
    scale,
    color,
    lifetime: { sec: 0, nsec: 0 },
    frame_locked: true,
    points: [],
    colors: [],
    text: "",
    mesh_resource: mesh.filename,
    mesh_use_embedded_materials: embeddedMaterialUsage === EmbeddedMaterialUsage.Use,
  };
}

const VALID_PROTOCOLS = ["https:", "http:", "file:", "data:"];

function isValidUrl(str: string): boolean {
  try {
    const url = new URL(str);
    return (
      (supportsPackageUrl && url.protocol === "package:") || VALID_PROTOCOLS.includes(url.protocol)
    );
  } catch (_) {
    return false;
  }
}
