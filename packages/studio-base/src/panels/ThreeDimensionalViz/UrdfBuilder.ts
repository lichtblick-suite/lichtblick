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
import { rewritePackageUrl } from "@foxglove/studio-base/context/AssetsContext";
import { TopicSettingsCollection } from "@foxglove/studio-base/panels/ThreeDimensionalViz/SceneBuilder";
import { UrdfSettings } from "@foxglove/studio-base/panels/ThreeDimensionalViz/TopicSettingsEditor/UrdfSettingsEditor";
import Transforms from "@foxglove/studio-base/panels/ThreeDimensionalViz/Transforms";
import {
  Color,
  CubeMarker,
  CylinderMarker,
  MeshMarker,
  MutablePose,
  SphereMarker,
  TF,
} from "@foxglove/studio-base/types/Messages";
import { MarkerProvider, MarkerCollector } from "@foxglove/studio-base/types/Scene";
import { emptyPose } from "@foxglove/studio-base/util/Pose";
import { URDF_TOPIC } from "@foxglove/studio-base/util/globalConstants";

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
  private _transforms?: Transforms;
  private _rootTransformID?: string;

  constructor() {}

  renderMarkers = (add: MarkerCollector): void => {
    if (this._visible) {
      for (const box of this._boxes) {
        add.cube(box);
      }
      for (const sphere of this._spheres) {
        add.sphere(sphere);
      }
      for (const cylinder of this._cylinders) {
        add.cylinder(cylinder);
      }
      for (const mesh of this._meshes) {
        add.mesh(mesh);
      }
    }
  };

  // eslint-disable-next-line @foxglove/no-boolean-parameters
  setVisible(isVisible: boolean): void {
    this._visible = isVisible;
  }

  setTransforms = (transforms: Transforms, rootTransformID: string | undefined): void => {
    if (transforms === this._transforms && rootTransformID === this._rootTransformID) {
      return;
    }
    this._transforms = transforms;
    this._rootTransformID = rootTransformID;
    this.update();
  };

  setUrdfData(urdfData: string | undefined, rosPackagePath: string | undefined): void {
    if (this._urdfData !== urdfData) {
      this._urdfData = urdfData;

      // Only parse the /robot_description URDF if an override URL is not set
      if (!this._settings.urdfUrl) {
        this.clearMarkers();

        if (urdfData) {
          void this.parseUrdf(urdfData, rosPackagePath);
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
        void this.fetchUrdf(this._settings.urdfUrl, rosPackagePath);
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
      throw new Error(`Failed to fetch URDF from "${url}": ${err}`);
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
      if (!this._transforms.has(joint.child)) {
        const tf: TF = {
          header: {
            frame_id: joint.parent,
            stamp: { sec: 0, nsec: 0 },
            seq: 0,
          },
          child_frame_id: joint.child,
          transform: {
            translation: joint.origin.xyz,
            rotation: eulerToQuaternion(joint.origin.rpy),
          },
        };
        this._transforms.consume(tf);
      }
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
    if (!this._transforms || !this._rootTransformID) {
      return;
    }

    const tfs = this._transforms;
    const rootTf = this._rootTransformID;
    const ns = `urdf-${urdf.name}`;

    for (const link of urdf.links.values()) {
      const frame_id = link.name;

      let i = 0;
      for (const visual of link.visuals) {
        const id = `${link.name}-visual${i++}-${visual.geometry.geometryType}`;
        this.addMarker(ns, id, frame_id, tfs, rootTf, visual, urdf);
      }

      if (link.visuals.length === 0 && link.colliders.length > 0) {
        // If there are no visuals, but there are colliders, render those instead
        for (const collider of link.colliders) {
          const id = `${link.name}-collider${i++}-${collider.geometry.geometryType}`;
          this.addMarker(ns, id, frame_id, tfs, rootTf, collider, urdf);
        }
      }
    }
  }

  private addMarker(
    ns: string,
    id: string,
    frame_id: string,
    tfs: Transforms,
    rootTf: string,
    visual: UrdfVisual,
    robot: UrdfRobot,
  ): void {
    const localPose = {
      position: visual.origin.xyz,
      orientation: eulerToQuaternion(visual.origin.rpy),
    };
    const pose = tfs.apply(emptyPose(), localPose, frame_id, rootTf);
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
