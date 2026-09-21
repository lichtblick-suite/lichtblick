// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import { FeatureGroup, CircleMarker, Marker, PathOptions, Ellipse } from "leaflet";

import { POINT_MARKER_RADIUS } from "@lichtblick/suite-base/panels/Map/constants";
import { MessageEvent } from "@lichtblick/suite-base/players/types";

import "leaflet-ellipse";
import { getAccuracy } from "./getAccuracy";
import { getHeadingFromTrack } from "./getHeading";
import { createOrientedIcon } from "./markerIcons";
import { FilteredPointLayerArgs, NavSatFixMsg } from "./types";

class PointMarker extends CircleMarker {
  public messageEvent?: MessageEvent<NavSatFixMsg>;
}

/**
 * An oriented marker. Carries the same `messageEvent` as {@link PointMarker} so hover and
 * click handling does not care which style is on screen.
 */
class OrientedPointMarker extends Marker {
  public messageEvent?: MessageEvent<NavSatFixMsg>;
}

type AnyPointMarker = PointMarker | OrientedPointMarker;

/** Highlight a marker, whichever style it is drawn in. */
function setMarkerColor(marker: AnyPointMarker, color: string): void {
  if (marker instanceof PointMarker) {
    marker.setStyle({ color });
    return;
  }
  const element = marker.getElement()?.querySelector("path");
  element?.setAttribute("fill", color);
}

/** Raise a marker above its siblings, whichever style it is drawn in. */
function bringMarkerToFront(marker: AnyPointMarker): void {
  if (marker instanceof PointMarker) {
    marker.bringToFront();
  } else {
    marker.setZIndexOffset(1000);
  }
}

/** Return a marker to its resting appearance. */
function resetMarker(marker: AnyPointMarker, style: PathOptions, color: string): void {
  if (marker instanceof PointMarker) {
    marker.setStyle(style);
  } else {
    marker.setZIndexOffset(0);
    setMarkerColor(marker, color);
  }
}

/**
 * Draw the accuracy ellipse for a fix, when the panel asks for it and the message carries a
 * covariance good enough to derive one from.
 */
function addAccuracyMarker(
  layer: FeatureGroup,
  messageEvent: MessageEvent<NavSatFixMsg>,
  color: string,
): void {
  const accuracy = getAccuracy(messageEvent.message);
  if (accuracy == undefined) {
    return;
  }
  const { latitude, longitude } = messageEvent.message;
  new Ellipse([latitude, longitude], accuracy.radii, accuracy.tilt, {
    color,
    fillOpacity: 0.2,
    stroke: false,
  }).addTo(layer);
}

/**
 * Wire hover and click reporting for the layer.
 *
 * Bound on the group rather than on each marker, so the handlers are installed once however
 * many fixes are drawn. Hover state lives here because resetting the previous marker needs to
 * outlive a single event.
 */
function attachInteractionHandlers(
  layer: FeatureGroup,
  args: FilteredPointLayerArgs,
  defaultStyle: PathOptions,
  orientedColor: string,
): void {
  let currentHoveredMarker: AnyPointMarker | undefined;

  const clearHover = () => {
    if (!currentHoveredMarker) {
      return;
    }
    resetMarker(currentHoveredMarker, defaultStyle, orientedColor);
    currentHoveredMarker = undefined;
    args.onHover?.(undefined);
  };

  if (args.onHover) {
    layer.on("mouseover", (event) => {
      const marker = event.sourceTarget as AnyPointMarker;

      // Reset previous hovered marker if there is one
      if (currentHoveredMarker && currentHoveredMarker !== marker) {
        resetMarker(currentHoveredMarker, defaultStyle, orientedColor);
      }

      // Set new marker as hovered
      currentHoveredMarker = marker;
      setMarkerColor(marker, args.hoverColor);
      bringMarkerToFront(marker);
      args.onHover?.(marker.messageEvent);
    });
    layer.on("mouseout", (event) => {
      // Only reset if this is the currently hovered marker
      if (currentHoveredMarker === (event.sourceTarget as AnyPointMarker)) {
        clearHover();
      }
    });

    // Handle case when mouse leaves the entire layer group
    layer.on("mouseleave", clearHover);
  }

  if (args.onClick) {
    layer.on("click", (event) => {
      const marker = event.sourceTarget as AnyPointMarker;
      if (marker.messageEvent) {
        args.onClick?.(marker.messageEvent);
      }
    });
  }
}

/**
 * Create a leaflet LayerGroup with filtered points
 */
function FilteredPointLayer(args: FilteredPointLayerArgs): FeatureGroup {
  const { navSatMessageEvents: points, bounds, map } = args;
  const defaultStyle: PathOptions = {
    stroke: false,
    color: args.color,
    fillOpacity: 1,
  };

  const markersLayer = new FeatureGroup();

  const localBounds = bounds;

  // track which pixels have been used
  const sparse2d: (boolean | undefined)[][] = [];

  const markerStyle = args.markerStyle ?? "dot";
  const orientedColor = args.markerColor ?? args.color;
  // Positions seen so far, used to derive a heading for the oriented styles. Seeded with
  // the caller's earlier track and extended as this layer is built, so a frame containing
  // several fixes orients each one against the ones before it.
  const headingTrack = [...(args.headingTrack ?? [])];

  for (const messageEvent of points) {
    const lat = messageEvent.message.latitude;
    const lon = messageEvent.message.longitude;

    // Oriented styles fall back to a dot when there is nothing to take a bearing from:
    // the first fix of a track, or a platform that has not moved far enough to be sure
    // which way it is pointing.
    const heading =
      markerStyle === "dot" ? undefined : getHeadingFromTrack({ lat, lon }, headingTrack);

    // Every fix contributes to the direction of travel, including the ones that are never
    // drawn. A fix dropped below for being off screen, or for landing on a pixel already
    // taken, still says where the platform went, and leaving it out would take the next
    // bearing from further back than it should.
    headingTrack.push({ lat, lon });

    // if the point is outside the bounds, we don't include it
    if (!localBounds.contains([lat, lon])) {
      continue;
    }

    // get the integer pixel coordinate of the lat/lon and ignore pixels we already have
    const pixelPoint = map.latLngToContainerPoint([lat, lon]);
    const x = Math.trunc(pixelPoint.x);
    const y = Math.trunc(pixelPoint.y);
    if (sparse2d[x]?.[y] === true) {
      continue;
    }

    (sparse2d[x] = sparse2d[x] ?? [])[y] = true;

    const marker: AnyPointMarker =
      markerStyle !== "dot" && heading != undefined
        ? new OrientedPointMarker([lat, lon], {
            icon: createOrientedIcon(markerStyle, orientedColor, heading),
          })
        : new PointMarker([lat, lon], { ...defaultStyle, radius: POINT_MARKER_RADIUS });

    marker.messageEvent = messageEvent;
    marker.addTo(markersLayer);

    if (args.showAccuracy === true) {
      addAccuracyMarker(markersLayer, messageEvent, args.color);
    }
  }

  attachInteractionHandlers(markersLayer, args, defaultStyle, orientedColor);

  return markersLayer;
}

export default FilteredPointLayer;
