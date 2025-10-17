// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Time } from "@lichtblick/rostime";
import { Color, Point } from "./Messages";
import { Pose, Orientation } from "../panels/ThreeDeeRender/transforms/geometry";

// MoveIt message types based on moveit_msgs package

export type MoveItMessages = {
  "moveit_msgs/PlanningScene": {
    name: string;
    robot_state: RobotState;
    robot_model_name: string;
    fixed_frame_transforms: TransformStamped[];
    allowed_collision_matrix: AllowedCollisionMatrix;
    link_padding: LinkPadding[];
    link_scale: LinkScale[];
    object_colors: ObjectColor[];
    world: PlanningSceneWorld;
    is_diff: boolean;
  };

  "moveit_msgs/RobotState": {
    joint_state: JointState;
    multi_dof_joint_state: MultiDOFJointState;
    attached_collision_objects: AttachedCollisionObject[];
    is_diff: boolean;
  };

  "moveit_msgs/PlanningSceneWorld": {
    collision_objects: CollisionObject[];
    octomap: OctomapWithPose;
  };

  "moveit_msgs/AllowedCollisionMatrix": {
    entry_names: string[];
    entry_values: AllowedCollisionEntry[];
    default_entry_names: string[];
    default_entry_values: boolean[];
  };

  "moveit_msgs/AllowedCollisionEntry": {
    enabled: boolean[];
  };

  "moveit_msgs/LinkPadding": {
    link_name: string;
    padding: number;
  };

  "moveit_msgs/LinkScale": {
    link_name: string;
    scale: number;
  };

  "moveit_msgs/ObjectColor": {
    id: string;
      color: Color;
  };

  "moveit_msgs/AttachedCollisionObject": {
    link_name: string;
    object: CollisionObject;
    touch_links: string[];
    detach_posture: JointTrajectory;
    weight: number;
  };

  "moveit_msgs/CollisionObject": {
    header: Header;
    pose: Pose;
    id: string;
    type: ObjectType;
    primitives: SolidPrimitive[];
    primitive_poses: Pose[];
    meshes: Mesh[];
    mesh_poses: Pose[];
    planes: Plane[];
    plane_poses: Pose[];
    subframe_names: string[];
    subframe_poses: Pose[];
    operation: number;
  };

  "moveit_msgs/JointTrajectory": {
    header: Header;
    joint_names: string[];
    points: JointTrajectoryPoint[];
  };

  "moveit_msgs/JointTrajectoryPoint": {
    positions: number[];
    velocities: number[];
    accelerations: number[];
    effort: number[];
    time_from_start: Time;
  };
};

// Supporting types
export type Header = {
  stamp: Time;
  frame_id: string;
};

export type TransformStamped = {
  header: Header;
  child_frame_id: string;
  transform: Transform;
};

export type Transform = {
  translation: Point;
  rotation: Orientation;
};

export type JointState = {
  header: Header;
  name: string[];
  position: number[];
  velocity: number[];
  effort: number[];
};

export type MultiDOFJointState = {
  header: Header;
  joint_names: string[];
  transforms: Transform[];
  twist: Twist[];
  wrench: Wrench[];
};

export type Twist = {
  linear: Point;
  angular: Point;
};

export type Wrench = {
  force: Point;
  torque: Point;
};

export type OctomapWithPose = {
  header: Header;
  origin: Pose;
  octomap: Octomap;
};

export type Octomap = {
  header: Header;
  binary: boolean;
  id: string;
  resolution: number;
  data: number[];
};

export type SolidPrimitive = {
  type: number;
  dimensions: number[];
};

export type Mesh = {
  triangles: MeshTriangle[];
  vertices: Point[];
};

export type MeshTriangle = {
  vertex_indices: number[];
};

export type Plane = {
  coef: number[];
};

export type CollisionObjectType = {
  key: string;
  db: string;
};

// Object recognition message types
export type ObjectType = {
  key: string;
  db: string;
};

export type CollisionObjectOperation = {
  ADD: 0;
  REMOVE: 1;
  APPEND: 2;
  MOVE: 3;
};

// Re-export commonly used types
export type RobotState = MoveItMessages["moveit_msgs/RobotState"];
export type PlanningScene = MoveItMessages["moveit_msgs/PlanningScene"];
export type PlanningSceneWorld = MoveItMessages["moveit_msgs/PlanningSceneWorld"];
export type AllowedCollisionMatrix = MoveItMessages["moveit_msgs/AllowedCollisionMatrix"];
export type AllowedCollisionEntry = MoveItMessages["moveit_msgs/AllowedCollisionEntry"];
export type LinkPadding = MoveItMessages["moveit_msgs/LinkPadding"];
export type LinkScale = MoveItMessages["moveit_msgs/LinkScale"];
export type ObjectColor = MoveItMessages["moveit_msgs/ObjectColor"];
export type AttachedCollisionObject = MoveItMessages["moveit_msgs/AttachedCollisionObject"];
export type CollisionObject = MoveItMessages["moveit_msgs/CollisionObject"];
export type JointTrajectory = MoveItMessages["moveit_msgs/JointTrajectory"];
export type JointTrajectoryPoint = MoveItMessages["moveit_msgs/JointTrajectoryPoint"];
