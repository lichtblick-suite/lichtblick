// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

export enum PointFieldDataType {
  INT8 = 1,
  UINT8 = 2,
  INT16 = 3,
  UINT16 = 4,
  INT32 = 5,
  UINT32 = 6,
  FLOAT32 = 7,
  FLOAT64 = 8,
}

export type PointField = {
  name: string;
  offset: number;
  datatype: PointFieldDataType;
  count: number;
};

export type Point = {
  x: number;
  y: number;
  z: number;
  distance: number;
  intensity: number;
  ring: number;
  azimuth: number;
  deltaNs: number;
};

export type PointCloudOptions = {
  stamp: number;
  maxPoints: number;
};

export class PointCloud {
  static POINT_STEP = 28;

  readonly stamp: number;
  readonly fields: PointField[];
  readonly height: number;
  width: number;
  readonly is_bigendian: boolean;
  readonly point_step: number;
  row_step: number;
  data: Uint8Array;
  readonly is_dense: boolean;

  private _view: DataView;

  constructor({ stamp, maxPoints }: PointCloudOptions) {
    this.stamp = stamp;
    this.fields = [
      { name: "x", offset: 0, datatype: PointFieldDataType.FLOAT32, count: 1 },
      { name: "y", offset: 4, datatype: PointFieldDataType.FLOAT32, count: 1 },
      { name: "z", offset: 8, datatype: PointFieldDataType.FLOAT32, count: 1 },
      { name: "distance", offset: 12, datatype: PointFieldDataType.FLOAT32, count: 1 },
      { name: "intensity", offset: 16, datatype: PointFieldDataType.FLOAT32, count: 1 },
      { name: "ring", offset: 20, datatype: PointFieldDataType.UINT16, count: 1 },
      { name: "azimuth", offset: 22, datatype: PointFieldDataType.UINT16, count: 1 },
      { name: "delta_ns", offset: 24, datatype: PointFieldDataType.UINT32, count: 1 },
    ];
    this.height = 1;
    this.width = 0;
    this.is_bigendian = false;
    this.point_step = PointCloud.POINT_STEP;
    this.row_step = 0;
    this.data = new Uint8Array(maxPoints * PointCloud.POINT_STEP);
    this.is_dense = true;

    this._view = new DataView(this.data.buffer, this.data.byteOffset, this.data.byteLength);
  }

  // Add a 3D point to the point cloud and increment the internal data pointer
  addPoint(
    x: number,
    y: number,
    z: number,
    distance: number,
    intensity: number,
    ring: number,
    azimuth: number,
    deltaNs: number, // [ns] Time when this laser was fired relative to the start of the scan
  ): void {
    const offset = this.width * PointCloud.POINT_STEP;
    this._view.setFloat32(offset + 0, x, true);
    this._view.setFloat32(offset + 4, y, true);
    this._view.setFloat32(offset + 8, z, true);
    this._view.setFloat32(offset + 12, distance, true);
    this._view.setFloat32(offset + 16, intensity, true);
    this._view.setUint16(offset + 20, ring, true);
    this._view.setUint16(offset + 22, azimuth, true);
    this._view.setUint32(offset + 24, deltaNs, true);
    this.width++;
    this.row_step = this.width * PointCloud.POINT_STEP;
  }

  // Retrieve a 3D point from this point cloud
  point(index: number): Point {
    const offset = index * PointCloud.POINT_STEP;
    return {
      x: this._view.getFloat32(offset + 0, true),
      y: this._view.getFloat32(offset + 4, true),
      z: this._view.getFloat32(offset + 8, true),
      distance: this._view.getFloat32(offset + 12, true),
      intensity: this._view.getFloat32(offset + 16, true),
      ring: this._view.getUint16(offset + 20, true),
      azimuth: this._view.getUint16(offset + 22, true),
      deltaNs: this._view.getUint32(offset + 24, true),
    };
  }

  // Truncate `data` down to the number of points that have been written so far
  trim(): void {
    this.data = new Uint8Array(this.data.buffer, this.data.byteOffset, this.row_step);
  }
}
