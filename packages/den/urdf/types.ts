// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

export type Vector3 = { x: number; y: number; z: number };
export type Color = { r: number; g: number; b: number; a: number };
export type Pose = { xyz: Vector3; rpy: Vector3 };

export type Inertia = {
  ixx: number;
  ixy: number;
  ixz: number;
  iyy: number;
  iyz: number;
  izz: number;
};

export type JointType = "fixed" | "continuous" | "revolute" | "planar" | "prismatic" | "floating";

export type UrdfInertial = {
  origin: Pose;
  mass: number;
  inertia: Inertia;
};

export type UrdfGeometryBox = {
  geometryType: "box";
  size: Vector3;
};

export type UrdfGeometryCylinder = {
  geometryType: "cylinder";
  radius: number;
  length: number;
};

export type UrdfGeometrySphere = {
  geometryType: "sphere";
  radius: number;
};

export type UrdfGeometryMesh = {
  geometryType: "mesh";
  filename: string;
  scale?: Vector3;
};

export type UrdfGeometry =
  | UrdfGeometryBox
  | UrdfGeometryCylinder
  | UrdfGeometrySphere
  | UrdfGeometryMesh;

export type UrdfCollider = {
  name?: string;
  origin: Pose;
  geometry: UrdfGeometry;
};

export type UrdfVisual = UrdfCollider & {
  material?: UrdfMaterial;
};

export type UrdfLink = {
  name: string;
  inertial?: UrdfInertial;
  visuals: UrdfVisual[];
  colliders: UrdfCollider[];
};

export type UrdfJoint = {
  name: string;
  jointType: JointType;
  origin: Pose;
  parent: string;
  child: string;
  axis: Vector3;
  calibration?: { rising?: number; falling?: number };
  dynamics?: { damping: number; friction: number };
  limit?: { lower: number; upper: number; effort: number; velocity: number };
  mimic?: { joint: string; multiplier: number; offset: number };
  safetyController?: {
    softLowerLimit: number;
    softUpperLimit: number;
    kPosition: number;
    kVelocity: number;
  };
};

export type UrdfMaterial = {
  name?: string;
  color?: Color;
  texture?: string;
};

export interface UrdfRobot {
  name: string;
  links: Map<string, UrdfLink>;
  joints: Map<string, UrdfJoint>;
  materials: Map<string, UrdfMaterial>;
}
