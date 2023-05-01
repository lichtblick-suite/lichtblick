// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Box } from "@mui/material";
import { StoryFn, StoryObj } from "@storybook/react";
import { useEffect } from "react";

import { fromDate } from "@foxglove/rostime";
import { AppSetting } from "@foxglove/studio-base/AppSetting";
import MockMessagePipelineProvider from "@foxglove/studio-base/components/MessagePipeline/MockMessagePipelineProvider";
import CurrentUserContext, { User } from "@foxglove/studio-base/context/CurrentUserContext";
import { useEvents } from "@foxglove/studio-base/context/EventsContext";
import { useAppConfigurationValue } from "@foxglove/studio-base/hooks";
import { PlayerPresence, Topic } from "@foxglove/studio-base/players/types";
import EventsProvider from "@foxglove/studio-base/providers/EventsProvider";
import WorkspaceContextProvider from "@foxglove/studio-base/providers/WorkspaceContextProvider";

import DataSourceSidebar from "./DataSourceSidebar";

function Wrapper(Story: StoryFn): JSX.Element {
  return (
    <WorkspaceContextProvider>
      <EventsProvider>
        <Story />
      </EventsProvider>
    </WorkspaceContextProvider>
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
  { schemaName: "nav_msgs/OccupancyGrid", name: "/map" },
  { schemaName: "visualization_msgs/MarkerArray", name: "/semantic_map" },
  { schemaName: "tf2_msgs/TFMessage", name: "/tf" },
  { schemaName: "nav_msgs/OccupancyGrid", name: "/drivable_area" },
  { schemaName: "sensor_msgs/PointCloud2", name: "/RADAR_FRONT" },
  { schemaName: "sensor_msgs/PointCloud2", name: "/RADAR_FRONT_LEFT" },
  { schemaName: "sensor_msgs/PointCloud2", name: "/RADAR_FRONT_RIGHT" },
  { schemaName: "sensor_msgs/PointCloud2", name: "/RADAR_BACK_LEFT" },
  { schemaName: "sensor_msgs/PointCloud2", name: "/RADAR_BACK_RIGHT" },
  { schemaName: "sensor_msgs/PointCloud2", name: "/LIDAR_TOP" },
  { schemaName: "sensor_msgs/CompressedImage", name: "/CAM_FRONT/image_rect_compressed" },
  { schemaName: "sensor_msgs/CameraInfo", name: "/CAM_FRONT/camera_info" },
  { schemaName: "visualization_msgs/ImageMarker", name: "/CAM_FRONT/image_markers_lidar" },
  { schemaName: "foxglove_msgs/ImageMarkerArray", name: "/CAM_FRONT/image_markers_annotations" },
  { schemaName: "sensor_msgs/CompressedImage", name: "/CAM_FRONT_RIGHT/image_rect_compressed" },
  { schemaName: "sensor_msgs/CameraInfo", name: "/CAM_FRONT_RIGHT/camera_info" },
  { schemaName: "visualization_msgs/ImageMarker", name: "/CAM_FRONT_RIGHT/image_markers_lidar" },
  { schemaName: "sensor_msgs/CompressedImage", name: "/CAM_BACK_RIGHT/image_rect_compressed" },
  { schemaName: "sensor_msgs/CameraInfo", name: "/CAM_BACK_RIGHT/camera_info" },
  { schemaName: "visualization_msgs/ImageMarker", name: "/CAM_BACK_RIGHT/image_markers_lidar" },
  {
    schemaName: "foxglove_msgs/ImageMarkerArray",
    name: "/CAM_BACK_RIGHT/image_markers_annotations",
  },
  { schemaName: "sensor_msgs/CompressedImage", name: "/CAM_BACK/image_rect_compressed" },
  { schemaName: "sensor_msgs/CameraInfo", name: "/CAM_BACK/camera_info" },
  { schemaName: "visualization_msgs/ImageMarker", name: "/CAM_BACK/image_markers_lidar" },
  { schemaName: "foxglove_msgs/ImageMarkerArray", name: "/CAM_BACK/image_markers_annotations" },
  { schemaName: "sensor_msgs/CompressedImage", name: "/CAM_BACK_LEFT/image_rect_compressed" },
  { schemaName: "sensor_msgs/CameraInfo", name: "/CAM_BACK_LEFT/camera_info" },
  { schemaName: "visualization_msgs/ImageMarker", name: "/CAM_BACK_LEFT/image_markers_lidar" },
  {
    schemaName: "foxglove_msgs/ImageMarkerArray",
    name: "/CAM_BACK_LEFT/image_markers_annotations",
  },
  { schemaName: "sensor_msgs/CompressedImage", name: "/CAM_FRONT_LEFT/image_rect_compressed" },
  { schemaName: "sensor_msgs/CameraInfo", name: "/CAM_FRONT_LEFT/camera_info" },
  { schemaName: "visualization_msgs/ImageMarker", name: "/CAM_FRONT_LEFT/image_markers_lidar" },
  {
    schemaName: "foxglove_msgs/ImageMarkerArray",
    name: "/CAM_FRONT_LEFT/image_markers_annotations",
  },
  { schemaName: "geometry_msgs/PoseStamped", name: "/pose" },
  { schemaName: "sensor_msgs/NavSatFix", name: "/gps" },
  { schemaName: "visualization_msgs/MarkerArray", name: "/markers/annotations" },
  { schemaName: "sensor_msgs/Imu", name: "/imu" },
  { schemaName: "diagnostic_msgs/DiagnosticArray", name: "/diagnostics" },
  { schemaName: "nav_msgs/Odometry", name: "/odom" },
  {
    schemaName: "foxglove_msgs/ImageMarkerArray",
    name: "/CAM_FRONT_RIGHT/image_markers_annotations",
  },
];

export const PlayerNotPresent: StoryObj = {
  render: function Story() {
    return (
      <MockMessagePipelineProvider noActiveData presence={PlayerPresence.NOT_PRESENT}>
        <Box height="100%" bgcolor="background.paper">
          <DataSourceSidebar />
        </Box>
      </MockMessagePipelineProvider>
    );
  },
};
export const PlayerNotPresentChinese: StoryObj = {
  ...PlayerNotPresent,
  parameters: { forceLanguage: "zh" },
};
export const PlayerNotPresentJapanese: StoryObj = {
  ...PlayerNotPresent,
  parameters: { forceLanguage: "ja" },
};

export const PlayerIntializing: StoryObj = {
  render: function Story() {
    return (
      <MockMessagePipelineProvider
        startTime={START_TIME}
        endTime={END_TIME}
        presence={PlayerPresence.INITIALIZING}
      >
        <Box height="100%" bgcolor="background.paper">
          <DataSourceSidebar />
        </Box>
      </MockMessagePipelineProvider>
    );
  },
};
export const PlayerIntializingChinese: StoryObj = {
  ...PlayerIntializing,
  parameters: { forceLanguage: "zh" },
};
export const PlayerIntializingJapanese: StoryObj = {
  ...PlayerIntializing,
  parameters: { forceLanguage: "ja" },
};

export const PlayerReconnecting: StoryObj = {
  render: function Story() {
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
          <DataSourceSidebar />
        </Box>
      </MockMessagePipelineProvider>
    );
  },
};
export const PlayerReconnectingChinese: StoryObj = {
  ...PlayerReconnecting,
  parameters: { forceLanguage: "zh" },
};
export const PlayerReconnectingJapanese: StoryObj = {
  ...PlayerReconnecting,
  parameters: { forceLanguage: "ja" },
};

