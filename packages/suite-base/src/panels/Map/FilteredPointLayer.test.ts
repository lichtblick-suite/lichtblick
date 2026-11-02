/** @jest-environment jsdom */
// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  DivIcon,
  Ellipse,
  LatLngBounds,
  Map as LeafMap,
  Marker,
  Point as LeafPoint,
} from "leaflet";

import FilteredPointLayer from "@lichtblick/suite-base/panels/Map/FilteredPointLayer";
import {
  NavSatFixMsg,
  NavSatFixPositionCovarianceType,
  Point,
} from "@lichtblick/suite-base/panels/Map/types";
import { MessageEvent } from "@lichtblick/suite-base/players/types";

import "leaflet-ellipse";

// The layer only ever asks the map to project a position, and deduplicates points that land
// on the same pixel. Scaling degrees up keeps distinct fixes on distinct pixels without
// standing up a real map, which jsdom cannot lay out.
const fakeMap = {
  latLngToContainerPoint: ([lat, lon]: [number, number]) =>
    new LeafPoint(Math.round(lon * 10_000), Math.round(-lat * 10_000)),
} as unknown as LeafMap;

const WORLD = new LatLngBounds([-90, -180], [90, 180]);

function navSatFix(lat: number, lon: number): MessageEvent<NavSatFixMsg> {
  return {
    topic: "/gps",
    schemaName: "sensor_msgs/NavSatFix",
    receiveTime: { sec: 0, nsec: 0 },
    sizeInBytes: 0,
    message: { latitude: lat, longitude: lon },
  };
}

function layerFor(
  points: MessageEvent<NavSatFixMsg>[],
  markerStyle: "dot" | "arrow" | "vehicle",
  headingTrack: Point[] = [],
  markerColor?: string,
) {
  return FilteredPointLayer({
    map: fakeMap,
    bounds: WORLD,
    color: "#ff0000",
    hoverColor: "#00ff00",
    navSatMessageEvents: points,
    markerStyle,
    headingTrack,
    markerColor,
  });
}

function orientedMarkers(layer: ReturnType<typeof layerFor>): Marker[] {
  return layer.getLayers().filter((layer_): layer_ is Marker => layer_ instanceof Marker);
}

/** Markup of a marker's icon, or the empty string if it is not drawn as one of ours. */
function markerHtml(marker: Marker): string {
  const { icon } = marker.options;
  if (!(icon instanceof DivIcon)) {
    return "";
  }
  const { html } = icon.options;
  return typeof html === "string" ? html : "";
}

describe("FilteredPointLayer marker styles", () => {
  it("draws circles, never oriented markers, for the dot style", () => {
    const layer = layerFor([navSatFix(0, 0), navSatFix(1, 0)], "dot", [{ lat: -1, lon: 0 }]);

    expect(orientedMarkers(layer)).toHaveLength(0);
  });

  it("orients a marker against the caller's preceding track", () => {
    // Approaching from the south, so the platform is travelling due north.
    const layer = layerFor([navSatFix(1, 0)], "arrow", [{ lat: 0, lon: 0 }]);

    const [marker] = orientedMarkers(layer);
    expect(marker).toBeDefined();
    expect(markerHtml(marker!)).toContain("rotate(0 12 12)");
  });

  it("takes the bearing from the newest position in the track, not the oldest", () => {
    // The journey ran north and then turned east; the marker must follow the last leg.
    const layer = layerFor([navSatFix(0, 1)], "vehicle", [
      { lat: -1, lon: 0 },
      { lat: 0, lon: 0 },
    ]);

    const [marker] = orientedMarkers(layer);
    expect(markerHtml(marker!)).toContain("rotate(90 12 12)");
  });

  it("falls back to a dot when there is no track to take a bearing from", () => {
    const layer = layerFor([navSatFix(1, 0)], "arrow");

    expect(orientedMarkers(layer)).toHaveLength(0);
  });

  it("orients later fixes in a frame against earlier ones in the same frame", () => {
    // No caller track at all: the first fix has nothing behind it and stays a dot, while the
    // second takes its bearing from the first.
    const layer = layerFor([navSatFix(0, 0), navSatFix(1, 0)], "arrow");

    const markers = orientedMarkers(layer);
    expect(markers).toHaveLength(1);
    expect(markerHtml(markers[0]!)).toContain("rotate(0 12 12)");
  });
});

describe("FilteredPointLayer marker colour", () => {
  const track: Point[] = [{ lat: 0, lon: 0 }];

  it("draws the marker in the topic colour when no marker colour is set", () => {
    const layer = layerFor([navSatFix(1, 0)], "vehicle", track);

    expect(markerHtml(orientedMarkers(layer)[0]!)).toContain('fill="#ff0000"');
  });

  it("prefers the marker colour over the topic colour", () => {
    const layer = layerFor([navSatFix(1, 0)], "vehicle", track, "#0000ff");

    const html = markerHtml(orientedMarkers(layer)[0]!);
    expect(html).toContain('fill="#0000ff"');
    expect(html).not.toContain('fill="#ff0000"');
  });
});

