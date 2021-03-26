// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Calibration } from "./Calibration";
import { PointCloud } from "./PointCloud";
import { RawBlock } from "./RawBlock";
import { RawPacket } from "./RawPacket";
import { BlockId, FactoryId, LaserCorrection, Model, ReturnMode } from "./VelodyneTypes";

const VLP16_SCANS_PER_FIRING = 16;
const VLP16_BLOCK_TDURATION = 110.592; // [µs]
const VLP16_DSR_TOFFSET = 2.304; // [µs]
const VLP16_FIRING_TOFFSET = 55.296; // [µs]
const VLS128_DISTANCE_RESOLUTION = 0.004; // [m]

export type TransformerOptions = {
  minRange?: number;
  maxRange?: number;
  minAngle?: number;
  maxAngle?: number;
};

type Point = [x: number, y: number, z: number];

export class Transformer {
  calibration: Calibration;
  minRange: number; // [m]
  maxRange: number; // [m]
  minAngle: number; // [0-35999], degrees as uint16
  maxAngle: number; // [0-35999], degrees as uint16

  constructor(
    calibration: Calibration,
    { minRange, maxRange, minAngle, maxAngle }: TransformerOptions = {},
  ) {
    const [defMinRange, defMaxRange] = defaultRange(calibration.model);
    this.calibration = calibration;
    this.minRange = minRange ?? defMinRange;
    this.maxRange = maxRange ?? defMaxRange;
    this.minAngle = minAngle ?? 0;
    this.maxAngle = maxAngle ?? 35999;
  }

  unpack(raw: RawPacket, scanStamp: number, packetStamp: number, output: PointCloud): void {
    switch (raw.factoryId) {
      case FactoryId.VLP16:
      case FactoryId.VLP16HiRes:
        return this._unpackVLP16(raw, scanStamp, packetStamp, output);
      case FactoryId.VLS128:
      case FactoryId.VLS128Old:
        return this._unpackVLS128(raw, scanStamp, packetStamp, output);
      default:
        return this._unpackGeneric(raw, scanStamp, packetStamp, output);
    }
  }

  private _unpackGeneric(
    raw: RawPacket,
    scanStamp: number,
    packetStamp: number,
    output: PointCloud,
  ): void {
    const timeDiffStartToThisPacket = packetStamp - scanStamp;
    const xyz: Point = [0, 0, 0];

    for (let i = 0; i < RawPacket.BLOCKS_PER_PACKET; i++) {
      const block = raw.blocks[i] as RawBlock;
      const rawRotation = block.rotation;
      // Discard blocks that are outside the area of interest
      if (!angleInRange(rawRotation, this.minAngle, this.maxAngle)) {
        continue;
      }

      const timingOffsetsRow = this.calibration.timingOffsets[i] ?? [];
      // upper bank lasers are numbered [0..31], lower bank lasers are [32..63]
      const bankOrigin = block.isUpperBlock() ? 32 : 0;

      for (let j = 0; j < RawPacket.SCANS_PER_BLOCK; j++) {
        // Discard returns with invalid (zero) distance values
        if (!block.isValid(j)) {
          continue;
        }

        const laserNumber = j + bankOrigin;
        const corrections = this.calibration.laserCorrections[laserNumber] as LaserCorrection;

        // Position
        const rawDistance = block.distance(j);
        const distance =
          rawDistance * this.calibration.distanceResolution + corrections.distCorrection;
        if (rawDistance === 0 || !distanceInRange(distance, this.minRange, this.maxRange)) {
          continue;
        }
        computePosition(distance, rawRotation, this.calibration, corrections, xyz);

        // Intensity
        const rawIntensity = block.intensity(j);
        const intensity = computeIntensity(rawIntensity, rawDistance, corrections);

        // Time
        const offsetSec = timeDiffStartToThisPacket + (timingOffsetsRow[j] ?? 0);

        output.addPoint(
          // Use standard ROS coordinate system (right-hand rule)
          xyz[1],
          -xyz[0],
          xyz[2],
          distance,
          intensity,
          corrections.laserId,
          block.rotation,
          offsetSec * 1e9,
        );
      }
    }
  }

