// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Story } from "@storybook/react";

import PointCloudSettingsEditor, { PointCloudSettings } from "./PointCloudSettingsEditor";

export default {
  title: "panels/ThreeDimensionalViz/TopicSettingsEditor/PointCloudSettingsEditor",
  component: PointCloudSettingsEditor,
  decorators: [(StoryComponent: Story): JSX.Element => <StoryComponent />],
};

const RGBA_BLACK = { r: 0, g: 0, b: 0, a: 1 };
const RGBA_WHITE = { r: 255, g: 255, b: 255, a: 1 };
const POSITION = { x: 1, y: 1, z: 1 };

const PointCloudSettingsStory = ({ settings }: { settings: PointCloudSettings }) => {
  return (
    <div style={{ padding: "10px", width: "400px" }}>
      <PointCloudSettingsEditor
        message={{
          header: { frame_id: "", stamp: { sec: 0, nsec: 1 }, seq: 0 },
          fields: [
            { name: "a", datatype: 7, offset: 1, count: 1 },
            { name: "b", datatype: 7, offset: 1, count: 1 },
            { name: "c", datatype: 7, offset: 1, count: 1 },
          ],
          data: new Uint8Array(),
          height: 1,
          width: 1,
          is_bigendian: true,
          point_step: 1,
          row_step: 1,
          is_dense: 1,
          type: 102,
          pose: { position: POSITION, orientation: { ...POSITION, w: 1 } },
        }}
        settings={settings}
        onFieldChange={() => {}}
        onSettingsChange={() => {}}
      />
    </div>
  );
};

export const Default = (): JSX.Element => {
  return <PointCloudSettingsStory settings={{}} />;
};

export const ColorModeRgb = (): JSX.Element => {
  return <PointCloudSettingsStory settings={{ colorMode: { mode: "rgb" } }} />;
};

export const ColorModeRgba = (): JSX.Element => {
  return <PointCloudSettingsStory settings={{ colorMode: { mode: "rgba" } }} />;
};

export const ColorModeFlat = (): JSX.Element => {
  return (
    <PointCloudSettingsStory settings={{ colorMode: { mode: "flat", flatColor: RGBA_WHITE } }} />
  );
};

export const ColorModeGradient = (): JSX.Element => {
  return (
    <PointCloudSettingsStory
      settings={{
        colorMode: {
          mode: "gradient",
          colorField: "b",
          minColor: RGBA_BLACK,
          maxColor: RGBA_WHITE,
        },
      }}
    />
  );
};

export const ColorModeRainbow = (): JSX.Element => {
  return <PointCloudSettingsStory settings={{ colorMode: { mode: "rainbow", colorField: "b" } }} />;
};
