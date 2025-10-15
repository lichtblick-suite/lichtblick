// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { MessageDefinition } from "@lichtblick/message-definition";

// MoveIt message definitions based on moveit_msgs package
export const moveitMessageDefinitions: Record<string, MessageDefinition> = {
  "moveit_msgs/PlanningScene": {
    name: "moveit_msgs/PlanningScene",
    definitions: [
      { name: "name", type: "string", isComplex: false, isArray: false },
      { name: "robot_state", type: "moveit_msgs/RobotState", isComplex: true, isArray: false },
      { name: "robot_model_name", type: "string", isComplex: false, isArray: false },
      { name: "fixed_frame_transforms", type: "geometry_msgs/TransformStamped", isComplex: true, isArray: true },
      { name: "allowed_collision_matrix", type: "moveit_msgs/AllowedCollisionMatrix", isComplex: true, isArray: false },
      { name: "link_padding", type: "moveit_msgs/LinkPadding", isComplex: true, isArray: true },
      { name: "link_scale", type: "moveit_msgs/LinkScale", isComplex: true, isArray: true },
      { name: "object_colors", type: "moveit_msgs/ObjectColor", isComplex: true, isArray: true },
      { name: "world", type: "moveit_msgs/PlanningSceneWorld", isComplex: true, isArray: false },
      { name: "is_diff", type: "bool", isComplex: false, isArray: false },
    ],
  },

  "moveit_msgs/RobotState": {
    name: "moveit_msgs/RobotState",
    definitions: [
      { name: "joint_state", type: "sensor_msgs/JointState", isComplex: true, isArray: false },
      { name: "multi_dof_joint_state", type: "sensor_msgs/MultiDOFJointState", isComplex: true, isArray: false },
      { name: "attached_collision_objects", type: "moveit_msgs/AttachedCollisionObject", isComplex: true, isArray: true },
      { name: "is_diff", type: "bool", isComplex: false, isArray: false },
    ],
  },

  "moveit_msgs/PlanningSceneWorld": {
    name: "moveit_msgs/PlanningSceneWorld",
    definitions: [
      { name: "collision_objects", type: "moveit_msgs/CollisionObject", isComplex: true, isArray: true },
      { name: "octomap", type: "octomap_msgs/OctomapWithPose", isComplex: true, isArray: false },
    ],
  },

  "moveit_msgs/AllowedCollisionMatrix": {
    name: "moveit_msgs/AllowedCollisionMatrix",
    definitions: [
      { name: "entry_names", type: "string", isComplex: false, isArray: true },
      { name: "entry_values", type: "moveit_msgs/AllowedCollisionEntry", isComplex: true, isArray: true },
      { name: "default_entry_names", type: "string", isComplex: false, isArray: true },
      { name: "default_entry_values", type: "bool", isComplex: false, isArray: true },
    ],
  },

  "moveit_msgs/AllowedCollisionEntry": {
    name: "moveit_msgs/AllowedCollisionEntry",
    definitions: [
      { name: "enabled", type: "bool", isComplex: false, isArray: true },
    ],
  },

  "moveit_msgs/LinkPadding": {
    name: "moveit_msgs/LinkPadding",
    definitions: [
      { name: "link_name", type: "string", isComplex: false, isArray: false },
      { name: "padding", type: "float64", isComplex: false, isArray: false },
    ],
  },

  "moveit_msgs/LinkScale": {
    name: "moveit_msgs/LinkScale",
    definitions: [
      { name: "link_name", type: "string", isComplex: false, isArray: false },
      { name: "scale", type: "float64", isComplex: false, isArray: false },
    ],
  },

  "moveit_msgs/ObjectColor": {
    name: "moveit_msgs/ObjectColor",
    definitions: [
      { name: "id", type: "string", isComplex: false, isArray: false },
      { name: "color", type: "std_msgs/ColorRGBA", isComplex: true, isArray: false },
    ],
  },

  "moveit_msgs/AttachedCollisionObject": {
    name: "moveit_msgs/AttachedCollisionObject",
    definitions: [
      { name: "link_name", type: "string", isComplex: false, isArray: false },
      { name: "object", type: "moveit_msgs/CollisionObject", isComplex: true, isArray: false },
      { name: "touch_links", type: "string", isComplex: false, isArray: true },
      { name: "detach_posture", type: "trajectory_msgs/JointTrajectory", isComplex: true, isArray: false },
      { name: "weight", type: "float64", isComplex: false, isArray: false },
    ],
  },

  "moveit_msgs/CollisionObject": {
    name: "moveit_msgs/CollisionObject",
    definitions: [
      { name: "header", type: "std_msgs/Header", isComplex: true, isArray: false },
      { name: "id", type: "string", isComplex: false, isArray: false },
      { name: "type", type: "object_recognition_msgs/ObjectType", isComplex: true, isArray: false },
      { name: "primitives", type: "shape_msgs/SolidPrimitive", isComplex: true, isArray: true },
      { name: "primitive_poses", type: "geometry_msgs/Pose", isComplex: true, isArray: true },
      { name: "meshes", type: "shape_msgs/Mesh", isComplex: true, isArray: true },
      { name: "mesh_poses", type: "geometry_msgs/Pose", isComplex: true, isArray: true },
      { name: "planes", type: "shape_msgs/Plane", isComplex: true, isArray: true },
      { name: "plane_poses", type: "geometry_msgs/Pose", isComplex: true, isArray: true },
      { name: "subframe_names", type: "string", isComplex: false, isArray: true },
      { name: "subframe_poses", type: "geometry_msgs/Pose", isComplex: true, isArray: true },
      { name: "operation", type: "int8", isComplex: false, isArray: false },
    ],
  },

  "moveit_msgs/JointTrajectory": {
    name: "moveit_msgs/JointTrajectory",
    definitions: [
      { name: "header", type: "std_msgs/Header", isComplex: true, isArray: false },
      { name: "joint_names", type: "string", isComplex: false, isArray: true },
      { name: "points", type: "trajectory_msgs/JointTrajectoryPoint", isComplex: true, isArray: true },
    ],
  },

  "moveit_msgs/JointTrajectoryPoint": {
    name: "moveit_msgs/JointTrajectoryPoint",
    definitions: [
      { name: "positions", type: "float64", isComplex: false, isArray: true },
      { name: "velocities", type: "float64", isComplex: false, isArray: true },
      { name: "accelerations", type: "float64", isComplex: false, isArray: true },
      { name: "effort", type: "float64", isComplex: false, isArray: true },
      { name: "time_from_start", type: "duration", isComplex: false, isArray: false },
    ],
  },

  // Object recognition message definitions
  "object_recognition_msgs/ObjectType": {
    name: "object_recognition_msgs/ObjectType",
    definitions: [
      { name: "key", type: "string", isComplex: false, isArray: false },
      { name: "db", type: "string", isComplex: false, isArray: false },
    ],
  },

  // Octomap message definitions
  "octomap_msgs/OctomapWithPose": {
    name: "octomap_msgs/OctomapWithPose",
    definitions: [
      { name: "header", type: "std_msgs/Header", isComplex: true, isArray: false },
      { name: "origin", type: "geometry_msgs/Pose", isComplex: true, isArray: false },
      { name: "octomap", type: "octomap_msgs/Octomap", isComplex: true, isArray: false },
    ],
  },

  "octomap_msgs/Octomap": {
    name: "octomap_msgs/Octomap",
    definitions: [
      { name: "header", type: "std_msgs/Header", isComplex: true, isArray: false },
      { name: "binary", type: "bool", isComplex: false, isArray: false },
      { name: "id", type: "string", isComplex: false, isArray: false },
      { name: "resolution", type: "float64", isComplex: false, isArray: false },
      { name: "data", type: "int8", isComplex: false, isArray: true },
    ],
  },
};
