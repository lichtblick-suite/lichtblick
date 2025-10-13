// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

export const FREQUENCY_LIMIT = 60;

export const LOG_SCHEMAS = new Set([
  "rosgraph_msgs/Log", // ROS 1
  "rosgraph_msgs/msg/Log", // ROS 1 (alternative format)
  "rcl_interfaces/msg/Log", // ROS 2
  "foxglove.Log", // Foxglove schema
]);
