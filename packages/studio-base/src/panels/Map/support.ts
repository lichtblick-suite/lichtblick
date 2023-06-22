// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Feature, FeatureCollection, GeoJsonObject } from "geojson";
import { PathOptions, geoJSON } from "leaflet";

import { MessageEvent } from "@foxglove/studio";
import { FoxgloveMessages } from "@foxglove/studio-base/types/FoxgloveMessages";

import { MapPanelMessage, NavSatFixMsg, NavSatFixStatus } from "./types";

export type GeoJsonMessage = MessageEvent<FoxgloveMessages["foxglove.GeoJSON"]>;

/**
 * @returns true if the message event status indicates there is a fix
 */
export function hasFix(ev: MessageEvent<NavSatFixMsg>): boolean {
  switch (ev.message.status?.status) {
    case NavSatFixStatus.STATUS_GBAS_FIX:
    case NavSatFixStatus.STATUS_SBAS_FIX:
    case NavSatFixStatus.STATUS_FIX:
      return true;
    case NavSatFixStatus.STATUS_NO_FIX:
    case undefined:
    default:
      return false;
  }
}

export function isGeoJSONMessage(msgEvent: MessageEvent): msgEvent is GeoJsonMessage {
  const datatype = msgEvent.schemaName;
  return (
    datatype === "foxglove_msgs/GeoJSON" ||
    datatype === "foxglove_msgs/msg/GeoJSON" ||
    datatype === "foxglove.GeoJSON"
  );
}

/**
 * Verify that the message is either a GeoJSON message or a NavSatFix message with a
 * position fix and finite latitude and longitude so we can actually display it.
 */
export function isValidMapMessage(msgEvent: MessageEvent): msgEvent is MapPanelMessage {
  if (isGeoJSONMessage(msgEvent)) {
    return true;
  }

  const message = msgEvent.message as Partial<NavSatFixMsg>;
  return (
    message.latitude != undefined &&
    isFinite(message.latitude) &&
    message.longitude != undefined &&
    isFinite(message.longitude) &&
    message.status?.status !== NavSatFixStatus.STATUS_NO_FIX
  );
}

export function isSupportedSchema(schemaName: string): boolean {
  switch (schemaName) {
    case "sensor_msgs/NavSatFix":
    case "sensor_msgs/msg/NavSatFix":
    case "ros.sensor_msgs.NavSatFix":
    case "foxglove_msgs/LocationFix":
    case "foxglove_msgs/msg/LocationFix":
    case "foxglove.LocationFix":
    case "foxglove_msgs/GeoJSON":
    case "foxglove_msgs/msg/GeoJSON":
    case "foxglove.GeoJSON":
      return true;
    default:
      return false;
  }
}

/**
 * Parse a geoJSON string into individual GeoJsonObjects, extracting the nonstandard
 * `style` property, if it exists.
 */
export function parseGeoJSON(json: string): Array<{ object: GeoJsonObject; style: PathOptions }> {
  try {
    const parsed = JSON.parse(json) as Parameters<typeof geoJSON>[0];
    const geoJsons = parsed ? (Array.isArray(parsed) ? parsed : [parsed]) : [];
    return geoJsons.flatMap((geoJson) => {
      switch (geoJson.type) {
        case "Feature": {
          const style: PathOptions = (geoJson as Feature).properties?.style ?? {};
          return { object: geoJson, style };
        }
        case "FeatureCollection":
          return ((geoJson as Partial<FeatureCollection>).features ?? []).map((feature) => {
            const style: PathOptions = feature.properties?.style ?? {};
            return { object: feature, style };
          });
        default:
          return { object: geoJson, style: {} };
      }
    });
  } catch (error) {
    console.error(error);
    return [];
  }
}
