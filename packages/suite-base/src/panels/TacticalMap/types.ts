import { PanelExtensionContext } from "@lichtblick/suite";

export type TacticalMapConfig = {
  odomTopic: string;
  plannedPathTopic: string;
  hazardZoneTopic: string;
  zoneReportTopic: string;
  pointCloudTopic: string;
};

// Matches the topic constants root-cause-analyzer's RcaEvidenceExtractor.cs already selects for
// the same evidence dataset, so panels work out of the box without per-incident overrides.
export const DEFAULT_CONFIG: TacticalMapConfig = {
  odomTopic: "/odom",
  plannedPathTopic: "/path/planned",
  hazardZoneTopic: "/zone/hazard",
  zoneReportTopic: "/sentinel/zone_report",
  pointCloudTopic: "/front_lidar/points",
};

export type TacticalMapProps = {
  context: PanelExtensionContext;
};
