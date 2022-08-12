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
  { datatype: "nav_msgs/OccupancyGrid", name: "/map" },
  { datatype: "visualization_msgs/MarkerArray", name: "/semantic_map" },
  { datatype: "tf2_msgs/TFMessage", name: "/tf" },
  { datatype: "nav_msgs/OccupancyGrid", name: "/drivable_area" },
  { datatype: "sensor_msgs/PointCloud2", name: "/RADAR_FRONT" },
  { datatype: "sensor_msgs/CompressedImage", name: "/CAM_BACK_RIGHT/image_rect_compressed" },
  { datatype: "sensor_msgs/CameraInfo", name: "/CAM_BACK_RIGHT/camera_info" },
  { datatype: "visualization_msgs/ImageMarker", name: "/CAM_BACK/image_markers_lidar" },
  { datatype: "foxglove_msgs/ImageMarkerArray", name: "/CAM_BACK/image_markers_annotations" },
  { datatype: "geometry_msgs/PoseStamped", name: "/pose" },
  { datatype: "sensor_msgs/NavSatFix", name: "/gps" },
  { datatype: "visualization_msgs/MarkerArray", name: "/markers/annotations" },
  { datatype: "sensor_msgs/Imu", name: "/imu" },
  { datatype: "diagnostic_msgs/DiagnosticArray", name: "/diagnostics" },
  { datatype: "nav_msgs/Odometry", name: "/odom" },
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
