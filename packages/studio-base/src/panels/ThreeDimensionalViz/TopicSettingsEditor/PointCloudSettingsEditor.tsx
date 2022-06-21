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

import {
  Box,
  FormControl,
  FormControlLabel,
  FormLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  SelectChangeEvent,
  TextField,
} from "@mui/material";
import React from "react";

import ColorPicker from "@foxglove/studio-base/components/ColorPicker";
import GradientPicker from "@foxglove/studio-base/components/GradientPicker";
import SegmentedControl from "@foxglove/studio-base/components/SegmentedControl";
import Stack from "@foxglove/studio-base/components/Stack";
import {
  ColorMode,
  DEFAULT_FLAT_COLOR,
  DEFAULT_MAX_COLOR,
  DEFAULT_MIN_COLOR,
  DEFAULT_RGB_BYTE_ORDER,
  getDefaultColorMode,
  isMappedColorMode,
  isRgbColorMode,
  isValidRgbByteOrder,
} from "@foxglove/studio-base/panels/ThreeDimensionalViz/utils/pointCloudColors";
import { PointCloud2 } from "@foxglove/studio-base/types/Messages";
import { mightActuallyBePartial } from "@foxglove/studio-base/util/mightActuallyBePartial";

import CommonDecaySettings from "./CommonDecaySettings";
import CommonPointSettings from "./CommonPointSettings";
import { turboColorString } from "./turboColor";
import { TopicSettingsEditorProps } from "./types";

export type PointCloudSettings = {
  pointSize?: number;
  pointShape?: string;
  decayTime?: number;
  colorMode?: ColorMode;
};

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

  const defaultColorMode = getDefaultColorMode(message);
  const colorMode: ColorMode = settings.colorMode ?? defaultColorMode;

  function onColorModeChange(newValueFn: (prevColorMode: ColorMode) => ColorMode | undefined) {
    onSettingsChange((oldSettings) => ({ ...oldSettings, colorMode: newValueFn(colorMode) }));
  }

  return (
    <Stack flex="auto" gap={1}>
      <CommonPointSettings settings={settings} defaultPointSize={2} onFieldChange={onFieldChange} />
      <CommonDecaySettings settings={settings} onFieldChange={onFieldChange} />

      <FormControl>
        <FormLabel>Color by</FormLabel>
        <Stack direction="row" flex="auto" justifyContent="space-between" gap={1}>
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
                  return defaultColorMode;
                })
              }
              options={[
                { id: "flat", label: "Flat" },
                { id: "data", label: "Point data" },
              ]}
            />
          </Box>
          <Stack direction="row" flex="auto" alignItems="center">
            {colorMode.mode === "flat" ? ( // For flat mode, pick a single color
              <ColorPicker
                color={colorMode.flatColor}
                onChange={(flatColor) => onColorModeChange(() => ({ mode: "flat", flatColor }))}
              /> // Otherwise, choose a field from the point cloud to color by
            ) : (
              <Select
                variant="filled"
                MenuProps={{
                  disablePortal: true,
                  MenuListProps: {
                    dense: true,
                  },
                }}
                onChange={(event: SelectChangeEvent) =>
                  onColorModeChange((prevColorMode) => {
                    if (event.target.value === "rgb" || event.target.value === "rgba") {
                      return { mode: event.target.value };
                    }
                    if (isMappedColorMode(prevColorMode)) {
                      return { ...prevColorMode, colorField: event.target.value };
                    }
                    return { mode: "turbo", colorField: event.target.value };
                  })
                }
                value={
                  colorMode.mode === "rgb" || colorMode.mode === "rgba"
                    ? colorMode.mode
                    : colorMode.colorField
                }
              >
                {message?.fields.map(({ name }) => (
                  <MenuItem key={name} value={name}>
                    {name}
                  </MenuItem>
                ))}
              </Select>
            )}
          </Stack>
        </Stack>
      </FormControl>

      {isRgbColorMode(colorMode) && (
        <RadioGroup
          defaultValue={colorMode.rgbByteOrder ?? DEFAULT_RGB_BYTE_ORDER}
          name="rgb-color-mode-radio-buttons-group"
          onChange={(_event, value: string) => {
            onColorModeChange((prevColorMode) => {
              if (isRgbColorMode(prevColorMode) && isValidRgbByteOrder(value)) {
                const { mode } = prevColorMode;
                return { rgbByteOrder: value, mode };
              }
              return prevColorMode;
            });
          }}
        >
          <FormControlLabel value="rgba" control={<Radio />} label="Byte order RGBA" />
          <FormControlLabel value="abgr" control={<Radio />} label="Byte order ABGR" />
          <FormControlLabel value="bgra" control={<Radio />} label="Byte order BGRA (RViz/PCL)" />
        </RadioGroup>
      )}

      {isMappedColorMode(colorMode) && (
        <Stack flex="auto">
          <FormLabel>Value range</FormLabel>
          <Stack direction="row" flex="auto" gap={1}>
            <Stack direction="row" flex="1 1 100%" alignItems="baseline" gap={1}>
              <TextField
                label="Min"
                type="number"
                placeholder="auto"
                variant="filled"
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
            <Stack direction="row" flex="1 1 100%" alignItems="baseline" gap={1}>
              <TextField
                label="Max"
                type="number"
                placeholder="auto"
                variant="filled"
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
          <RadioGroup
            defaultValue={colorMode.mode}
            onChange={(_event, value) =>
              onColorModeChange((prevColorMode) => {
                if (isMappedColorMode(prevColorMode)) {
                  const { colorField, minValue, maxValue } = prevColorMode;
                  return value === "rainbow"
                    ? { mode: "rainbow", colorField, minValue, maxValue }
                    : value === "turbo"
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
          >
            <FormControlLabel
              value="turbo"
              control={<Radio />}
              label={<TurboText>Turbo</TurboText>}
            />
            <FormControlLabel
              value="rainbow"
              control={<Radio />}
              label={<RainbowText>Rainbow</RainbowText>}
            />
            <FormControlLabel value="gradient" control={<Radio />} label="Custom gradient" />
          </RadioGroup>
        </Stack>
      )}
      {colorMode.mode === "gradient" && (
        <Box margin={1}>
          <GradientPicker
            minColor={mightActuallyBePartial(colorMode).minColor ?? DEFAULT_MIN_COLOR}
            maxColor={mightActuallyBePartial(colorMode).maxColor ?? DEFAULT_MAX_COLOR}
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
