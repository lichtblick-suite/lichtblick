// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Box } from "@mui/material";
import { Story } from "@storybook/react";

import { fromDate } from "@foxglove/rostime";
import MockMessagePipelineProvider from "@foxglove/studio-base/components/MessagePipeline/MockMessagePipelineProvider";
import CurrentUserContext, { User } from "@foxglove/studio-base/context/CurrentUserContext";
import ModalHost from "@foxglove/studio-base/context/ModalHost";
import { PlayerPresence, Topic } from "@foxglove/studio-base/players/types";
import EventsProvider from "@foxglove/studio-base/providers/EventsProvider";

import DataSourceSidebar from "./DataSourceSidebar";

function Wrapper(StoryFn: Story): JSX.Element {
  return (
    <EventsProvider>
      <ModalHost>
        <StoryFn />
      </ModalHost>
    </EventsProvider>
  );
}

export default {
  title: "components/DataSourceSidebar",
  component: DataSourceSidebar,
  decorators: [Wrapper],
};

const START_TIME = fromDate(new Date(2022, 1, 22, 1, 11, 11));
const END_TIME = fromDate(new Date(2022, 1, 22, 22, 22, 22));
const TOPICS: Topic[] = [
  { datatype: "nav_msgs/OccupancyGrid", name: "/map" },
  { datatype: "visualization_msgs/MarkerArray", name: "/semantic_map" },
  { datatype: "tf2_msgs/TFMessage", name: "/tf" },
  { datatype: "nav_msgs/OccupancyGrid", name: "/drivable_area" },
  { datatype: "sensor_msgs/PointCloud2", name: "/RADAR_FRONT" },
  { datatype: "sensor_msgs/PointCloud2", name: "/RADAR_FRONT_LEFT" },
  { datatype: "sensor_msgs/PointCloud2", name: "/RADAR_FRONT_RIGHT" },
  { datatype: "sensor_msgs/PointCloud2", name: "/RADAR_BACK_LEFT" },
  { datatype: "sensor_msgs/PointCloud2", name: "/RADAR_BACK_RIGHT" },
  { datatype: "sensor_msgs/PointCloud2", name: "/LIDAR_TOP" },
  { datatype: "sensor_msgs/CompressedImage", name: "/CAM_FRONT/image_rect_compressed" },
  { datatype: "sensor_msgs/CameraInfo", name: "/CAM_FRONT/camera_info" },
  { datatype: "visualization_msgs/ImageMarker", name: "/CAM_FRONT/image_markers_lidar" },
  { datatype: "foxglove_msgs/ImageMarkerArray", name: "/CAM_FRONT/image_markers_annotations" },
  { datatype: "sensor_msgs/CompressedImage", name: "/CAM_FRONT_RIGHT/image_rect_compressed" },
  { datatype: "sensor_msgs/CameraInfo", name: "/CAM_FRONT_RIGHT/camera_info" },
  { datatype: "visualization_msgs/ImageMarker", name: "/CAM_FRONT_RIGHT/image_markers_lidar" },
  { datatype: "sensor_msgs/CompressedImage", name: "/CAM_BACK_RIGHT/image_rect_compressed" },
  { datatype: "sensor_msgs/CameraInfo", name: "/CAM_BACK_RIGHT/camera_info" },
  { datatype: "visualization_msgs/ImageMarker", name: "/CAM_BACK_RIGHT/image_markers_lidar" },
  { datatype: "foxglove_msgs/ImageMarkerArray", name: "/CAM_BACK_RIGHT/image_markers_annotations" },
  { datatype: "sensor_msgs/CompressedImage", name: "/CAM_BACK/image_rect_compressed" },
  { datatype: "sensor_msgs/CameraInfo", name: "/CAM_BACK/camera_info" },
  { datatype: "visualization_msgs/ImageMarker", name: "/CAM_BACK/image_markers_lidar" },
  { datatype: "foxglove_msgs/ImageMarkerArray", name: "/CAM_BACK/image_markers_annotations" },
  { datatype: "sensor_msgs/CompressedImage", name: "/CAM_BACK_LEFT/image_rect_compressed" },
  { datatype: "sensor_msgs/CameraInfo", name: "/CAM_BACK_LEFT/camera_info" },
  { datatype: "visualization_msgs/ImageMarker", name: "/CAM_BACK_LEFT/image_markers_lidar" },
  { datatype: "foxglove_msgs/ImageMarkerArray", name: "/CAM_BACK_LEFT/image_markers_annotations" },
  { datatype: "sensor_msgs/CompressedImage", name: "/CAM_FRONT_LEFT/image_rect_compressed" },
  { datatype: "sensor_msgs/CameraInfo", name: "/CAM_FRONT_LEFT/camera_info" },
  { datatype: "visualization_msgs/ImageMarker", name: "/CAM_FRONT_LEFT/image_markers_lidar" },
  { datatype: "foxglove_msgs/ImageMarkerArray", name: "/CAM_FRONT_LEFT/image_markers_annotations" },
  { datatype: "geometry_msgs/PoseStamped", name: "/pose" },
  { datatype: "sensor_msgs/NavSatFix", name: "/gps" },
  { datatype: "visualization_msgs/MarkerArray", name: "/markers/annotations" },
  { datatype: "sensor_msgs/Imu", name: "/imu" },
  { datatype: "diagnostic_msgs/DiagnosticArray", name: "/diagnostics" },
  { datatype: "nav_msgs/Odometry", name: "/odom" },
  {
    datatype: "foxglove_msgs/ImageMarkerArray",
    name: "/CAM_FRONT_RIGHT/image_markers_annotations",
  },
];

