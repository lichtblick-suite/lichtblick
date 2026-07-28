// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

// Mirrors the exact field paths root-cause-analyzer's RcaEvidenceExtractor.cs already navigates
// server-side for the same evidence dataset (libs/root-cause/RootCause.Infrastructure/Services/
// BlackBoxIngestion/Rca/RcaEvidenceExtractor.cs). Lichtblick's own CDR deserializer already turns
// these custom ROS2 messages into plain JS objects (mcap-support's parseChannel builds the decoder
// purely from the schema text embedded in the mcap, no hardcoded type registry) -- there is no CDR
// parsing left to do here, only picking the same fields back out.

export interface OdomSample {
  tNs: number;
  x: number;
  y: number;
  yaw: number;
  speed: number;
}

export interface PathPoint {
  x: number;
  y: number;
}

export interface ZoneViolation {
  tNs: number;
  type: number;
  violated: boolean;
  x: number;
  y: number;
  z: number;
}

export interface LidarPoint {
  x: number;
  y: number;
  z: number;
}

function toFiniteNumber(value: unknown): number | undefined {
  const n = typeof value === "bigint" ? Number(value) : Number(value);
  return Number.isFinite(n) ? n : undefined;
}

// Same formula as root-cause-analyzer's Ros2Geometry.YawFromQuaternion (RcaEvidenceExtractor.cs's
// sibling Ros2Geometry.cs), assuming a roughly level vehicle (roll/pitch ignored).
function yawFromQuaternion(x: number, y: number, z: number, w: number): number {
  return Math.atan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z));
}

/** nav_msgs/msg/Odometry -> {tNs, x, y, yaw, speed}. Mirrors the Topics.Odom case. */
export function decodeOdom(message: unknown, tNs: number): OdomSample | undefined {
  const m = message as {
    pose?: {
      pose?: {
        position?: { x?: unknown; y?: unknown };
        orientation?: { x?: unknown; y?: unknown; z?: unknown; w?: unknown };
      };
    };
    twist?: { twist?: { linear?: { x?: unknown } } };
  };
  const x = toFiniteNumber(m.pose?.pose?.position?.x);
  const y = toFiniteNumber(m.pose?.pose?.position?.y);
  if (x == undefined || y == undefined) {
    return undefined;
  }
  const orientation = m.pose?.pose?.orientation ?? {};
  const yaw = yawFromQuaternion(
    toFiniteNumber(orientation.x) ?? 0,
    toFiniteNumber(orientation.y) ?? 0,
    toFiniteNumber(orientation.z) ?? 0,
    toFiniteNumber(orientation.w) ?? 0,
  );
  const speed = toFiniteNumber(m.twist?.twist?.linear?.x) ?? 0;
  return { tNs, x, y, yaw, speed };
}

/** polygon_msgs/msg/Polygon2DStamped -> {x,y}[]. Mirrors the ReadPolygon helper (Topics.Hazard). */
export function decodeHazardPolygon(message: unknown): PathPoint[] {
  const points = (message as { polygon?: { points?: unknown[] } }).polygon?.points ?? [];
  const result: PathPoint[] = [];
  for (const point of points) {
    const p = point as { x?: unknown; y?: unknown };
    const x = toFiniteNumber(p.x);
    const y = toFiniteNumber(p.y);
    if (x != undefined && y != undefined) {
      result.push({ x, y });
    }
  }
  return result;
}

/** mission_msgs/msg/PathStamped -> {x,y}[]. Mirrors the ReadPlannedPath helper (Topics.PlannedPath). */
export function decodePlannedPath(message: unknown): PathPoint[] {
  const points = (message as { path?: { points?: unknown[] } }).path?.points ?? [];
  const result: PathPoint[] = [];
  for (const point of points) {
    const p = point as { location?: { position?: { x?: unknown; y?: unknown } } };
    const x = toFiniteNumber(p.location?.position?.x);
    const y = toFiniteNumber(p.location?.position?.y);
    if (x != undefined && y != undefined) {
      result.push({ x, y });
    }
  }
  return result;
}

/**
 * mission_msgs/msg/ZoneReport -> obstacles[] flattened to {tNs, type, violated, x, y, z}[].
 * Mirrors the Topics.ZoneReport case. Unlike the C# decoder (which has to defensively "unwrap" a
 * {data: ...} box for ambiguous CDR-decoded scalars), Lichtblick's ROS2MessageReader already
 * produces properly-typed primitives per the real .msg schema, so `type`/`violated` are read
 * directly.
 */
export function decodeZoneViolations(message: unknown, tNs: number): ZoneViolation[] {
  const obstacles = (message as { obstacles?: unknown[] }).obstacles ?? [];
  const result: ZoneViolation[] = [];
  for (const obstacle of obstacles) {
    const o = obstacle as {
      obstacle_location?: { x?: unknown; y?: unknown; z?: unknown };
      type?: unknown;
      violated?: unknown;
    };
    const x = toFiniteNumber(o.obstacle_location?.x);
    const y = toFiniteNumber(o.obstacle_location?.y);
    if (x == undefined || y == undefined) {
      continue;
    }
    const z = toFiniteNumber(o.obstacle_location?.z) ?? 0;
    result.push({
      tNs,
      type: Math.trunc(toFiniteNumber(o.type) ?? 0),
      violated: Boolean(o.violated),
      x,
      y,
      z,
    });
  }
  return result;
}
