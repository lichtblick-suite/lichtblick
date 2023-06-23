// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import { Map, LatLngBounds, FeatureGroup, CircleMarker, PathOptions, Ellipse } from "leaflet";
import "leaflet-ellipse";

import { MessageEvent } from "@foxglove/studio-base/players/types";

import { getAccuracy } from "./getAccuracy";
import { NavSatFixMsg } from "./types";

export const POINT_MARKER_RADIUS = 3;

type Args = {
  map: Map;
  bounds: LatLngBounds;
  color: string;
  hoverColor: string;
  showAccuracy?: boolean;
  navSatMessageEvents: readonly MessageEvent<NavSatFixMsg>[];
  onHover?: (event: MessageEvent<NavSatFixMsg> | undefined) => void;
  onClick?: (event: MessageEvent<NavSatFixMsg>) => void;
};

class PointMarker extends CircleMarker {
  public messageEvent?: MessageEvent<NavSatFixMsg>;
}

/**
 * Create a leaflet LayerGroup with filtered points
 */
function FilteredPointLayer(args: Args): FeatureGroup {
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
      marker.setStyle({ color: args.hoverColor });
      marker.bringToFront();
      args.onHover?.(marker.messageEvent);
    });
    markersLayer.on("mouseout", (event) => {
      const marker = event.sourceTarget as PointMarker;
      marker.setStyle(defaultStyle);
      args.onHover?.(undefined);
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
