import { PanelExtensionContext } from "@lichtblick/suite";

export type LidarProfileConfig = {
  hazardZoneTopic: string;
  zoneReportTopic: string;
  pointCloudTopic: string;
};

// Matches the topic constants root-cause-analyzer's RcaEvidenceExtractor.cs already selects for
// the same evidence dataset, so panels work out of the box without per-incident overrides.
export const DEFAULT_CONFIG: LidarProfileConfig = {
  hazardZoneTopic: "/zone/hazard",
  zoneReportTopic: "/sentinel/zone_report",
  pointCloudTopic: "/front_lidar/points",
};

export type LidarProfileProps = {
  context: PanelExtensionContext;
};
