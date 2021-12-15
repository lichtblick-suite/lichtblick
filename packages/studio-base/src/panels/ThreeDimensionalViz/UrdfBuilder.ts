// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { quat, vec3 } from "gl-matrix";
import { isEqual } from "lodash";

import {
  UrdfGeometryBox,
  UrdfGeometryCylinder,
  UrdfGeometryMesh,
  UrdfGeometrySphere,
  UrdfRobot,
  UrdfVisual,
  parseRobot,
} from "@foxglove/den/urdf";
import Logger from "@foxglove/log";
import { Time } from "@foxglove/rostime";
import { rewritePackageUrl } from "@foxglove/studio-base/context/AssetsContext";
import { TopicSettingsCollection } from "@foxglove/studio-base/panels/ThreeDimensionalViz/SceneBuilder";
import { UrdfSettings } from "@foxglove/studio-base/panels/ThreeDimensionalViz/TopicSettingsEditor/UrdfSettingsEditor";
import {
  Transform,
  TransformTree,
} from "@foxglove/studio-base/panels/ThreeDimensionalViz/transforms";
import {
  Color,
  CubeMarker,
  CylinderMarker,
  Marker,
  MeshMarker,
  MutablePose,
  SphereMarker,
} from "@foxglove/studio-base/types/Messages";
import { MarkerProvider, MarkerCollector } from "@foxglove/studio-base/types/Scene";
import { emptyPose } from "@foxglove/studio-base/util/Pose";
import { URDF_TOPIC } from "@foxglove/studio-base/util/globalConstants";
import sendNotification from "@foxglove/studio-base/util/sendNotification";

export const DEFAULT_COLOR: Color = { r: 36 / 255, g: 142 / 255, b: 255 / 255, a: 1 };

const TIME_ZERO = { sec: 0, nsec: 0 };

type Vector3 = { x: number; y: number; z: number };
type Quaternion = { x: number; y: number; z: number; w: number };

const log = Logger.getLogger(__filename);

export default class UrdfBuilder implements MarkerProvider {
  private _urdf?: UrdfRobot;
  private _boxes: CubeMarker[] = [];
  private _spheres: SphereMarker[] = [];
  private _cylinders: CylinderMarker[] = [];
  private _meshes: MeshMarker[] = [];
  private _visible = true;
  private _settings: UrdfSettings = {};
  private _urdfData?: string;
  private _transforms?: TransformTree;
  private _renderFrameId?: string;

  constructor() {}

  renderMarkers = (add: MarkerCollector, time: Time): void => {
    if (this._visible && this._transforms && this._renderFrameId) {
      for (const box of this._boxes) {
        updatePose(box, this._transforms, this._renderFrameId, time);
        add.cube(box);
      }
      for (const sphere of this._spheres) {
        updatePose(sphere, this._transforms, this._renderFrameId, time);
        add.sphere(sphere);
      }
      for (const cylinder of this._cylinders) {
        updatePose(cylinder, this._transforms, this._renderFrameId, time);
        add.cylinder(cylinder);
      }
      for (const mesh of this._meshes) {
        updatePose(mesh, this._transforms, this._renderFrameId, time);
        add.mesh(mesh);
      }
    }
  };

  // eslint-disable-next-line @foxglove/no-boolean-parameters
  setVisible(isVisible: boolean): void {
    this._visible = isVisible;
  }

  setTransforms = (transforms: TransformTree, renderFrameId: string | undefined): void => {
    if (transforms === this._transforms && renderFrameId === this._renderFrameId) {
      return;
    }
    this._transforms = transforms;
    this._renderFrameId = renderFrameId;
    this.update();
  };

  setUrdfData(urdfData: string | undefined, rosPackagePath: string | undefined): void {
    if (this._urdfData !== urdfData) {
      this._urdfData = urdfData;

      // Only parse the /robot_description URDF if an override URL is not set
      if (!this._settings.urdfUrl) {
        this.clearMarkers();

        if (urdfData) {
          void this.parseUrdf(urdfData, rosPackagePath).catch((err) => {
            sendNotification(`Error parsing URDF`, (err as Error).message, "user", "error");
          });
        }
      }
    }
  }

  setSettingsByKey(settings: TopicSettingsCollection, rosPackagePath: string | undefined): void {
    const newSettings = settings[`t:${URDF_TOPIC}`] ?? {};
    if (!isEqual(newSettings, this._settings)) {
      this._settings = newSettings;
      this.clearMarkers();

      if (this._settings.urdfUrl && isUrdfUrlValid(this._settings.urdfUrl)) {
        void this.fetchUrdf(this._settings.urdfUrl, rosPackagePath).catch((err) => {
          sendNotification(`Error loading URDF`, (err as Error).message, "user", "error");
        });
      } else {
        this._urdf = undefined;
      }
    }
  }

