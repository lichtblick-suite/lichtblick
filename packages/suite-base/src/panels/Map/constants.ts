// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

export const POINT_MARKER_RADIUS = 3;

/** Edge length, in pixels, of the square icon used by the oriented marker styles. */
export const ORIENTED_MARKER_SIZE = 24;

/**
 * Minimum travel, in metres, before a bearing between two fixes is considered meaningful.
 *
 * A stationary receiver still reports slightly different positions from one fix to the next.
 * Below this distance the bearing is dominated by that jitter and would spin the marker on
 * screen while the platform is standing still.
 */
export const MIN_HEADING_DISTANCE_METERS = 1;
