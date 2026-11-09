// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as _ from "lodash-es";

import { toSec } from "@lichtblick/rostime";
import { MIN_HEADING_DISTANCE_METERS } from "@lichtblick/suite-base/panels/Map/constants";
import { NavSatFixMsg, Point } from "@lichtblick/suite-base/panels/Map/types";
import { MessageEvent } from "@lichtblick/suite-base/players/types";

const EARTH_RADIUS_METERS = 6_371_000;
const DEGREES_TO_RADIANS = Math.PI / 180;
const RADIANS_TO_DEGREES = 180 / Math.PI;

/**
 * Great-circle distance between two positions, in metres.
 *
 * Uses the haversine formula, which stays accurate for the short distances between
 * consecutive GNSS fixes where a planar approximation loses precision near the poles.
 */
export function distanceMeters(from: Point, to: Point): number {
  const fromLat = from.lat * DEGREES_TO_RADIANS;
  const toLat = to.lat * DEGREES_TO_RADIANS;
  const deltaLat = toLat - fromLat;
  const deltaLon = (to.lon - from.lon) * DEGREES_TO_RADIANS;

  const haversine =
    Math.sin(deltaLat / 2) ** 2 + Math.cos(fromLat) * Math.cos(toLat) * Math.sin(deltaLon / 2) ** 2;

  // Clamp against floating point drift, which can push the term marginally outside
  // [0, 1] for near-identical positions and make the sqrt below produce NaN.
  const clamped = Math.min(1, Math.max(0, haversine));

  return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(clamped), Math.sqrt(1 - clamped));
}

/**
 * Initial bearing travelling from one position to another.
 *
 * Returns degrees clockwise from true north in the range [0, 360), or undefined when the
 * two positions are closer together than {@link MIN_HEADING_DISTANCE_METERS}. A stationary
 * receiver still reports slightly different positions from one fix to the next, and a
 * bearing derived from that jitter is noise: it swings wildly and would spin a marker on
 * screen while the platform is not moving.
 *
 * @param from earlier position
 * @param to later position
 * @returns bearing in degrees, or undefined if the positions are too close to be meaningful
 */
export function getHeading(from: Point, to: Point): number | undefined {
  if (
    !Number.isFinite(from.lat) ||
    !Number.isFinite(from.lon) ||
    !Number.isFinite(to.lat) ||
    !Number.isFinite(to.lon)
  ) {
    return undefined;
  }

  if (distanceMeters(from, to) < MIN_HEADING_DISTANCE_METERS) {
    return undefined;
  }

  const fromLat = from.lat * DEGREES_TO_RADIANS;
  const toLat = to.lat * DEGREES_TO_RADIANS;
  const deltaLon = (to.lon - from.lon) * DEGREES_TO_RADIANS;

  const y = Math.sin(deltaLon) * Math.cos(toLat);
  const x =
    Math.cos(fromLat) * Math.sin(toLat) - Math.sin(fromLat) * Math.cos(toLat) * Math.cos(deltaLon);

  return (Math.atan2(y, x) * RADIANS_TO_DEGREES + 360) % 360;
}

/** A position with the time it was received, in seconds. */
export type TimedFix = {
  timeSec: number;
  lat: number;
  lon: number;
};

/**
 * Positions from `fixes` that were received strictly before `beforeSec`, oldest first.
 *
 * The map panel holds every fix in the recording, not only the part already played, so the
 * track handed to {@link getHeadingFromTrack} has to be cut at the current frame. Left
 * uncut, the nearest position "behind" the marker would be the end of the journey and the
 * marker would point back towards somewhere the platform has not reached yet.
 *
 * @param fixes every known fix on the topic, oldest first
 * @param beforeSec time of the frame being drawn; undefined means the frame carries no fixes
 */
export function precedingTrack(fixes: readonly TimedFix[], beforeSec: number | undefined): Point[] {
  if (beforeSec == undefined) {
    return [];
  }

  return fixes.filter((fix) => fix.timeSec < beforeSec).map(({ lat, lon }) => ({ lat, lon }));
}

/**
 * Heading at `to`, derived from the most recent position in `track` that is far enough away
 * to give a meaningful bearing.
 *
 * Walks backwards so the bearing reflects the latest movement rather than the whole journey,
 * and skips positions inside the jitter threshold instead of giving up on the first one. A
 * platform that crawls forward in small increments would otherwise never produce a heading.
 *
 * @param to position whose heading is wanted
 * @param track earlier positions, oldest first
 * @returns bearing in degrees, or undefined if no position in the track is far enough away
 */
export function getHeadingFromTrack(to: Point, track: readonly Point[]): number | undefined {
  for (let i = track.length - 1; i >= 0; i--) {
    const heading = getHeading(track[i]!, to);
    if (heading != undefined) {
      return heading;
    }
  }

  return undefined;
}

/**
 * Heading of one topic at the current frame, for turning the map to match it.
 *
 * Takes the latest fix on `topic` from the current frame and bears it against that topic's
 * earlier fixes. Returns undefined when the frame carries no fix on the topic, or when the
 * platform has not moved far enough for a bearing to mean anything.
 *
 * The track is drawn from the history and the current frame together. A frame can carry
 * several fixes, and the marker layer orients each one against the ones before it in the
 * same frame; building this track from the history alone would take the bearing from an
 * older position and leave the map pointing one way while the marker on it points another.
 *
 * @param currentFrame fixes in the frame being drawn, any topic
 * @param history every known fix, any topic, oldest first
 * @param topic the topic being followed
 */
export function headingForTopic(
  currentFrame: readonly MessageEvent<NavSatFixMsg>[],
  history: readonly MessageEvent<NavSatFixMsg>[],
  topic: string,
): number | undefined {
  const current = _.findLast(currentFrame, (message) => message.topic === topic);
  if (!current) {
    return undefined;
  }

  // The history usually already contains the current frame's fixes, so the two sources
  // overlap. A repeated position is harmless: it sits zero metres from its twin and the
  // bearing threshold steps over it.
  const fixes: TimedFix[] = [...history, ...currentFrame]
    .filter((message) => message.topic === topic)
    .map((message) => ({
      timeSec: toSec(message.receiveTime),
      lat: message.message.latitude,
      lon: message.message.longitude,
    }))
    .sort((a, b) => a.timeSec - b.timeSec);

  return getHeadingFromTrack(
    { lat: current.message.latitude, lon: current.message.longitude },
    precedingTrack(fixes, toSec(current.receiveTime)),
  );
}