  private _unpackVLS128(
    raw: RawPacket,
    scanStamp: number,
    packetStamp: number,
    output: PointCloud,
  ): void {
    const timeDiffStartToThisPacket = packetStamp - scanStamp;
    const dualReturn = raw.returnMode === ReturnMode.DualReturn ? 1 : 0;
    const blockCount = RawPacket.BLOCKS_PER_PACKET - 4 * dualReturn;
    let azimuth = 0;
    let azimuthNext = 0;
    let azimuthDiff = 0;
    let lastAzimuthDiff = 0;
    const xyz: Point = [0, 0, 0];

    for (let i = 0; i < blockCount; i++) {
      const block = raw.blocks[i] as RawBlock;
      const rawRotation = block.rotation;
      const timingOffsetsRow = this.calibration.timingOffsets[~~(i / 4)] ?? [];
      const bankOrigin = bankOriginForBlock(block.blockId);

      // Calculate difference between current and next block's azimuth angle.
      if (i === 0) {
        azimuth = rawRotation;
      } else {
        azimuth = azimuthNext;
      }
      if (i < RawPacket.BLOCKS_PER_PACKET - (1 + dualReturn)) {
        const nextBlock = raw.blocks[i + (1 + dualReturn)] as RawBlock;
        // Get the next block rotation to calculate how far we rotate between
        // blocks
        azimuthNext = nextBlock.rotation;

        // Finds the difference between two successive blocks
        azimuthDiff = (36000 + azimuthNext - azimuth) % 36000;

        // This is used when the last block is next to predict rotation amount
        lastAzimuthDiff = azimuthDiff;
      } else {
        // This makes the assumption the difference between the last block and the
        // next packet is the same as the last to the second to last. Assumes RPM
        // doesn't change much between blocks
        azimuthDiff = i === RawPacket.BLOCKS_PER_PACKET - 4 * dualReturn - 1 ? 0 : lastAzimuthDiff;
      }

      for (let j = 0; j < RawPacket.SCANS_PER_BLOCK; j++) {
        const rawDistance = block.distance(j);
        const distance = rawDistance * VLS128_DISTANCE_RESOLUTION;
        if (!distanceInRange(distance, this.minRange, this.maxRange)) {
          continue;
        }

        // Offset the laser in this block by which block it's in
        const laserNumber = j + bankOrigin;
        // VLS-128 fires 8 lasers at a time
        const firingOrder = ~~(laserNumber / 8);

        const corrections = this.calibration.laserCorrections[laserNumber] as LaserCorrection;

        // correct for the laser rotation as a function of timing during the
        // firings
        const azimuthCorrection = this.calibration.vls128LaserAzimuthCache[firingOrder] as number;
        const azimuthCorrectedF = azimuth + azimuthDiff * azimuthCorrection;
        const azimuthCorrected = Math.round(azimuthCorrectedF) % 36000;
        if (!angleInRange(azimuthCorrected, this.minAngle, this.maxAngle)) {
          continue;
        }

        // Position
        computePosition(distance, rawRotation, this.calibration, corrections, xyz);

        // Intensity. VLS-128 intensity values can be used directly
        const intensity = block.intensity(j);

        // Time
        const timingIndex = firingOrder + ~~(laserNumber / 64);
        const offsetSec = timeDiffStartToThisPacket + (timingOffsetsRow[timingIndex] ?? 0);

        output.addPoint(
          // Use standard ROS coordinate system (right-hand rule)
          xyz[1],
          -xyz[0],
          xyz[2],
          distance,
          intensity,
          corrections.laserId,
          block.rotation,
          offsetSec * 1e9,
        );
      }
    }
  }

