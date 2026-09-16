// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { MIN_HEADING_DISTANCE_METERS } from "@lichtblick/suite-base/panels/Map/constants";
import {
  distanceMeters,
  getHeading,
  getHeadingFromTrack,
  headingForTopic,
  precedingTrack,
  TimedFix,
} from "@lichtblick/suite-base/panels/Map/getHeading";
import { NavSatFixMsg, Point } from "@lichtblick/suite-base/panels/Map/types";
import { MessageEvent } from "@lichtblick/suite-base/players/types";

const origin: Point = { lat: 0, lon: 0 };

// One degree of latitude is roughly 111 km, comfortably clear of the jitter threshold.
const NORTH: Point = { lat: 1, lon: 0 };
const EAST: Point = { lat: 0, lon: 1 };
const SOUTH: Point = { lat: -1, lon: 0 };
const WEST: Point = { lat: 0, lon: -1 };

describe("distanceMeters", () => {
  it("returns zero for identical positions without producing NaN", () => {
    expect(distanceMeters(origin, { ...origin })).toBe(0);
  });

  it("measures one degree of latitude as about 111 km", () => {
    expect(distanceMeters(origin, NORTH)).toBeCloseTo(111_195, -2);
  });

  it("is symmetric", () => {
    expect(distanceMeters(origin, EAST)).toBeCloseTo(distanceMeters(EAST, origin), 6);
  });

  it("shrinks a degree of longitude towards the poles", () => {
    const atEquator = distanceMeters({ lat: 0, lon: 0 }, { lat: 0, lon: 1 });
    const atSixty = distanceMeters({ lat: 60, lon: 0 }, { lat: 60, lon: 1 });
    // cos(60 degrees) is 0.5, so a degree of longitude is half as wide there.
    expect(atSixty).toBeCloseTo(atEquator / 2, -2);
  });
});

describe("getHeading", () => {
  it.each([
    ["north", NORTH, 0],
    ["east", EAST, 90],
    ["south", SOUTH, 180],
    ["west", WEST, 270],
  ])("reports travel due %s as %s degrees", (_direction, to, expected) => {
    expect(getHeading(origin, to)).toBeCloseTo(expected, 5);
  });

  it("returns a bearing in the range [0, 360)", () => {
    const heading = getHeading(origin, { lat: -0.5, lon: -0.5 });
    expect(heading).toBeGreaterThanOrEqual(0);
    expect(heading).toBeLessThan(360);
  });

  it("returns undefined for identical positions", () => {
    expect(getHeading(origin, { ...origin })).toBeUndefined();
  });

  it("returns undefined below the jitter threshold", () => {
    // Roughly a tenth of the threshold, expressed in degrees of latitude.
    const tiny = MIN_HEADING_DISTANCE_METERS / 10 / 111_195;
    expect(getHeading(origin, { lat: tiny, lon: 0 })).toBeUndefined();
  });

  it("returns a bearing once the threshold is exceeded", () => {
    const beyond = (MIN_HEADING_DISTANCE_METERS * 10) / 111_195;
    expect(getHeading(origin, { lat: beyond, lon: 0 })).toBeCloseTo(0, 3);
  });

  it.each([
    ["latitude", { lat: NaN, lon: 0 }],
    ["longitude", { lat: 0, lon: Infinity }],
  ])("returns undefined for a non-finite %s", (_field, to) => {
    expect(getHeading(origin, to)).toBeUndefined();
  });
});

describe("getHeadingFromTrack", () => {
  it("returns undefined for an empty track", () => {
    expect(getHeadingFromTrack(NORTH, [])).toBeUndefined();
  });

  it("uses the most recent position, not the oldest", () => {
    // Travelling north then east: the latest leg is eastward.
    const track: Point[] = [SOUTH, origin];
    expect(getHeadingFromTrack(EAST, track)).toBeCloseTo(90, 5);
  });

  it("skips positions inside the jitter threshold", () => {
    const jitter = MIN_HEADING_DISTANCE_METERS / 100 / 111_195;
    // The two most recent entries are stationary noise around the destination; the bearing
    // must come from the genuinely distant position earlier in the track.
    const track: Point[] = [WEST, { lat: jitter, lon: 1 }, { lat: -jitter, lon: 1 }];
    expect(getHeadingFromTrack(EAST, track)).toBeCloseTo(90, 3);
  });

  it("returns undefined when every position is inside the threshold", () => {
    const jitter = MIN_HEADING_DISTANCE_METERS / 100 / 111_195;
    const track: Point[] = [
      { lat: jitter, lon: 0 },
      { lat: -jitter, lon: 0 },
    ];
    expect(getHeadingFromTrack(origin, track)).toBeUndefined();
  });
});

