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

import { EventEmitter } from "eventemitter3";
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
import { TopicSettingsCollection } from "@foxglove/studio-base/panels/ThreeDimensionalViz/SceneBuilder";
import { UrdfSettings } from "@foxglove/studio-base/panels/ThreeDimensionalViz/TopicSettingsEditor/UrdfSettingsEditor";
import {
  IImmutableCoordinateFrame,
  IImmutableTransformTree,
  Transform,
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
import { clonePose } from "@foxglove/studio-base/util/Pose";
import { eulerToQuaternion } from "@foxglove/studio-base/util/geometry";
import { URDF_TOPIC } from "@foxglove/studio-base/util/globalConstants";
import sendNotification from "@foxglove/studio-base/util/sendNotification";

import { MarkerProvider, RenderMarkerArgs, TransformLink } from "./types";

export const DEFAULT_COLOR: Color = { r: 36 / 255, g: 142 / 255, b: 255 / 255, a: 1 };

const TIME_ZERO = { sec: 0, nsec: 0 };

const log = Logger.getLogger(__filename);

type EventTypes = {
  transforms: (transforms: TransformLink[]) => void;
};

export default class UrdfBuilder extends EventEmitter<EventTypes> implements MarkerProvider {
  private _urdf?: UrdfRobot;
  private _boxes: CubeMarker[] = [];
  private _spheres: SphereMarker[] = [];
  private _cylinders: CylinderMarker[] = [];
  private _meshes: MeshMarker[] = [];
  private _visible = true;
  private _settings: UrdfSettings = {};
  private _urdfData?: string;

  public renderMarkers = ({
    add,
    transforms,
    renderFrame,
    fixedFrame,
    time,
  }: RenderMarkerArgs): void => {
    if (!this._visible) {
      return;
    }

    for (const box of this._boxes) {
      if (updatePose(box, transforms, renderFrame, fixedFrame, time)) {
        add.cube(box);
      }
    }
    for (const sphere of this._spheres) {
      if (updatePose(sphere, transforms, renderFrame, fixedFrame, time)) {
        add.sphere(sphere);
      }
    }
    for (const cylinder of this._cylinders) {
      if (updatePose(cylinder, transforms, renderFrame, fixedFrame, time)) {
        add.cylinder(cylinder);
      }
    }
    for (const mesh of this._meshes) {
      if (updatePose(mesh, transforms, renderFrame, fixedFrame, time)) {
        add.mesh(mesh);
      }
    }
  };

  // eslint-disable-next-line @foxglove/no-boolean-parameters
  public setVisible(isVisible: boolean): void {
    this._visible = isVisible;
  }

  public setUrdfData(urdfData: string | undefined): void {
    if (this._urdfData !== urdfData) {
      this._urdfData = urdfData;

      // Only parse the /robot_description URDF if an override URL is not set
      if (!this._settings.urdfUrl) {
        this.clearMarkers();

        if (urdfData) {
          void this.parseUrdf(urdfData).catch((err) => {
            sendNotification(`Error parsing URDF`, (err as Error).message, "user", "error");
          });
        }
      }
    }
  }

  public setSettingsByKey(settings: TopicSettingsCollection): void {
    const newSettings = settings[`t:${URDF_TOPIC}`] ?? {};
    if (!isEqual(newSettings, this._settings)) {
      this._settings = newSettings;
      this.clearMarkers();

      if (this._settings.urdfUrl && isUrdfUrlValid(this._settings.urdfUrl)) {
        void this.fetchUrdf(this._settings.urdfUrl).catch((err) => {
          sendNotification(`Error loading URDF`, (err as Error).message, "user", "error");
        });
      } else {
        this._urdf = undefined;
      }
    }
  }

  private async fetchUrdf(url: string): Promise<void> {
    let text: string;
    try {
      const fetchUrl = url;
      log.debug(`Fetching URDF from ${fetchUrl}`);
      const res = await fetch(fetchUrl);
      text = await res.text();
    } catch (err) {
      const errMessage = (err as Error).message;
      const hasError = !errMessage.startsWith("Failed to fetch");
      throw new Error(`Failed to load URDF from "${url}"${hasError ? `: ${errMessage}` : ""}`);
    }

    if (!text) {
      throw new Error(`Did not fetch any URDF data from "${url}"`);
    }

    await this.parseUrdf(text);
  }

  private async parseUrdf(text: string): Promise<void> {
    const fileFetcher = getFileFetch();

    try {
      log.debug(`Parsing ${text.length} byte URDF`);
      this._urdf = await parseRobot(text, fileFetcher);

      const transforms = Array.from(this._urdf.joints.values(), (joint) => {
        const t = joint.origin.xyz;
        const q = eulerToQuaternion(joint.origin.rpy);
        const translation: vec3 = [t.x, t.y, t.z];
        const rotation: quat = [q.x, q.y, q.z, q.w];
        const transform = new Transform(translation, rotation);
        const transformLink: TransformLink = {
          parent: joint.parent,
          child: joint.child,
          transform,
        };
        return transformLink;
      });

      // createMarkers before emit so if the emit triggers a repaint the markers are ready
      this.createMarkers();

      log.debug("Transforms from urdf: ", transforms);
      this.emit("transforms", transforms);
    } catch (err) {
      throw new Error(`Failed to parse ${text.length} byte URDF: ${err}`);
    }
  }

  private createMarkers(): void {
    this.clearMarkers();

    const urdf = this._urdf;
    if (!urdf) {
      return;
    }

    const ns = `urdf-${urdf.name}`;
    log.debug(`Creating URDF markers for ${urdf.name}`);

    for (const link of urdf.links.values()) {
      const frame_id = link.name;

      let i = 0;
      for (const visual of link.visuals) {
        const id = `${link.name}-visual${i++}-${visual.geometry.geometryType}`;
        this.addMarker(ns, id, frame_id, visual, urdf);
      }

      if (link.visuals.length === 0 && link.colliders.length > 0) {
        // If there are no visuals, but there are colliders, render those instead
        for (const collider of link.colliders) {
          const id = `${link.name}-collider${i++}-${collider.geometry.geometryType}`;
          this.addMarker(ns, id, frame_id, collider, urdf);
        }
      }
    }
  }

  private clearMarkers(): void {
    this._boxes = [];
    this._spheres = [];
    this._cylinders = [];
    this._meshes = [];
  }

  private addMarker(
    ns: string,
    id: string,
    frame_id: string,
    visual: UrdfVisual,
    robot: UrdfRobot,
  ): void {
    const xyz = visual.origin.xyz;
    const pose = {
      position: { x: xyz.x, y: xyz.y, z: xyz.z },
      orientation: eulerToQuaternion(visual.origin.rpy),
    };

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

  private static BuildBox(
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

  private static BuildSphere(
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

  private static BuildCylinder(
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

  private static BuildMesh(
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
      mesh_use_embedded_materials:
        visual.material == undefined ||
        // RViz ignores the URDF-specified material when the Collada mesh has an embedded material
        (visual.geometry.geometryType === "mesh" && visual.geometry.filename.endsWith(".dae")),
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
  transforms: IImmutableTransformTree,
  renderFrame: IImmutableCoordinateFrame,
  fixedFrame: IImmutableCoordinateFrame,
  time: Time,
): boolean {
  const srcFrame = transforms.frame(marker.header.frame_id);
  if (!srcFrame) {
    return false;
  }

  // Store the original pose on the marker
  const markerWithOrigPose = marker as Marker & { origPose?: MutablePose };
  markerWithOrigPose.origPose ??= clonePose(marker.pose);

  return (
    renderFrame.apply(marker.pose, markerWithOrigPose.origPose, fixedFrame, srcFrame, time, time) !=
    undefined
  );
}