  private _unpackVLP16(
    raw: RawPacket,
    scanStamp: number,
    packetStamp: number,
    output: PointCloud,
  ): void {
    const timeDiffStartToThisPacket = packetStamp - scanStamp;
    let azimuthDiff = 0;
    let lastAzimuthDiff = 0;
    const xyz: Point = [0, 0, 0];

    for (let i = 0; i < RawPacket.BLOCKS_PER_PACKET; i++) {
      const block = raw.blocks[i] as RawBlock;
      const rawRotation = block.rotation;
      const timingOffsetsRow = this.calibration.timingOffsets[i] ?? [];

      // Calculate difference between current and next block's azimuth angle
      if (i < RawPacket.BLOCKS_PER_PACKET - 1) {
        const nextBlock = raw.blocks[i + 1] as RawBlock;

        const rawAzimuthDiff = nextBlock.rotation - block.rotation;
        azimuthDiff = (36000 + rawAzimuthDiff) % 36000;
        // some packets contain an angle overflow where azimuthDiff < 0
        if (rawAzimuthDiff < 0) {
          azimuthDiff = lastAzimuthDiff;
        }
        lastAzimuthDiff = azimuthDiff;
      } else {
        azimuthDiff = lastAzimuthDiff;
      }

      for (let j = 0; j < RawPacket.SCANS_PER_BLOCK; j++) {
        const azimuthCorrected = vlp16AzimuthCorrected(block, j, azimuthDiff);

        // Discard points which are not in the area of interest
        if (!angleInRange(azimuthCorrected, this.minAngle, this.maxAngle)) {
          continue;
        }

        const dsr = j % VLP16_SCANS_PER_FIRING;
        const corrections = this.calibration.laserCorrections[dsr] as LaserCorrection;

        // Position
        const rawDistance = block.distance(j);
        const distance =
          rawDistance * this.calibration.distanceResolution + corrections.distCorrection;
        if (!distanceInRange(distance, this.minRange, this.maxRange)) {
          continue;
        }
        computePosition(distance, rawRotation, this.calibration, corrections, xyz);

        // Intensity
        const rawIntensity = block.intensity(j);
        const intensity = computeIntensity(rawIntensity, rawDistance, corrections);

        // Time
        const offsetSec = timeDiffStartToThisPacket + (timingOffsetsRow[j] ?? 0);

        output.addPoint(
          // Use standard ROS coordinate system (right-hand rule)
          xyz[1],
          -xyz[0],
          xyz[2],
          distance,
          intensity,
          corrections.laserId,
          block.rotation,
          offsetSec * 1e9,
        );
      }
    }
  }
}

// Check if a given angle is within [min..max], handling wraparound
function angleInRange(angle: number, min: number, max: number): boolean {
  if (min <= max) {
    return angle >= min && angle <= max;
  } else {
    return angle >= min || angle <= max;
  }
}

// Check if a given distance is within [min..max]
function distanceInRange(distance: number, min: number, max: number): boolean {
  return distance >= min && distance <= max;
}

// Clamp a value in the range of [min..max]
function clamp(value: number, min: number, max: number): number {
  return value <= min ? min : value >= max ? max : value;
}

// Return the default [min, max] range of valid distances for a given hardware model
function defaultRange(model: Model): [number, number] {
  switch (model) {
    case Model.VLP16:
    case Model.VLP16HiRes:
    case Model.HDL32E:
      return [0.4, 100];
    case Model.HDL64E:
    case Model.HDL64E_S21:
    case Model.HDL64E_S3:
      return [0.4, 120];
    case Model.VLP32C:
      return [0.4, 200];
    case Model.VLS128:
      return [0.4, 300];
  }
}

// Get the first block index for a bank of 32 lasers
function bankOriginForBlock(blockId: BlockId): number {
  switch (blockId) {
    case BlockId.Block_0_To_31:
      return 0;
    case BlockId.Block_32_To_63:
      return 32;
    case BlockId.Block_64_To_95:
      return 64;
    case BlockId.Block_96_To_127:
      return 96;
    default:
      return 0;
  }
}

// Faster Math.pow(x, 2)
function sqr(x: number): number {
  return x * x;
}