describe("precedingTrack", () => {
  // A platform running north, one fix per second.
  const fixes: TimedFix[] = [
    { timeSec: 1, lat: 0, lon: 0 },
    { timeSec: 2, lat: 1, lon: 0 },
    { timeSec: 3, lat: 2, lon: 0 },
  ];

  it("returns nothing when the frame carries no fixes", () => {
    expect(precedingTrack(fixes, undefined)).toEqual([]);
  });

  it("excludes a fix taken at the frame's own time", () => {
    // That fix is the marker's own position. Including it would hand getHeadingFromTrack a
    // zero-distance pair, which yields no bearing and would mask the genuinely earlier fixes
    // behind it.
    expect(precedingTrack(fixes, 3)).toEqual([
      { lat: 0, lon: 0 },
      { lat: 1, lon: 0 },
    ]);
  });

  it("drops fixes the platform has not reached yet", () => {
    // The regression this function exists for: an uncut track would let a later position
    // stand behind the marker and point it backwards along the route.
    expect(precedingTrack(fixes, 2)).toEqual([{ lat: 0, lon: 0 }]);
  });

  it("returns nothing when no fix precedes the frame", () => {
    expect(precedingTrack(fixes, 1)).toEqual([]);
  });

  it("keeps the order it was given, oldest first", () => {
    // getHeadingFromTrack walks backwards expecting the newest position last, so the order
    // is part of the contract rather than an accident of filtering.
    expect(precedingTrack(fixes, 4)).toEqual([
      { lat: 0, lon: 0 },
      { lat: 1, lon: 0 },
      { lat: 2, lon: 0 },
    ]);
  });

  it("carries only the position, not the timing", () => {
    expect(Object.keys(precedingTrack(fixes, 2)[0]!).sort()).toEqual(["lat", "lon"]);
  });
});

describe("headingForTopic", () => {
  function fix(topic: string, sec: number, lat: number, lon: number): MessageEvent<NavSatFixMsg> {
    return {
      topic,
      schemaName: "sensor_msgs/NavSatFix",
      receiveTime: { sec, nsec: 0 },
      sizeInBytes: 0,
      message: { latitude: lat, longitude: lon },
    };
  }

  const history = [fix("/gps", 1, 0, 0), fix("/gps", 2, 1, 0)];

  it("bears the current fix against the topic's earlier ones", () => {
    // Running north: at latitude 2, having come from 1.
    expect(headingForTopic([fix("/gps", 3, 2, 0)], history, "/gps")).toBeCloseTo(0, 3);
  });

  it("returns undefined when the frame carries no fix on that topic", () => {
    expect(headingForTopic([fix("/other", 3, 2, 0)], history, "/gps")).toBeUndefined();
  });

  it("returns undefined for an empty frame", () => {
    expect(headingForTopic([], history, "/gps")).toBeUndefined();
  });

  it("ignores other topics' fixes when building the track", () => {
    // An eastward fix on another topic must not bend a northward bearing.
    const mixed = [...history, fix("/other", 2, 1, 5)];
    expect(headingForTopic([fix("/gps", 3, 2, 0)], mixed, "/gps")).toBeCloseTo(0, 3);
  });

  it("uses the latest fix in the frame when it carries several", () => {
    // The track ends at (1, 0). Bearing onto the later fix (2, 1) is roughly north east;
    // had the earlier fix (2, 0) been taken instead the bearing would be due north, so the
    // angle alone distinguishes them.
    const frame = [fix("/gps", 3, 2, 0), fix("/gps", 4, 2, 1)];
    expect(headingForTopic(frame, history, "/gps")).toBeCloseTo(45, 0);
  });

  it("returns undefined while the platform has not moved far enough", () => {
    const jitter = MIN_HEADING_DISTANCE_METERS / 100 / 111_195;
    const still = [fix("/gps", 1, 0, 0), fix("/gps", 2, jitter, 0)];
    expect(headingForTopic([fix("/gps", 3, -jitter, 0)], still, "/gps")).toBeUndefined();
  });
});
