// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import { LatLngBounds } from "leaflet";
import { useMemo, useState } from "react";
import { Circle, useMapEvent } from "react-leaflet";

import { MessageEvent } from "@foxglove/studio-base/players/types";

import { NavSatFixMsg } from "./types";

type TopicTimePoint = {
  topic: string;
  lat: number;
  lon: number;
};

type Props = {
  currentPoints: readonly MessageEvent<unknown>[];
  allPoints: readonly MessageEvent<unknown>[];
};

// renders circle markers for all topic/points excluding points at the same pixel
export default function FilteredPointMarkers(props: Props): JSX.Element {
  const [bounds, setBounds] = useState<LatLngBounds | undefined>();

  const map = useMapEvent("moveend", () => {
    setBounds(map.getBounds());
  });

  const { currentPoints, allPoints } = props;
  const filteredAllPoints = useMemo<TopicTimePoint[]>(() => {
    const arr: TopicTimePoint[] = [];
    const localBounds = bounds ?? map.getBounds();

    // track which pixels have been used
    const sparse2d: (boolean | undefined)[][] = [];

    for (const messageEvent of allPoints) {
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
      arr.push({
        topic: messageEvent.topic,
        lat,
        lon,
      });
    }

    return arr;
  }, [bounds, allPoints, map]);

  const filteredCurrentPoints = useMemo<TopicTimePoint[]>(() => {
    const arr: TopicTimePoint[] = [];
    const localBounds = bounds ?? map.getBounds();

    // track which pixels have been used
    const sparse2d: (boolean | undefined)[][] = [];

    for (const messageEvent of currentPoints) {
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
      arr.push({
        topic: messageEvent.topic,
        lat,
        lon,
      });
    }
    return arr;
  }, [bounds, map, currentPoints]);

  return (
    <>
      {filteredAllPoints.map((topicPoint) => {
        return (
          <Circle
            key={`${topicPoint.lat}+${topicPoint.lon}`}
            center={[topicPoint.lat, topicPoint.lon]}
            radius={0.01}
          />
        );
      })}
      {filteredCurrentPoints.map((topicPoint) => {
        return (
          <Circle
            key={`${topicPoint.lat}+${topicPoint.lon}`}
            center={[topicPoint.lat, topicPoint.lon]}
            radius={0.01}
          />
        );
      })}
    </>
  );
}
