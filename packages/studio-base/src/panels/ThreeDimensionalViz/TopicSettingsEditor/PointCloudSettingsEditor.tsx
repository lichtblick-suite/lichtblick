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

import { Box, Stack } from "@mui/material";
import React from "react";
import styled from "styled-components";

import { Color } from "@foxglove/regl-worldview";
import ColorPicker from "@foxglove/studio-base/components/ColorPicker";
import DropdownItem from "@foxglove/studio-base/components/Dropdown/DropdownItem";
import Dropdown from "@foxglove/studio-base/components/Dropdown/index";
import GradientPicker from "@foxglove/studio-base/components/GradientPicker";
import Radio from "@foxglove/studio-base/components/Radio";
import SegmentedControl from "@foxglove/studio-base/components/SegmentedControl";
import CommonPointSettings from "@foxglove/studio-base/panels/ThreeDimensionalViz/TopicSettingsEditor/CommonPointSettings";
import { TopicSettingsEditorProps } from "@foxglove/studio-base/panels/ThreeDimensionalViz/TopicSettingsEditor/types";
import { PointCloud2 } from "@foxglove/studio-base/types/Messages";

import CommonDecaySettings from "./CommonDecaySettings";
import { SLabel, SInput } from "./common";
import { turboColorString } from "./turboColor";

type DirectColorMode =
  | {
      mode: "rgb";
      flatColor?: never;
      colorField?: never;
      minColor?: never;
      maxColor?: never;
      minValue?: never;
      maxValue?: never;
    }
  | {
      mode: "flat";
      flatColor: Color;
      colorField?: never;
      minColor?: never;
      maxColor?: never;
      minValue?: never;
      maxValue?: never;
    };

type MappedColorMode =
  | {
      mode: "gradient";
      flatColor?: never;
      colorField: string;
      minColor: Color;
      maxColor: Color;
      minValue?: number;
      maxValue?: number;
    }
  | {
      mode: "rainbow";
      flatColor?: never;
      colorField: string;
      minValue?: number;
      maxValue?: number;
      minColor?: never;
      maxColor?: never;
    }
  | {
      mode: "turbo";
      flatColor?: never;
      colorField: string;
      minValue?: number;
      maxValue?: number;
      minColor?: never;
      maxColor?: never;
    };

export type ColorMode = DirectColorMode | MappedColorMode;

export const DEFAULT_FLAT_COLOR = { r: 1, g: 1, b: 1, a: 1 };
export const DEFAULT_MIN_COLOR = { r: 0, g: 0, b: 1, a: 1 };
export const DEFAULT_MAX_COLOR = { r: 1, g: 0, b: 0, a: 1 };

export type PointCloudSettings = {
  pointSize?: number;
  pointShape?: string;
  decayTime?: number;
  colorMode?: ColorMode;
};

const DEFAULT_COLOR_FIELDS = ["intensity", "i"];

const SValueRangeInput = styled(SInput).attrs({ type: "number", placeholder: "auto" })`
  width: 0px;
  margin-left: 8px;
  flex: 1 1 auto;
`;

function isMappedColorMode(mode: ColorMode): mode is MappedColorMode {
  return mode.mode === "turbo" || mode.mode === "rainbow" || mode.mode === "gradient";
}

const RainbowText = React.memo(function RainbowText({ children }: { children: string }) {
  return (
    <>
      {Array.from(children, (child, idx) => (
        // Rainbow gradient goes from magenta (300) to red (0)
        <span key={idx} style={{ color: `hsl(${300 - 300 * (idx / (length - 1))}, 100%, 60%)` }}>
          {child}
        </span>
      ))}
    </>
  );
});

const TurboText = React.memo(function TurboText({ children }: { children: string }) {
  return (
    <>
      {Array.from(children, (child, idx) => (
        <span key={idx} style={{ color: turboColorString((idx + 1) / (children.length + 1)) }}>
          {child}
        </span>
      ))}
    </>
  );
});

