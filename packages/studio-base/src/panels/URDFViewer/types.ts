// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";

export type EventTypes = {
  cameraMove: (center: THREE.Vector3) => void;
};

export type Config = {
  jointStatesTopic?: string;
  customJointValues?: Record<string, number>;
  opacity?: number;
  selectedAssetId?: string;
};

export const DATA_TYPES = Object.freeze([
  "sensor_msgs/JointState",
  "sensor_msgs/msg/JointState",
  "ros.sensor_msgs.JointState",
]);
