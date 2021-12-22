// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2019-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { Story } from "@storybook/react";
import { CSSProperties } from "react";

import { DEFAULT_CAMERA_STATE } from "@foxglove/regl-worldview";
import MockPanelContextProvider from "@foxglove/studio-base/components/MockPanelContextProvider";
import CameraInfo, {
  CameraInfoProps,
  CAMERA_TAB_TYPE,
} from "@foxglove/studio-base/panels/ThreeDimensionalViz/CameraInfo";
import { colors } from "@foxglove/studio-base/util/sharedStyleConstants";

const containerStyle: CSSProperties = {
  padding: 8,
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-end",
  backgroundColor: colors.DARK,
  height: "100%",
};

const DEFAULT_PROPS: CameraInfoProps = {
  cameraState: DEFAULT_CAMERA_STATE,
  targetPose: undefined,
  followMode: "follow",
  followTf: "some_frame",
  onAlignXYAxis: () => {
    // no-op
  },
  onCameraStateChange: () => {
    // no-op
  },
  showCrosshair: false,
  autoSyncCameraState: false,
};

const CameraInfoWrapper = (props: Partial<CameraInfoProps>) => (
  <div style={containerStyle}>
    <MockPanelContextProvider>
      <CameraInfo {...DEFAULT_PROPS} defaultSelectedTab={CAMERA_TAB_TYPE} {...props} />
    </MockPanelContextProvider>
  </div>
);

export default {
  title: "panels/ThreeDimensionalViz/CameraInfo",
  component: CameraInfo,
};

export const Default: Story = () => {
  return <CameraInfoWrapper />;
};

export const FollowOrientation: Story = () => {
  return <CameraInfoWrapper followMode="follow-orientation" />;
};

export const ShowCrosshair3d: Story = () => {
  return <CameraInfoWrapper showCrosshair />;
};

export const ShowCrosshair2d: Story = () => {
  return (
    <CameraInfoWrapper
      cameraState={{ ...DEFAULT_CAMERA_STATE, perspective: false }}
      showCrosshair
    />
  );
};
