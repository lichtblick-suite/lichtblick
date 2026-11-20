// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

/**
 * Estimated serialized size of the non-`data` fields of a `foxglove.PointCloud` (timestamp,
 * frame_id, pose, point_stride, 4 field descriptors). `sizeInBytes` only feeds byte accounting
 * (pipeline/panel telemetry); panels and the MessagePipeline do not branch on it.
 */
export const POINTCLOUD_HEADER_BYTES = 128;

/**
 * Estimated size of one `Sinewave` message (`{ value: float64 }`). `sizeInBytes` only feeds byte
 * accounting (pipeline/panel telemetry); panels and the MessagePipeline do not branch on it.
 */
export const SINEWAVE_MESSAGE_BYTES = 8;
