// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import { LatLngBounds } from "leaflet";
import { useMemo, useState } from "react";
import { Circle, useMapEvent } from "react-leaflet";

import { useMessagesByTopic } from "@foxglove-studio/app/PanelAPI";
import { MessageBlock } from "@foxglove-studio/app/PanelAPI/useBlocksByTopic";

import { NavSatFixMsg } from "./types";

type TopicTimePoint = {
  topic: string;
  lat: number;
  lon: number;
};

type Props = {
  messages: ReturnType<typeof useMessagesByTopic>;
  blocks: readonly MessageBlock[];
};

// renders circle markers for all topic/points excluding points at the same pixel
export default function FilteredPointMarkers(props: Props): JSX.Element {
  const [bounds, setBounds] = useState<LatLngBounds | undefined>();

  const map = useMapEvent("moveend", () => {
    setBounds(map.getBounds());
  });

  const { messages, blocks } = props;
  const filteredBlocks = useMemo<TopicTimePoint[]>(() => {
    const arr: TopicTimePoint[] = [];
    const localBounds = bounds ?? map.getBounds();

    // track which pixels have been used
    const sparse2d: (boolean | undefined)[][] = [];

    for (const messageBlock of blocks) {
      for (const [topic, payloads] of Object.entries(messageBlock)) {
        for (const payload of payloads) {
          const lat = (payload.message as NavSatFixMsg).latitude;
          const lon = (payload.message as NavSatFixMsg).longitude;

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
            topic,
            lat,
            lon,
          });
        }
      }
    }

    return arr;
  }, [bounds, blocks, map]);

  const filteredMessages = useMemo<TopicTimePoint[]>(() => {
    const arr: TopicTimePoint[] = [];
    const localBounds = bounds ?? map.getBounds();

    // track which pixels have been used
    const sparse2d: (boolean | undefined)[][] = [];

    for (const [topic, payloads] of Object.entries(messages)) {
      for (const payload of payloads) {
        const lat = (payload.message as NavSatFixMsg).latitude;
        const lon = (payload.message as NavSatFixMsg).longitude;

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
          topic,
          lat,
          lon,
        });
      }
    }
    return arr;
  }, [bounds, map, messages]);
  return (
    <>
      {filteredBlocks.map((topicPoint) => {
        return (
          <Circle
            key={`${topicPoint.lat}+${topicPoint.lon}`}
            center={[topicPoint.lat, topicPoint.lon]}
            radius={0.01}
          />
        );
      })}
      {filteredMessages.map((topicPoint) => {
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
