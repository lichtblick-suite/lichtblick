// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import { MutableRefObject, useMemo, useState } from "react";
import { Circle, useMapEvent } from "react-leaflet";
import { useThrottle } from "react-use";

import { PointCache } from "./types";

type TopicTimePoint = {
  stamp: number;
  topic: string;
  lat: number;
  lon: number;
};

// renders circle markers for all topic/points excluding points at the same pixel
export default function FilteredPointMarkers(props: {
  pointsByTopic: MutableRefObject<Map<string, PointCache>>;
}) {
  // cache bust when zoom changes and we should re-filter
  const [zoomChange, setZoomChange] = useState(0);

  const map = useMapEvent("zoom", () => {
    setZoomChange((old) => old + 1);
  });

  // count up the total points to re-memo when the total point count changes
  // is is because pointsByTopic is a stable ref
  const totalPoints = [...props.pointsByTopic.current.values()].reduce((prev, curr) => {
    return prev + curr.size;
  }, 0);
  const totalThrottled = useThrottle(totalPoints, 250);

  const { pointsByTopic } = props;
  const filtered = useMemo<TopicTimePoint[]>(() => {
    // to make exhaustive-deps lint check happy
    // we need to bust our filter when zoom changes
    zoomChange;
    totalThrottled;

    const arr: TopicTimePoint[] = [];

    const sparse2d: (boolean | undefined)[][] = [];
    for (const [topic, cache] of pointsByTopic.current) {
      for (const [stamp, point] of cache) {
        const pt = {
          topic,
          stamp,
          lat: point.lat,
          lon: point.lon,
        };

        // get the integer pixel coordinate of the lat/lon and ignore pixels we already have
        const pixelPoint = map.latLngToContainerPoint([pt.lat, pt.lon]);
        const x = Math.trunc(pixelPoint.x);
        const y = Math.trunc(pixelPoint.y);
        if (sparse2d[x]?.[y] === true) {
          continue;
        }

        (sparse2d[x] = sparse2d[x] ?? [])[y] = true;
        arr.push(pt);
      }
    }
    return arr;
  }, [map, pointsByTopic, totalThrottled, zoomChange]);

  return (
    <>
      {filtered.map((topicPoint) => {
        return (
          <Circle
            key={`${topicPoint.topic}+${topicPoint.stamp}`}
            center={[topicPoint.lat, topicPoint.lon]}
            radius={0.1}
          />
        );
      })}
    </>
  );
}
