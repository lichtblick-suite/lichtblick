// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { isEqual } from "lodash";

import { decodeMarker } from "./decodeMarker";
import { MemoizedMarker, PointCloudMarker } from "./types";

// Implement manual memoization for markers.
// When rendering point clouds, we always receive the markers that need to be drawn so there's no
// need to keep track of instances that are not rendered anymore.
export function updateMarkerCache(
  existing: Map<Uint8Array, MemoizedMarker>,
  markers: PointCloudMarker[],
): Map<Uint8Array, MemoizedMarker> {
  const markerCache = new Map<Uint8Array, MemoizedMarker>();
  for (const marker of markers) {
    let decoded = existing.get(marker.data);
    // Check if a decoded marker already exists in cache. If not, decode it and save it for later use
    // Compare 'settings' by deep-equality since they may be change by user. Also, the instance is different when re-rendering Layout
    // Compare 'hitmapColors' by reference because the same marker msg may contain different values
    if (
      !decoded ||
      !isEqual(marker.settings, decoded.settings) ||
      marker.hitmapColors !== decoded.hitmapColors
    ) {
      decoded = {
        marker: decodeMarker(marker),
        settings: marker.settings,
        hitmapColors: marker.hitmapColors,
      };
    }

    // Update the marker pose unconditionally since it can change per-frame even
    // when we don't need to do a full point cloud decode
    decoded.marker.pose = marker.pose;

    markerCache.set(marker.data, decoded);
  }
  return markerCache;
}

// Get a memoized marker, if one exists in cache
// This function is used for testing purposes
// ts-prune-ignore-next
export function memoizedMarker(
  cache: Map<Uint8Array, MemoizedMarker>,
  marker: PointCloudMarker,
): PointCloudMarker | undefined {
  return cache.get(marker.data)?.marker;
}
