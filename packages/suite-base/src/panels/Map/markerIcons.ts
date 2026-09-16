// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { DivIcon } from "leaflet";

import { ORIENTED_MARKER_SIZE } from "@lichtblick/suite-base/panels/Map/constants";
import { MapMarkerStyle } from "@lichtblick/suite-base/panels/Map/types";

/**
 * Glazing, drawn over the body so the vehicle reads as a vehicle rather than a lozenge.
 * A flat light fill rather than a second configurable colour: it reads against every body
 * colour on offer and needs no contrast checking.
 */
const GLASS = "#ffffff";

/** Part of a marker shape. A part with no `fill` takes the marker colour. */
type ShapePart = {
  d: string;
  fill?: string;
};

/**
 * Icon geometry, drawn in a 24x24 box pointing due north so that a single rotation by the
 * heading orients it. Shapes are centred on the box so the marker sits on the fix rather
 * than beside it.
 */
const SHAPES: Record<Exclude<MapMarkerStyle, "dot">, readonly ShapePart[]> = {
  // Chevron. Deliberately platform-neutral: Lichtblick visualises robots, drones and
  // vessels as readily as road vehicles.
  arrow: [{ d: "M12 2 L21 21 L12 16.5 L3 21 Z" }],
  // Plan view of a car, nose at the top: body with wing mirrors, windscreen and rear window.
  // The mirrors and the difference between the two windows are what make the direction of
  // travel readable, since the silhouette alone is nearly symmetric front to back.
  vehicle: [
    { d: "M7 1h10l2 6v2h2v4h-2v8a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-8H3V9h2V7l2-6Z" },
    { d: "m8.5 3-1 4h9l-1-4h-7Zm-.5 13h8v4H8v-4Z", fill: GLASS },
  ],
};

/**
 * SVG markup for an oriented marker.
 *
 * Exported for testing. Callers rendering onto the map want {@link createOrientedIcon}.
 *
 * @param style oriented marker style
 * @param color fill colour of the body
 * @param heading degrees clockwise from north
 */
export function orientedMarkerSvg(
  style: Exclude<MapMarkerStyle, "dot">,
  color: string,
  heading: number,
): string {
  const rotation = isFinite(heading) ? heading : 0;

  const paths = SHAPES[style]
    .map((part) =>
      part.fill == undefined
        ? // A thin contrasting outline keeps the body legible against both the light street
          // tiles and dark satellite imagery, without a second colour to configure.
          `<path d="${part.d}" fill="${color}" stroke="rgba(0,0,0,0.6)" stroke-width="1"` +
          ` stroke-linejoin="round" />`
        : `<path d="${part.d}" fill="${part.fill}" />`,
    )
    .join("");

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"`,
    ` width="${ORIENTED_MARKER_SIZE}" height="${ORIENTED_MARKER_SIZE}" aria-hidden="true">`,
    `<g transform="rotate(${rotation} 12 12)">`,
    paths,
    `</g></svg>`,
  ].join("");
}

/**
 * Leaflet icon for an oriented marker, anchored at its centre.
 *
 * @param style oriented marker style
 * @param color fill colour of the body
 * @param heading degrees clockwise from north
 */
export function createOrientedIcon(
  style: Exclude<MapMarkerStyle, "dot">,
  color: string,
  heading: number,
): DivIcon {
  const centre = ORIENTED_MARKER_SIZE / 2;

  return new DivIcon({
    // Leaflet applies its own background and border to the default DivIcon class, which
    // would draw a box around the shape.
    className: "",
    html: orientedMarkerSvg(style, color, heading),
    iconSize: [ORIENTED_MARKER_SIZE, ORIENTED_MARKER_SIZE],
    iconAnchor: [centre, centre],
  });
}