export default function PointCloudSettingsEditor(
  props: TopicSettingsEditorProps<PointCloud2, PointCloudSettings>,
): React.ReactElement {
  const { message, settings = {}, onFieldChange, onSettingsChange } = props;

  const hasRGB = message?.fields?.some(({ name }) => name === "rgb") ?? false;
  const defaultColorField =
    message?.fields?.find(({ name }) => DEFAULT_COLOR_FIELDS.includes(name))?.name ??
    message?.fields?.find(({ name }) => name !== "rgb")?.name;
  const colorMode: ColorMode =
    settings.colorMode ??
    (hasRGB
      ? { mode: "rgb" }
      : defaultColorField
      ? { mode: "turbo", colorField: defaultColorField }
      : { mode: "flat", flatColor: DEFAULT_FLAT_COLOR });

  function onColorModeChange(newValueFn: (prevColorMode: ColorMode) => ColorMode | undefined) {
    onSettingsChange((oldSettings) => ({ ...oldSettings, colorMode: newValueFn(colorMode) }));
  }

  return (
    <Stack flex="auto">
      <CommonPointSettings settings={settings} defaultPointSize={2} onFieldChange={onFieldChange} />
      <CommonDecaySettings settings={settings} onFieldChange={onFieldChange} />

      <SLabel>Color by</SLabel>
      <Stack direction="row" flex="auto" justifyContent="space-between" marginBottom={1}>
        <Box minWidth={152} display="flex" alignItems="center">
          <SegmentedControl
            selectedId={colorMode.mode === "flat" ? "flat" : "data"}
            onChange={(id) =>
              onColorModeChange((prevColorMode) => {
                if (id === "flat") {
                  return {
                    mode: "flat",
                    flatColor:
                      prevColorMode.mode === "gradient"
                        ? prevColorMode.minColor
                        : DEFAULT_FLAT_COLOR,
                  };
                }
                if (hasRGB) {
                  return { mode: "rgb" };
                }
                return defaultColorField
                  ? { mode: "turbo", colorField: defaultColorField }
                  : undefined;
              })
            }
            options={[
              { id: "flat", label: "Flat" },
              { id: "data", label: "Point data" },
            ]}
          />
        </Box>
        <Stack direction="row" flex="auto" alignItems="center" marginY={0.25} marginLeft={1.5}>
          {colorMode.mode === "flat" ? ( // For flat mode, pick a single color
            <ColorPicker
              color={colorMode.flatColor}
              onChange={(flatColor) => onColorModeChange(() => ({ mode: "flat", flatColor }))}
            /> // Otherwise, choose a field from the point cloud to color by
          ) : (
            <Dropdown
              text={colorMode.mode === "rgb" ? "rgb" : colorMode.colorField}
              value={colorMode.mode === "rgb" ? "rgb" : colorMode.colorField}
              onChange={(value) =>
                onColorModeChange((prevColorMode) => {
                  if (value === "rgb") {
                    return { mode: "rgb" };
                  }
                  if (isMappedColorMode(prevColorMode)) {
                    return { ...prevColorMode, colorField: value };
                  }
                  return { mode: "turbo", colorField: value };
                })
              }
              btnStyle={{ padding: "8px 12px" }}
            >
              {!message
                ? []
                : message.fields.map(({ name }) => (
                    <DropdownItem key={name} value={name}>
                      {name}
                    </DropdownItem>
                  ))}
            </Dropdown>
          )}
        </Stack>
      </Stack>

      {isMappedColorMode(colorMode) && (
        <Stack flex="auto" marginBottom={1}>
          <SLabel>Value range</SLabel>
          <Stack direction="row" flex="auto" marginLeft={1}>
            <Stack direction="row" flex="1 1 100%" alignItems="baseline" marginRight={2.5}>
              Min
              <SValueRangeInput
                value={colorMode.minValue ?? ""}
                onChange={({ target: { value } }) =>
                  onColorModeChange((prevColorMode) =>
                    isMappedColorMode(prevColorMode)
                      ? { ...prevColorMode, minValue: value === "" ? undefined : +value }
                      : prevColorMode,
                  )
                }
              />
            </Stack>
            <Stack direction="row" flex="1 1 100%" alignItems="baseline">
              Max
              <SValueRangeInput
                value={colorMode.maxValue ?? ""}
                onChange={({ target: { value } }) =>
                  onColorModeChange((prevColorMode) =>
                    isMappedColorMode(prevColorMode)
                      ? { ...prevColorMode, maxValue: value === "" ? undefined : +value }
                      : prevColorMode,
                  )
                }
              />
            </Stack>
          </Stack>
          <Radio
            selectedId={colorMode.mode}
            onChange={(id) =>
              onColorModeChange((prevColorMode) => {
                if (isMappedColorMode(prevColorMode)) {
                  const { colorField, minValue, maxValue } = prevColorMode;
                  return id === "rainbow"
                    ? { mode: "rainbow", colorField, minValue, maxValue }
                    : id === "turbo"
                    ? { mode: "turbo", colorField, minValue, maxValue }
                    : {
                        mode: "gradient",
                        colorField,
                        minValue,
                        maxValue,
                        minColor: DEFAULT_MIN_COLOR,
                        maxColor: DEFAULT_MAX_COLOR,
                      };
                }
                return prevColorMode;
              })
            }
            options={[
              {
                id: "turbo",
                label: <TurboText>Turbo</TurboText>,
              },
              {
                id: "rainbow",
                label: <RainbowText>Rainbow</RainbowText>,
              },
              { id: "gradient", label: "Custom gradient" },
            ]}
          />
        </Stack>
      )}
      {colorMode.mode === "gradient" && (
        <Box margin={1}>
          <GradientPicker
            minColor={colorMode.minColor ?? DEFAULT_MIN_COLOR}
            maxColor={colorMode.maxColor ?? DEFAULT_MAX_COLOR}
            onChange={({ minColor, maxColor }) =>
              onColorModeChange((prevColorMode) =>
                prevColorMode.mode === "gradient"
                  ? { ...prevColorMode, minColor, maxColor }
                  : prevColorMode,
              )
            }
          />
        </Box>
      )}
    </Stack>
  );
}

PointCloudSettingsEditor.canEditNamespaceOverrideColor = true;
