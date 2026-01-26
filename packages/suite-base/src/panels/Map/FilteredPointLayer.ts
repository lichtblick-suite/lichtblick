// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import { FeatureGroup, CircleMarker, PathOptions, Ellipse } from "leaflet";

import { POINT_MARKER_RADIUS } from "@lichtblick/suite-base/panels/Map/constants";
import { MessageEvent } from "@lichtblick/suite-base/players/types";

import "leaflet-ellipse";
import { getAccuracy } from "./getAccuracy";
import { FilteredPointLayerArgs, NavSatFixMsg } from "./types";

class PointMarker extends CircleMarker {
  public messageEvent?: MessageEvent<NavSatFixMsg>;
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

  // track the currently hovered marker to reset its style when hovering another
  let currentHoveredMarker: PointMarker | undefined;

  for (const messageEvent of points) {
    const lat = messageEvent.message.latitude;
    const lon = messageEvent.message.longitude;

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

    const marker = new PointMarker([lat, lon], { ...defaultStyle, radius: POINT_MARKER_RADIUS });
    marker.messageEvent = messageEvent;
    marker.addTo(markersLayer);

    if (args.showAccuracy === true) {
      const accuracy = getAccuracy(messageEvent.message);
      if (accuracy != undefined) {
        const accuracyMarker = new Ellipse([lat, lon], accuracy.radii, accuracy.tilt, {
          color: args.color,
          fillOpacity: 0.2,
          stroke: false,
        });
        accuracyMarker.addTo(markersLayer);
      }
    }
  }

  if (args.onHover) {
    markersLayer.on("mouseover", (event) => {
      const marker = event.sourceTarget as PointMarker;

      // Reset previous hovered marker if there is one
      if (currentHoveredMarker && currentHoveredMarker !== marker) {
        currentHoveredMarker.setStyle(defaultStyle);
      }

      // Set new marker as hovered
      currentHoveredMarker = marker;
      marker.setStyle({ color: args.hoverColor });
      marker.bringToFront();
      args.onHover?.(marker.messageEvent);
    });
    markersLayer.on("mouseout", (event) => {
      const marker = event.sourceTarget as PointMarker;
      // Only reset if this is the currently hovered marker
      if (currentHoveredMarker === marker) {
        marker.setStyle(defaultStyle);
        currentHoveredMarker = undefined;
        args.onHover?.(undefined);
      }
    });

    // Handle case when mouse leaves the entire layer group
    markersLayer.on("mouseleave", () => {
      if (currentHoveredMarker) {
        currentHoveredMarker.setStyle(defaultStyle);
        currentHoveredMarker = undefined;
        args.onHover?.(undefined);
      }
    });
  }
  if (args.onClick) {
    markersLayer.on("click", (event) => {
      const marker = event.sourceTarget as PointMarker;
      if (marker.messageEvent) {
        args.onClick?.(marker.messageEvent);
      }
    });
  }

  return markersLayer;
}

export default FilteredPointLayer;
