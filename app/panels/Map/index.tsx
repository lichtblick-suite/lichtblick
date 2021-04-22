// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Map as LeafMap } from "leaflet";
import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer } from "react-leaflet";

import {
  useBlocksByTopic,
  useDataSourceInfo,
  useMessagesByTopic,
} from "@foxglove-studio/app/PanelAPI";
import EmptyState from "@foxglove-studio/app/components/EmptyState";
import Panel from "@foxglove-studio/app/components/Panel";
import PanelToolbar from "@foxglove-studio/app/components/PanelToolbar";
import Logger from "@foxglove/log";

import FilteredPointMarkers from "./FilteredPointMarkers";
import helpContent from "./index.help.md";
import { BinaryNavSatFixMsg, NavSatFixMsg, Point } from "./types";

import "leaflet/dist/leaflet.css";

const log = Logger.getLogger(__filename);

// persisted panel state
type Config = {
  zoomLevel?: number;
};

type Props = {
  config: Config;
  saveConfig: (config: Config) => void;
};

function MapPanel(props: Props) {
  const { saveConfig, config } = props;
  const [center, setCenter] = useState<Point | undefined>();
  const { topics, playerId } = useDataSourceInfo();

  // clear cached points when the player changes
  useEffect(() => {
    setCenter(undefined);
  }, [playerId]);

  // eligible topics are those that match the message datatypes we support
  const eligibleTopics = useMemo(() => {
    return topics
      .filter((topic) => {
        return topic.datatype === "sensor_msgs/NavSatFix";
      })
      .map((topic) => topic.name);
  }, [topics]);

  useEffect(() => {
    log.debug("Eligible Topics: ", eligibleTopics);
  }, [eligibleTopics]);

  const { blocks } = useBlocksByTopic(eligibleTopics);

  const navMessages = useMessagesByTopic<NavSatFixMsg>({
    topics: eligibleTopics,
    historySize: 1,
  });

  // calculate center point from blocks if we don't have a center point
  useEffect(() => {
    setCenter((old) => {
      // set center only once
      if (old) {
        return old;
      }

      for (const messageBlock of blocks) {
        for (const payloads of Object.values(messageBlock)) {
          for (const payload of payloads) {
            const lat = ((payload.message as unknown) as BinaryNavSatFixMsg).latitude();
            const lon = ((payload.message as unknown) as BinaryNavSatFixMsg).longitude();
            const point: Point = {
              lat,
              lon,
            };

            return point;
          }
        }
      }

      return;
    });
  }, [blocks]);

  // calculate center point from streaming messages if we don't have a center point
  useEffect(() => {
    setCenter((old) => {
      // set center only once
      if (old) {
        return old;
      }

      for (const payloads of Object.values(navMessages)) {
        for (const payload of payloads) {
          const point: Point = {
            lat: payload.message.latitude,
            lon: payload.message.longitude,
          };

          return point;
        }
      }
      return;
    });
  }, [navMessages]);

  const [currentMap, setCurrentMap] = useState<LeafMap | undefined>(undefined);

  // persist panel config on zoom changes
  useEffect(() => {
    if (!currentMap) {
      return;
    }

    const zoomChange = () => {
      saveConfig({
        zoomLevel: currentMap.getZoom(),
      });
    };

    currentMap.on("zoom", zoomChange);
    return () => {
      currentMap.off("zoom", zoomChange);
    };
  }, [currentMap, saveConfig]);

  if (!center) {
    return (
      <>
        <PanelToolbar floating helpContent={helpContent} />
        <EmptyState>Waiting for first gps point...</EmptyState>
      </>
    );
  }

  return (
    <>
      <PanelToolbar floating helpContent={helpContent} />
      <MapContainer
        whenCreated={setCurrentMap}
        preferCanvas
        style={{ width: "100%", height: "100%" }}
        center={[center.lat, center.lon]}
        zoom={config.zoomLevel ?? 15}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxNativeZoom={18}
          maxZoom={24}
        />
        <FilteredPointMarkers messages={navMessages} blocks={blocks} />
      </MapContainer>
    </>
  );
}

MapPanel.panelType = "map";
MapPanel.defaultConfig = {
  zoomLevel: 10,
} as Config;
MapPanel.supportsStrictMode = false;

export default Panel(MapPanel);