describe("FilteredPointLayer heading track", () => {
  it("takes a bearing from a fix that was never drawn", () => {
    // Only the northern half is on screen, so the southern fix is skipped for rendering.
    // It still happened, so the marker that follows it must point north because of it.
    const layer = FilteredPointLayer({
      map: fakeMap,
      bounds: new LatLngBounds([0.5, -180], [90, 180]),
      color: "#ff0000",
      hoverColor: "#00ff00",
      navSatMessageEvents: [navSatFix(0, 0), navSatFix(1, 0)],
      markerStyle: "arrow",
      headingTrack: [],
    });

    const markers = orientedMarkers(layer);
    expect(markers).toHaveLength(1);
    expect(markerHtml(markers[0]!)).toContain("rotate(0 12 12)");
  });
});

describe("FilteredPointLayer interaction", () => {
  const track: Point[] = [{ lat: 0, lon: 0 }];

  function interactiveLayer(markerStyle: "dot" | "vehicle") {
    const onHover = jest.fn();
    const onClick = jest.fn();
    const layer = FilteredPointLayer({
      map: fakeMap,
      bounds: WORLD,
      color: "#ff0000",
      hoverColor: "#00ff00",
      navSatMessageEvents: [navSatFix(1, 0), navSatFix(2, 0)],
      markerStyle,
      headingTrack: track,
      onHover,
      onClick,
    });
    return { layer, onHover, onClick, markers: layer.getLayers() };
  }

  it.each([
    "dot",
    "vehicle",
  ] as const)("reports the hovered message and its release for the %s style", (markerStyle) => {
    const { layer, onHover, markers } = interactiveLayer(markerStyle);

    layer.fire("mouseover", { sourceTarget: markers[0] });
    expect(onHover).toHaveBeenLastCalledWith(expect.objectContaining({ topic: "/gps" }));

    layer.fire("mouseout", { sourceTarget: markers[0] });
    expect(onHover).toHaveBeenLastCalledWith(undefined);
  });

  it("releases the previous marker when the pointer moves straight onto another", () => {
    const { layer, onHover, markers } = interactiveLayer("vehicle");

    layer.fire("mouseover", { sourceTarget: markers[0] });
    layer.fire("mouseover", { sourceTarget: markers[1] });

    // The second hover reports its own message rather than clearing the first.
    expect(onHover).toHaveBeenLastCalledWith(expect.objectContaining({ topic: "/gps" }));
    expect(onHover).toHaveBeenCalledTimes(2);
  });

  it("releases the marker when the pointer leaves the layer entirely", () => {
    const { layer, onHover, markers } = interactiveLayer("vehicle");

    layer.fire("mouseover", { sourceTarget: markers[0] });
    layer.fire("mouseleave", {});

    expect(onHover).toHaveBeenLastCalledWith(undefined);
  });

  it("ignores a mouseout for a marker that is not the hovered one", () => {
    const { layer, onHover, markers } = interactiveLayer("vehicle");

    layer.fire("mouseover", { sourceTarget: markers[0] });
    layer.fire("mouseout", { sourceTarget: markers[1] });

    expect(onHover).toHaveBeenLastCalledWith(expect.objectContaining({ topic: "/gps" }));
  });

  it.each(["dot", "vehicle"] as const)("reports a click for the %s style", (markerStyle) => {
    const { layer, onClick, markers } = interactiveLayer(markerStyle);

    layer.fire("click", { sourceTarget: markers[0] });

    expect(onClick).toHaveBeenCalledWith(expect.objectContaining({ topic: "/gps" }));
  });
});

describe("FilteredPointLayer accuracy", () => {
  /** A fix carrying a diagonal covariance, which is the shape getAccuracy can size an ellipse from. */
  function fixWithCovariance(): MessageEvent<NavSatFixMsg> {
    const fix = navSatFix(1, 0);
    return {
      ...fix,
      message: {
        ...fix.message,
        position_covariance: [9, 0, 0, 0, 25, 0, 0, 0, 0],
        position_covariance_type: NavSatFixPositionCovarianceType.COVARIANCE_TYPE_DIAGONAL_KNOWN,
      },
    };
  }

  function ellipsesFor(
    point: MessageEvent<NavSatFixMsg>,
    showAccuracy: boolean | undefined,
  ): Ellipse[] {
    const layer = FilteredPointLayer({
      map: fakeMap,
      bounds: WORLD,
      color: "#ff0000",
      hoverColor: "#00ff00",
      navSatMessageEvents: [point],
      showAccuracy,
    });
    return layer.getLayers().filter((l): l is Ellipse => l instanceof Ellipse);
  }

  it("draws an ellipse sized from the covariance", () => {
    const ellipses = ellipsesFor(fixWithCovariance(), true);

    expect(ellipses).toHaveLength(1);
    // Radii are the standard deviations, so the square roots of the east and north variances.
    const radius = ellipses[0]!.getRadius();
    expect([radius.x, radius.y]).toEqual([3, 5]);
  });

  // The panel asks for accuracy per topic, not per message, so a topic that mostly reports
  // covariance will still carry fixes that do not. Those draw the marker and nothing else.
  it("draws no ellipse for a fix with no covariance", () => {
    expect(ellipsesFor(navSatFix(1, 0), true)).toHaveLength(0);
  });

  it("draws no ellipse while the setting is off, covariance or not", () => {
    expect(ellipsesFor(fixWithCovariance(), false)).toHaveLength(0);
    expect(ellipsesFor(fixWithCovariance(), undefined)).toHaveLength(0);
  });
});
