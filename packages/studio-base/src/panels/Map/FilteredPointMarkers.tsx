// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import { Map, LatLngBounds, LayerGroup, Circle } from "leaflet";

import { MessageEvent } from "@foxglove/studio-base/players/types";

import { NavSatFixMsg } from "./types";

type Args = {
  map: Map;
  bounds: LatLngBounds;
  color: string;
  navSatMessageEvents: readonly MessageEvent<unknown>[];
};

/**
 * Create a leaflet LayerGroup with filtered points
 */
function FilteredPointLayer(args: Args): LayerGroup {
  const { navSatMessageEvents: points, bounds, map } = args;

  const markersLayer = new LayerGroup();

  const localBounds = bounds;

  // track which pixels have been used
  const sparse2d: (boolean | undefined)[][] = [];

  for (const messageEvent of points) {
    const lat = (messageEvent.message as NavSatFixMsg).latitude;
    const lon = (messageEvent.message as NavSatFixMsg).longitude;

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

    const marker = new Circle([lat, lon], {
      radius: 0.1,
      color: args.color,
    });
    marker.addTo(markersLayer);
  }

  return markersLayer;
}

export default FilteredPointLayer;
