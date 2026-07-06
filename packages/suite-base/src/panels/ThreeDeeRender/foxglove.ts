// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { addFoxgloveSchema } from "@lichtblick/suite-base/util/foxgloveSchemas";

// Re-exported so existing consumers keep importing it from here; the single source of truth lives
// in `util/foxgloveSchemas` so the player layer can share it without importing a panel module.
export { COMPRESSED_VIDEO_DATATYPES } from "@lichtblick/suite-base/util/foxgloveSchemas";

export const FRAME_TRANSFORM_DATATYPES = new Set<string>();
addFoxgloveSchema(FRAME_TRANSFORM_DATATYPES, "foxglove.FrameTransform");

export const FRAME_TRANSFORMS_DATATYPES = new Set<string>();
addFoxgloveSchema(FRAME_TRANSFORMS_DATATYPES, "foxglove.FrameTransforms");

export const POINTCLOUD_DATATYPES = new Set<string>();
addFoxgloveSchema(POINTCLOUD_DATATYPES, "foxglove.PointCloud");

export const LASERSCAN_DATATYPES = new Set<string>();
addFoxgloveSchema(LASERSCAN_DATATYPES, "foxglove.LaserScan");

export const RAW_IMAGE_DATATYPES = new Set<string>();
addFoxgloveSchema(RAW_IMAGE_DATATYPES, "foxglove.RawImage");

export const COMPRESSED_IMAGE_DATATYPES = new Set<string>();
addFoxgloveSchema(COMPRESSED_IMAGE_DATATYPES, "foxglove.CompressedImage");

export const CAMERA_CALIBRATION_DATATYPES = new Set<string>();
addFoxgloveSchema(CAMERA_CALIBRATION_DATATYPES, "foxglove.CameraCalibration");

export const SCENE_UPDATE_DATATYPES = new Set<string>();
addFoxgloveSchema(SCENE_UPDATE_DATATYPES, "foxglove.SceneUpdate");

export const POSE_IN_FRAME_DATATYPES = new Set<string>();
addFoxgloveSchema(POSE_IN_FRAME_DATATYPES, "foxglove.PoseInFrame");

export const POSES_IN_FRAME_DATATYPES = new Set<string>();
addFoxgloveSchema(POSES_IN_FRAME_DATATYPES, "foxglove.PosesInFrame");

export const GRID_DATATYPES = new Set<string>();
addFoxgloveSchema(GRID_DATATYPES, "foxglove.Grid");

export const IMAGE_ANNOTATIONS_DATATYPES = new Set<string>();
addFoxgloveSchema(IMAGE_ANNOTATIONS_DATATYPES, "foxglove.ImageAnnotations");
