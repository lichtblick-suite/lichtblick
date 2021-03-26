// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

export enum Model {
  VLP16,
  VLP16HiRes,
  VLP32C,
  HDL32E,
  HDL64E,
  HDL64E_S21,
  HDL64E_S3,
  VLS128,
}

export enum BlockId {
  Block_0_To_31 = 0xeeff,
  Block_32_To_63 = 0xddff,
  Block_64_To_95 = 0xccff,
  Block_96_To_127 = 0xbbff,
}

export enum StatusType {
  Hours = 72,
  Minutes = 77,
  Seconds = 83,
  Date = 68,
  Month = 78,
  Year = 89,
  GpsStatus = 71,
  Temperature = 84,
  FirmwareVersion = 86,
}

export enum ReturnMode {
  Strongest = 0x37,
  LastReturn = 0x38,
  DualReturn = 0x39,
}

export enum FactoryId {
  HDL32E = 0x21,
  VLP16 = 0x22,
  VLP32AB = 0x23,
  VLP16HiRes = 0x24,
  VLP32C = 0x28,
  Velarray = 0x31,
  VLS128Old = 0x63,
  HDL64 = 0xa0,
  VLS128 = 0xa1,
}

export interface LaserCorrection {
  laserId: number; // ring number for this laser
  rotCorrection: number;
  vertCorrection: number;
  distCorrection: number;
  twoPtCorrectionAvailable: boolean;
  distCorrectionX: number;
  distCorrectionY: number;
  vertOffsetCorrection: number;
  horizOffsetCorrection: number;
  maxIntensity: number;
  minIntensity: number;
  focalDistance: number;
  focalSlope: number;

  // These cached values are calculated when the calibration file is read
  cosRotCorrection: number; // cosine of rotCorrection
  sinRotCorrection: number; // sine of rotCorrection
  cosVertCorrection: number; // cosine of vertCorrection
  sinVertCorrection: number; // sine of vertCorrection
}