  async fetchUrdf(url: string, rosPackagePath: string | undefined): Promise<void> {
    let text: string;
    try {
      const fetchUrl = rewritePackageUrl(url, { rosPackagePath });
      log.debug(`Fetching URDF from ${fetchUrl}`);
      const res = await fetch(fetchUrl);
      text = await res.text();
    } catch (err) {
      const errMessage = (err as Error).message;
      const hasError = !errMessage.startsWith("Failed to fetch");
      throw new Error(`Failed to load URDF from "${url}"${hasError ? `: ${errMessage}` : ""}`);
    }

    if (!text) {
      throw new Error(`Did noy fetch any URDF data from "${url}"`);
    }

    await this.parseUrdf(text, rosPackagePath);
  }

  async parseUrdf(text: string, rosPackagePath: string | undefined): Promise<void> {
    const fileFetcher = getFileFetch(rosPackagePath);

    try {
      log.debug(`Parsing ${text.length} byte URDF`);
      this._urdf = await parseRobot(text, fileFetcher);
      this.update();
    } catch (err) {
      throw new Error(`Failed to parse ${text.length} byte URDF: ${err}`);
    }
  }

  private update(): void {
    this.clearMarkers();

    if (!this._urdf || !this._transforms) {
      return;
    }

    for (const joint of this._urdf.joints.values()) {
      const t = joint.origin.xyz;
      const q = eulerToQuaternion(joint.origin.rpy);
      const translation: vec3 = [t.x, t.y, t.z];
      const rotation: quat = [q.x, q.y, q.z, q.w];
      const tf = new Transform(translation, rotation);
      this._transforms.addTransform(joint.child, joint.parent, TIME_ZERO, tf);
    }

    this.createMarkers(this._urdf);
  }

  private clearMarkers(): void {
    this._boxes = [];
    this._spheres = [];
    this._cylinders = [];
    this._meshes = [];
  }

  private createMarkers(urdf: UrdfRobot): void {
    if (!this._transforms || !this._renderFrameId) {
      return;
    }

    const tfs = this._transforms;
    const renderFrameId = this._renderFrameId;
    const ns = `urdf-${urdf.name}`;

    for (const link of urdf.links.values()) {
      const frame_id = link.name;

      let i = 0;
      for (const visual of link.visuals) {
        const id = `${link.name}-visual${i++}-${visual.geometry.geometryType}`;
        this.addMarker(ns, id, frame_id, tfs, renderFrameId, visual, urdf);
      }

      if (link.visuals.length === 0 && link.colliders.length > 0) {
        // If there are no visuals, but there are colliders, render those instead
        for (const collider of link.colliders) {
          const id = `${link.name}-collider${i++}-${collider.geometry.geometryType}`;
          this.addMarker(ns, id, frame_id, tfs, renderFrameId, collider, urdf);
        }
      }
    }
  }

  private addMarker(
    ns: string,
    id: string,
    frame_id: string,
    tfs: TransformTree,
    renderFrameId: string,
    visual: UrdfVisual,
    robot: UrdfRobot,
  ): void {
    const localPose = {
      position: visual.origin.xyz,
      orientation: eulerToQuaternion(visual.origin.rpy),
    };
    const pose = tfs.apply(emptyPose(), localPose, renderFrameId, frame_id, TIME_ZERO);
    if (!pose) {
      return;
    }

    switch (visual.geometry.geometryType) {
      case "box":
        this._boxes.push(UrdfBuilder.BuildBox(ns, id, visual, robot, frame_id, pose));
        break;
      case "sphere":
        this._spheres.push(UrdfBuilder.BuildSphere(ns, id, visual, robot, frame_id, pose));
        break;
      case "cylinder":
        this._cylinders.push(UrdfBuilder.BuildCylinder(ns, id, visual, robot, frame_id, pose));
        break;
      case "mesh":
        this._meshes.push(UrdfBuilder.BuildMesh(ns, id, visual, robot, frame_id, pose));
        break;
    }
  }

