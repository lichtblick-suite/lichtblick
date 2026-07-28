import { produce } from "immer";
import * as _ from "lodash-es";
import { useMemo } from "react";

import { useShallowMemo } from "@lichtblick/hooks";
import { SettingsTreeAction, SettingsTreeNode, SettingsTreeNodes } from "@lichtblick/suite";

import { TacticalMapConfig } from "./types";

export function settingsActionReducer(
  prevConfig: TacticalMapConfig,
  action: SettingsTreeAction,
): TacticalMapConfig {
  return produce(prevConfig, (draft) => {
    if (action.action === "update" && action.payload.path[0] === "topics") {
      _.set(draft, [action.payload.path[1]!], action.payload.value);
    }
  });
}

export function useSettingsTree(config: TacticalMapConfig): SettingsTreeNodes {
  const { odomTopic, plannedPathTopic, hazardZoneTopic, zoneReportTopic, pointCloudTopic } =
    config;

  const topicsNode: SettingsTreeNode = useMemo(
    () => ({
      label: "Topics",
      fields: {
        odomTopic: { label: "Odometry", input: "string", value: odomTopic },
        plannedPathTopic: { label: "Planned path", input: "string", value: plannedPathTopic },
        hazardZoneTopic: { label: "Hazard zone", input: "string", value: hazardZoneTopic },
        zoneReportTopic: { label: "Zone report", input: "string", value: zoneReportTopic },
        pointCloudTopic: { label: "Lidar point cloud", input: "string", value: pointCloudTopic },
      },
    }),
    [odomTopic, plannedPathTopic, hazardZoneTopic, zoneReportTopic, pointCloudTopic],
  );

  return useShallowMemo({ topics: topicsNode });
}