// Correct for the laser rotation as a function of timing during the firings
function vlp16AzimuthCorrected(block: RawBlock, laserIndex: number, azimuthDiff: number): number {
  const dsr = laserIndex % VLP16_SCANS_PER_FIRING;
  const firing = ~~(laserIndex / VLP16_SCANS_PER_FIRING);
  const azimuthCorrectedF =
    block.rotation +
    (azimuthDiff * (dsr * VLP16_DSR_TOFFSET + firing * VLP16_FIRING_TOFFSET)) /
      VLP16_BLOCK_TDURATION;
  return Math.round(azimuthCorrectedF) % 36000;
}

// Given an adjusted distance and raw azimuth reading from a laser return and
// calibration data, returns a 3D position
function computePosition(
  distance: number,
  rawRotation: number,
  calibration: Calibration,
  corrections: LaserCorrection,
  output: Point,
) {
  const cosVertAngle = corrections.cosVertCorrection;
  const sinVertAngle = corrections.sinVertCorrection;
  const cosRotCorrection = corrections.cosRotCorrection;
  const sinRotCorrection = corrections.sinRotCorrection;

  const cosRot = calibration.cosRotTable[rawRotation] as number;
  const sinRot = calibration.sinRotTable[rawRotation] as number;
  // cos(a-b) = cos(a)*cos(b) + sin(a)*sin(b)
  const cosRotAngle = cosRot * cosRotCorrection + sinRot * sinRotCorrection;
  // sin(a-b) = sin(a)*cos(b) - cos(a)*sin(b)
  const sinRotAngle = sinRot * cosRotCorrection - cosRot * sinRotCorrection;

  const horizOffset = corrections.horizOffsetCorrection;
  const vertOffset = corrections.vertOffsetCorrection;

  // Compute the distance in the xy plane (w/o accounting for rotation)
  let xyDistance = distance * cosVertAngle - vertOffset * sinVertAngle;

  // Calculate temporal X, use absolute value
  let xx = xyDistance * sinRotAngle - horizOffset * cosRotAngle;
  // Calculate temporal Y, use absolute value
  let yy = xyDistance * cosRotAngle + horizOffset * sinRotAngle;
  if (xx < 0) {
    xx = -xx;
  }
  if (yy < 0) {
    yy = -yy;
  }

  // Get 2 point calibration values, linear interpolation to get distance
  // correction for X and Y. This means distance correction uses different
  // values at different distances
  let distanceCorrX = 0;
  let distanceCorrY = 0;
  if (corrections.twoPtCorrectionAvailable) {
    distanceCorrX =
      ((corrections.distCorrection - corrections.distCorrectionX) * (xx - 2.4)) / (25.04 - 2.4) +
      corrections.distCorrectionX;
    distanceCorrX -= corrections.distCorrection;
    distanceCorrY =
      ((corrections.distCorrection - corrections.distCorrectionY) * (yy - 1.93)) / (25.04 - 1.93) +
      corrections.distCorrectionY;
    distanceCorrY -= corrections.distCorrection;
  }

  const distanceX = distance + distanceCorrX;
  xyDistance = distanceX * cosVertAngle - vertOffset * sinVertAngle;
  output[0] = xyDistance * sinRotAngle - horizOffset * cosRotAngle;

  const distanceY = distance + distanceCorrY;
  xyDistance = distanceY * cosVertAngle - vertOffset * sinVertAngle;
  output[1] = xyDistance * cosRotAngle + horizOffset * sinRotAngle;

  output[2] = distanceY * sinVertAngle + vertOffset * cosVertAngle;
}

// Given raw intensity and distance readings from a laser return and calibration
// data, returns a corrected intensity reading
function computeIntensity(
  rawIntensity: number,
  rawDistance: number,
  corrections: LaserCorrection,
): number {
  const minIntensity = corrections.minIntensity;
  const maxIntensity = corrections.maxIntensity;
  const focalOffset =
    256 * (1 - corrections.focalDistance / 13100) * (1 - corrections.focalDistance / 13100);
  const focalSlope = corrections.focalSlope;
  return clamp(
    rawIntensity + focalSlope * Math.abs(focalOffset - 256 * sqr(1 - rawDistance / 65535)),
    minIntensity,
    maxIntensity,
  );
}