  static BuildBox(
    ns: string,
    id: string,
    visual: UrdfVisual,
    robot: UrdfRobot,
    frame_id: string,
    pose: MutablePose,
  ): CubeMarker {
    const box = visual.geometry as UrdfGeometryBox;
    const marker: CubeMarker = {
      type: 1,
      header: { frame_id, stamp: TIME_ZERO, seq: 0 },
      ns,
      id,
      action: 0,
      pose,
      scale: box.size,
      color: getColor(visual, robot),
      frame_locked: true,
    };
    return marker;
  }

  static BuildSphere(
    ns: string,
    id: string,
    visual: UrdfVisual,
    robot: UrdfRobot,
    frame_id: string,
    pose: MutablePose,
  ): SphereMarker {
    const sphere = visual.geometry as UrdfGeometrySphere;
    const marker: SphereMarker = {
      type: 2,
      header: { frame_id, stamp: TIME_ZERO, seq: 0 },
      ns,
      id,
      action: 0,
      pose,
      scale: { x: sphere.radius * 2, y: sphere.radius * 2, z: sphere.radius * 2 },
      color: getColor(visual, robot),
      frame_locked: true,
    };
    return marker;
  }

  static BuildCylinder(
    ns: string,
    id: string,
    visual: UrdfVisual,
    robot: UrdfRobot,
    frame_id: string,
    pose: MutablePose,
  ): CylinderMarker {
    const cylinder = visual.geometry as UrdfGeometryCylinder;
    const marker: CylinderMarker = {
      type: 3,
      header: { frame_id, stamp: TIME_ZERO, seq: 0 },
      ns,
      id,
      action: 0,
      pose,
      scale: { x: cylinder.radius * 2, y: cylinder.radius * 2, z: cylinder.length },
      color: getColor(visual, robot),
      frame_locked: true,
    };
    return marker;
  }

  static BuildMesh(
    ns: string,
    id: string,
    visual: UrdfVisual,
    robot: UrdfRobot,
    frame_id: string,
    pose: MutablePose,
  ): MeshMarker {
    const mesh = visual.geometry as UrdfGeometryMesh;
    const marker: MeshMarker = {
      type: 10,
      header: { frame_id, stamp: TIME_ZERO, seq: 0 },
      ns,
      id,
      action: 0,
      pose,
      scale: mesh.scale ?? { x: 1, y: 1, z: 1 },
      color: getColor(visual, robot),
      frame_locked: true,
      mesh_resource: mesh.filename,
      mesh_use_embedded_materials: true,
    };
    return marker;
  }
}

function isUrdfUrlValid(str: string): boolean {
  try {
    const url = new URL(str);
    return (
      (url.protocol === "package:" || url.protocol === "http:" || url.protocol === "https:") &&
      (url.pathname.endsWith(".urdf") ||
        url.pathname.endsWith(".xacro") ||
        url.pathname.endsWith(".xml"))
    );
  } catch (e) {
    return false;
  }
}

function getFileFetch(rosPackagePath: string | undefined): (url: string) => Promise<string> {
  return async (url: string) => {
    try {
      log.debug(`fetch(${url}) requested`);
      const fetchUrl = rewritePackageUrl(url, { rosPackagePath });
      const res = await fetch(fetchUrl);
      return await res.text();
    } catch (err) {
      throw new Error(`Failed to fetch "${url}": ${err}`);
    }
  };
}

function eulerToQuaternion(rpy: Vector3): Quaternion {
  const roll = rpy.x;
  const pitch = rpy.y;
  const yaw = rpy.z;

  const cy = Math.cos(yaw * 0.5);
  const sy = Math.sin(yaw * 0.5);
  const cr = Math.cos(roll * 0.5);
  const sr = Math.sin(roll * 0.5);
  const cp = Math.cos(pitch * 0.5);
  const sp = Math.sin(pitch * 0.5);

  const w = cy * cr * cp + sy * sr * sp;
  const x = cy * sr * cp - sy * cr * sp;
  const y = cy * cr * sp + sy * sr * cp;
  const z = sy * cr * cp - cy * sr * sp;

  return { x, y, z, w };
}

function getColor(visual: UrdfVisual, robot: UrdfRobot): Color {
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

function updatePose(
  marker: Marker,
  transforms: TransformTree,
  frameId: string,
  currentTime: Time,
): boolean {
  const srcFrame = transforms.frame(marker.header.frame_id);
  const frame = transforms.frame(frameId);
  if (!srcFrame || !frame) {
    return false;
  }

  // Store the original pose on the marker
  const markerWithOrigPose = marker as Marker & { origPose?: MutablePose };
  markerWithOrigPose.origPose ??= marker.pose;

  return frame.apply(marker.pose, markerWithOrigPose.origPose, srcFrame, currentTime) != undefined;
}
