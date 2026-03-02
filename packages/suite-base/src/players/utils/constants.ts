// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

export const FREQUENCY_LIMIT = 60;

export const HIGH_FREQUENCY_ALERT = {
  id: "high-frequency",
  severity: "warn" as const,
  message: "High frequency topics detected",
  errorMessage:
    "The current data source has one or more topics with message frequency higher than 60Hz, which may impact performance and application memory.",
};

export const LOG_SCHEMAS = new Set([
  "rosgraph_msgs/Log", // ROS 1
  "rosgraph_msgs/msg/Log", // ROS 1 (alternative format)
  "rcl_interfaces/msg/Log", // ROS 2
  "foxglove.Log", // Foxglove schema
]);
