// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { DeepPartial } from "ts-essentials";

import { Time } from "@foxglove/rostime";

import {
  CameraInfo,
  ColorRGBA,
  CompressedImage,
  Header,
  Image,
  Marker,
  Matrix3,
  Matrix3x4,
  Matrix6,
  Polygon,
  PolygonStamped,
  Pose,
  PoseStamped,
  PoseWithCovariance,
  PoseWithCovarianceStamped,
  Quaternion,
  RegionOfInterest,
  Vector3,
} from "./ros";

export function normalizeTime(time: Partial<Time> | undefined): Time {
  if (!time) {
    return { sec: 0, nsec: 0 };
  }
  return { sec: time.sec ?? 0, nsec: time.nsec ?? 0 };
}

export function normalizeByteArray(byteArray: unknown): Uint8Array {
  if (byteArray == undefined) {
    return new Uint8Array(0);
  } else if (byteArray instanceof Uint8Array) {
    return byteArray;
  } else if (Array.isArray(byteArray) || byteArray instanceof ArrayBuffer) {
    return new Uint8Array(byteArray);
  } else {
    return new Uint8Array(0);
  }
}

export function normalizeImageData(data: unknown): Int8Array | Uint8Array {
  if (data == undefined) {
    return new Uint8Array(0);
  } else if (data instanceof Int8Array || data instanceof Uint8Array) {
    return data;
  } else {
    return new Uint8Array(0);
  }
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

export function normalizeMatrix6(mat: number[] | undefined): Matrix6 {
  if (!mat || mat.length !== 36 || typeof mat[0] !== "number") {
    // prettier-ignore
    return [
      1, 0, 0, 0, 0, 0,
      0, 1, 0, 0, 0, 0,
      0, 0, 1, 0, 0, 0,
      0, 0, 0, 1, 0, 0,
      0, 0, 0, 0, 1, 0,
      0, 0, 0, 0, 0, 1
    ];
  }
  return mat as Matrix6;
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

export function normalizePolygon(polygon: DeepPartial<Polygon> | undefined): Polygon {
  return {
    points: normalizeVector3s(polygon?.points),
  };
}

export function normalizePoseWithCovariance(
  pose: DeepPartial<PoseWithCovariance> | undefined,
): PoseWithCovariance {
  const covariance = normalizeMatrix6(pose?.covariance as number[] | undefined);
  return { pose: normalizePose(pose?.pose), covariance };
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

export function normalizePoseStamped(pose: DeepPartial<PoseStamped>): PoseStamped {
  return {
    header: normalizeHeader(pose.header),
    pose: normalizePose(pose.pose),
  };
}

export function normalizePolygonStamped(polygon: DeepPartial<PolygonStamped>): PolygonStamped {
  return {
    header: normalizeHeader(polygon.header),
    polygon: normalizePolygon(polygon.polygon),
  };
}

export function normalizePoseWithCovarianceStamped(
  message: DeepPartial<PoseWithCovarianceStamped>,
): PoseWithCovarianceStamped {
  return {
    header: normalizeHeader(message.header),
    pose: normalizePoseWithCovariance(message.pose),
  };
}

export function normalizeRegionOfInterest(
  roi: Partial<RegionOfInterest> | undefined,
): RegionOfInterest {
  if (!roi) {
    return { x_offset: 0, y_offset: 0, height: 0, width: 0, do_rectify: false };
  }
  return {
    x_offset: roi.x_offset ?? 0,
    y_offset: roi.y_offset ?? 0,
    height: roi.height ?? 0,
    width: roi.width ?? 0,
    do_rectify: roi.do_rectify ?? false,
  };
}

export function normalizeCameraInfo(
  message: DeepPartial<CameraInfo> &
    DeepPartial<{ d: number[]; k: Matrix3; r: Matrix3; p: Matrix3x4 }>,
): CameraInfo {
  // Handle lowercase field names as well (ROS2 compatibility)
  const D = message.D ?? message.d;
  const K = message.K ?? message.k;
  const R = message.R ?? message.r;
  const P = message.P ?? message.p;

  const Dlen = D?.length ?? 0;
  const Klen = K?.length ?? 0;
  const Rlen = R?.length ?? 0;
  const Plen = P?.length ?? 0;

  return {
    header: normalizeHeader(message.header),
    height: message.height ?? 0,
    width: message.width ?? 0,
    distortion_model: message.distortion_model ?? "",
    D: Dlen > 0 ? D! : [],
    K: Klen === 9 ? (K as Matrix3) : [],
    R: Rlen === 9 ? (R as Matrix3) : [],
    P: Plen === 12 ? (P as Matrix3x4) : [],
    binning_x: message.binning_x ?? 0,
    binning_y: message.binning_y ?? 0,
    roi: normalizeRegionOfInterest(message.roi),
  };
}

export function normalizeImage(message: DeepPartial<Image>): Image {
  return {
    header: normalizeHeader(message.header),
    height: message.height ?? 0,
    width: message.width ?? 0,
    encoding: message.encoding ?? "",
    is_bigendian: message.is_bigendian ?? false,
    step: message.step ?? 0,
    data: normalizeImageData(message.data),
  };
}

export function normalizeCompressedImage(message: DeepPartial<CompressedImage>): CompressedImage {
  return {
    header: normalizeHeader(message.header),
    format: message.format ?? "",
    data: normalizeByteArray(message.data),
  };
}
