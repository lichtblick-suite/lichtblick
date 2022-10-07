// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { fromDate } from "@foxglove/rostime";
import MockMessagePipelineProvider from "@foxglove/studio-base/components/MessagePipeline/MockMessagePipelineProvider";
import DataSourceInfoPanel from "@foxglove/studio-base/panels/DataSourceInfo";
import { PlayerPresence, Topic } from "@foxglove/studio-base/players/types";
import PanelSetup from "@foxglove/studio-base/stories/PanelSetup";

export default {
  title: "panels/DataSourceInfo",
  component: DataSourceInfoPanel,
};

const START_TIME = fromDate(new Date(2022, 1, 22, 1, 11, 11));
const END_TIME = fromDate(new Date(2022, 1, 22, 22, 22, 22));
const TOPICS: Topic[] = [
  { schemaName: "nav_msgs/OccupancyGrid", name: "/map" },
  { schemaName: "visualization_msgs/MarkerArray", name: "/semantic_map" },
  { schemaName: "tf2_msgs/TFMessage", name: "/tf" },
  { schemaName: "nav_msgs/OccupancyGrid", name: "/drivable_area" },
  { schemaName: "sensor_msgs/PointCloud2", name: "/RADAR_FRONT" },
  { schemaName: "sensor_msgs/CompressedImage", name: "/CAM_BACK_RIGHT/image_rect_compressed" },
  { schemaName: "sensor_msgs/CameraInfo", name: "/CAM_BACK_RIGHT/camera_info" },
  { schemaName: "visualization_msgs/ImageMarker", name: "/CAM_BACK/image_markers_lidar" },
  { schemaName: "foxglove_msgs/ImageMarkerArray", name: "/CAM_BACK/image_markers_annotations" },
  { schemaName: "geometry_msgs/PoseStamped", name: "/pose" },
  { schemaName: "sensor_msgs/NavSatFix", name: "/gps" },
  { schemaName: "visualization_msgs/MarkerArray", name: "/markers/annotations" },
  { schemaName: "sensor_msgs/Imu", name: "/imu" },
  { schemaName: "diagnostic_msgs/DiagnosticArray", name: "/diagnostics" },
  { schemaName: "nav_msgs/Odometry", name: "/odom" },
];

export function Default(): JSX.Element {
  return (
    <MockMessagePipelineProvider
      startTime={START_TIME}
      endTime={END_TIME}
      topics={TOPICS}
      presence={PlayerPresence.PRESENT}
    >
      <PanelSetup fixture={{ topics: TOPICS }}>
        <DataSourceInfoPanel />
      </PanelSetup>
    </MockMessagePipelineProvider>
  );
}

export function Empty(): JSX.Element {
  return (
    <MockMessagePipelineProvider noActiveData presence={PlayerPresence.NOT_PRESENT}>
      <PanelSetup>
        <DataSourceInfoPanel />
      </PanelSetup>
    </MockMessagePipelineProvider>
  );
}