export const PlayerPresent: StoryObj = {
  render: function Story() {
    return (
      <MockMessagePipelineProvider
        startTime={START_TIME}
        endTime={END_TIME}
        topics={TOPICS}
        presence={PlayerPresence.PRESENT}
      >
        <Box height="100%" bgcolor="background.paper">
          <DataSourceSidebar />
        </Box>
      </MockMessagePipelineProvider>
    );
  },
};

export const PlayerPresentChinese: StoryObj = {
  ...PlayerPresent,
  parameters: { forceLanguage: "zh" },
};
export const PlayerPresentJapanese: StoryObj = {
  ...PlayerPresent,
  parameters: { forceLanguage: "ja" },
};

export const PlayerPresentWithCustomTimezone: StoryObj = {
  render: function Story() {
    const [_, setTimezone] = useAppConfigurationValue<string>(AppSetting.TIMEZONE);

    useEffect(() => {
      setTimezone("Pacific/Ponape").catch(console.error);
    }, [setTimezone]);

    return (
      <MockMessagePipelineProvider
        startTime={fromDate(new Date(2022, 1, 22, 21, 22, 11))}
        endTime={fromDate(new Date(2022, 1, 22, 23, 22, 22))}
        topics={TOPICS}
        presence={PlayerPresence.PRESENT}
      >
        <Box height="100%" bgcolor="background.paper">
          <DataSourceSidebar />
        </Box>
      </MockMessagePipelineProvider>
    );
  },
};
export const PlayerPresentWithCustomTimezoneChinese: StoryObj = {
  ...PlayerPresentWithCustomTimezone,
  parameters: { forceLanguage: "zh" },
};
export const PlayerPresentWithCustomTimezoneJapanese: StoryObj = {
  ...PlayerPresentWithCustomTimezone,
  parameters: { forceLanguage: "ja" },
};

export const WithEvents: StoryObj = {
  render: function Story() {
    const userContextValue = {
      currentUser: { id: "ok" } as User,
      signIn: () => undefined,
      signOut: async () => undefined,
    };

    const setEventsSupported = useEvents((store) => store.setEventsSupported);
    useEffect(() => {
      setEventsSupported(true);
    }, [setEventsSupported]);

    return (
      <MockMessagePipelineProvider
        startTime={START_TIME}
        endTime={END_TIME}
        topics={TOPICS}
        presence={PlayerPresence.PRESENT}
      >
        <CurrentUserContext.Provider value={userContextValue}>
          <Box height="100%" bgcolor="background.paper">
            <DataSourceSidebar />
          </Box>
        </CurrentUserContext.Provider>
      </MockMessagePipelineProvider>
    );
  },
};
export const WithEventsChinese: StoryObj = { ...WithEvents, parameters: { forceLanguage: "zh" } };
export const WithEventsJapanese: StoryObj = { ...WithEvents, parameters: { forceLanguage: "ja" } };

export const PlayerWithError: StoryObj = {
  render: function Story() {
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
          <DataSourceSidebar />
        </Box>
      </MockMessagePipelineProvider>
    );
  },
};
export const PlayerWithErrorChinese: StoryObj = {
  ...PlayerWithError,
  parameters: { forceLanguage: "zh" },
};
export const PlayerWithErrorJapanese: StoryObj = {
  ...PlayerWithError,
  parameters: { forceLanguage: "ja" },
};