export const PlayerNotPresent = (): JSX.Element => {
  return (
    <MockMessagePipelineProvider noActiveData presence={PlayerPresence.NOT_PRESENT}>
      <Box height="100%" bgcolor="background.paper">
        <DataSourceSidebar onSelectDataSourceAction={() => {}} />
      </Box>
    </MockMessagePipelineProvider>
  );
};

export const PlayerIntializing = (): JSX.Element => {
  return (
    <MockMessagePipelineProvider
      startTime={START_TIME}
      endTime={END_TIME}
      presence={PlayerPresence.INITIALIZING}
    >
      <Box height="100%" bgcolor="background.paper">
        <DataSourceSidebar onSelectDataSourceAction={() => {}} />
      </Box>
    </MockMessagePipelineProvider>
  );
};

export const PlayerReconnecting = (): JSX.Element => {
  return (
    <MockMessagePipelineProvider
      startTime={START_TIME}
      endTime={END_TIME}
      topics={TOPICS}
      presence={PlayerPresence.RECONNECTING}
      problems={[
        {
          severity: "error",
          message: "Connection lost",
          tip: "A tip that we might want to show the user",
          error: new Error("Original Error"),
        },
      ]}
    >
      <Box height="100%" bgcolor="background.paper">
        <DataSourceSidebar onSelectDataSourceAction={() => {}} />
      </Box>
    </MockMessagePipelineProvider>
  );
};

export const PlayerPresent = (): JSX.Element => {
  return (
    <MockMessagePipelineProvider
      startTime={START_TIME}
      endTime={END_TIME}
      topics={TOPICS}
      presence={PlayerPresence.PRESENT}
    >
      <Box height="100%" bgcolor="background.paper">
        <DataSourceSidebar onSelectDataSourceAction={() => {}} />
      </Box>
    </MockMessagePipelineProvider>
  );
};

export const WithEvents = (): JSX.Element => {
  const userContextValue = {
    currentUser: { id: "ok" } as User,
    signIn: () => undefined,
    signOut: async () => undefined,
  };

  return (
    <MockMessagePipelineProvider
      startTime={START_TIME}
      endTime={END_TIME}
      topics={TOPICS}
      presence={PlayerPresence.PRESENT}
      urlState={{ sourceId: "foxglove-data-platform" }}
    >
      <CurrentUserContext.Provider value={userContextValue}>
        <EventsProvider>
          <Box height="100%" bgcolor="background.paper">
            <DataSourceSidebar onSelectDataSourceAction={() => {}} />
          </Box>
        </EventsProvider>
      </CurrentUserContext.Provider>
    </MockMessagePipelineProvider>
  );
};

export const PlayerWithError = (): JSX.Element => {
  return (
    <MockMessagePipelineProvider
      presence={PlayerPresence.ERROR}
      startTime={START_TIME}
      endTime={END_TIME}
      problems={[
        {
          severity: "error",
          message: "Some message",
          tip: "A tip that we might want to show the user",
          error: new Error("Original Error"),
        },
        {
          severity: "error",
          message:
            "Error initializing player: Error: Cannot identify bag format. at _.verifyBagHeader (https://studio.foxglove.dev/5562.c1166ea8644d0123e6d6.js:2:9) at async _.readHeader (https://studio.foxglove.dev/5562.c1166ea8644d0123e6d6.js:2:69) at async m.open (https://studio.foxglove.dev/5562.c1166ea8644d0123e6d6.js:1:677) at async Se.initialize (https://studio.foxglove.dev/1324.f562ab30da8aea77f0c3.js:15:1986) at async https://studio.foxglove.dev/1324.f562ab30da8aea77f0c3.js:17:4281",
          error: new Error(
            "Error initializing player: Error: Cannot identify bag format. at _.verifyBagHeader (https://studio.foxglove.dev/5562.c1166ea8644d0123e6d6.js:2:9) at async _.readHeader (https://studio.foxglove.dev/5562.c1166ea8644d0123e6d6.js:2:69) at async m.open (https://studio.foxglove.dev/5562.c1166ea8644d0123e6d6.js:1:677) at async Se.initialize (https://studio.foxglove.dev/1324.f562ab30da8aea77f0c3.js:15:1986) at async https://studio.foxglove.dev/1324.f562ab30da8aea77f0c3.js:17:4281",
          ),
          tip: "Is this a bag file?",
        },
        {
          severity: "warn",
          message: "Some longer warning message about sadness",
        },
        {
          severity: "info",
          message: "Some longer info message",
        },
      ]}
    >
      <Box height="100%" bgcolor="background.paper">
        <DataSourceSidebar onSelectDataSourceAction={() => {}} />
      </Box>
    </MockMessagePipelineProvider>
  );
};
