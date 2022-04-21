// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { DeepPartial } from "ts-essentials";

import { Time } from "@foxglove/rostime";

import { Header, Marker, Pose, Vector3, Quaternion, ColorRGBA } from "./ros";

export function normalizeTime(time: Partial<Time> | undefined): Time {
  if (!time) {
    return { sec: 0, nsec: 0 };
  }
  return { sec: time.sec ?? 0, nsec: time.nsec ?? 0 };
}

export function normalizeVector3(vector: Partial<Vector3> | undefined): Vector3 {
  if (!vector) {
    return { x: 0, y: 0, z: 0 };
  }
  return { x: vector.x ?? 0, y: vector.y ?? 0, z: vector.z ?? 0 };
}

export function normalizeVector3s(vectors: Partial<Vector3>[] | undefined): Vector3[] {
  if (!vectors) {
    return [];
  }
  return vectors.map(normalizeVector3);
}

export function normalizeQuaternion(quat: Partial<Quaternion> | undefined): Quaternion {
  if (!quat) {
    return { x: 0, y: 0, z: 0, w: 1 };
  }
  return { x: quat.x ?? 0, y: quat.y ?? 0, z: quat.z ?? 0, w: quat.w ?? 0 };
}

export function normalizeColorRGBA(color: Partial<ColorRGBA> | undefined): ColorRGBA {
  if (!color) {
    return { r: 0, g: 0, b: 0, a: 1 };
  }
  // alpha defaults to 1 if unspecified
  return { r: color.r ?? 0, g: color.g ?? 0, b: color.b ?? 0, a: color.a ?? 1 };
}

export function normalizeColorRGBAs(colors: Partial<ColorRGBA>[] | undefined): ColorRGBA[] {
  if (!colors) {
    return [];
  }
  return colors.map(normalizeColorRGBA);
}

export function normalizePose(pose: DeepPartial<Pose> | undefined): Pose {
  return {
    position: normalizeVector3(pose?.position),
    orientation: normalizeQuaternion(pose?.orientation),
  };
}

export function normalizeHeader(header: DeepPartial<Header> | undefined): Header {
  return {
    frame_id: header?.frame_id ?? "",
    stamp: normalizeTime(header?.stamp),
    seq: header?.seq,
  };
}

export function normalizeMarker(marker: DeepPartial<Marker>): Marker {
  return {
    header: normalizeHeader(marker.header),
    ns: marker.ns ?? "",
    id: marker.id ?? 0,
    type: marker.type ?? 0,
    action: marker.action ?? 0,
    pose: normalizePose(marker.pose),
    scale: normalizeVector3(marker.scale),
    color: normalizeColorRGBA(marker.color),
    lifetime: normalizeTime(marker.lifetime),
    frame_locked: marker.frame_locked ?? false,
    points: normalizeVector3s(marker.points),
    colors: normalizeColorRGBAs(marker.colors),
    text: marker.text ?? "",
    mesh_resource: marker.mesh_resource ?? "",
    mesh_use_embedded_materials: marker.mesh_use_embedded_materials ?? false,
  };
}
