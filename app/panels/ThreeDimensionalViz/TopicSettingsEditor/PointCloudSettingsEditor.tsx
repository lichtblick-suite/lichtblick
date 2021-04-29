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

import React, { useCallback } from "react";
import { Color } from "regl-worldview";
import styled from "styled-components";

import Flex from "@foxglove-studio/app/components/Flex";
import GradientPicker from "@foxglove-studio/app/components/GradientPicker";
import Radio from "@foxglove-studio/app/components/Radio";
import SegmentedControl from "@foxglove-studio/app/components/SegmentedControl";
import { Select, Option } from "@foxglove-studio/app/components/Select";
import CommonPointSettings from "@foxglove-studio/app/panels/ThreeDimensionalViz/TopicSettingsEditor/CommonPointSettings";
import { TopicSettingsEditorProps } from "@foxglove-studio/app/panels/ThreeDimensionalViz/TopicSettingsEditor/types";
import { PointCloud2 } from "@foxglove-studio/app/types/Messages";
import { isNonEmptyOrUndefined } from "@foxglove-studio/app/util/emptyOrUndefined";

import ColorPickerForTopicSettings from "./ColorPickerForTopicSettings";
import CommonDecaySettings from "./CommonDecaySettings";
import { SLabel, SInput } from "./common";

export type ColorMode =
  | { mode: "rgb" }
  | { mode: "flat"; flatColor: Color }
  | {
      mode: "gradient";
      colorField: string;
      minColor: Color;
      maxColor: Color;
      minValue?: number;
      maxValue?: number;
    }
  | {
      mode: "rainbow";
      colorField: string;
      minValue?: number;
      maxValue?: number;
    };

export const DEFAULT_FLAT_COLOR = { r: 1, g: 1, b: 1, a: 1 };
export const DEFAULT_MIN_COLOR = { r: 0, g: 0, b: 1, a: 1 };
export const DEFAULT_MAX_COLOR = { r: 1, g: 0, b: 0, a: 1 };

export type PointCloudSettings = {
  pointSize?: number;
  pointShape?: string;
  decayTime?: number;
  colorMode?: ColorMode;
};

const SValueRangeInput = styled(SInput).attrs({ type: "number", placeholder: "auto" })`
  width: 0px;
  margin-left: 8px;
  flex: 1 1 auto;
`;

const SegmentedControlWrapper = styled.div`
  min-width: 152px;
  display: flex;
  align-items: center;
`;

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

export default function PointCloudSettingsEditor(
  props: TopicSettingsEditorProps<PointCloud2, PointCloudSettings>,
): React.ReactElement {
  const { message, settings = {}, onFieldChange, onSettingsChange } = props;

  const onColorModeChange = useCallback(
    (newValue: (ColorMode | undefined) | ((arg0?: ColorMode) => ColorMode | undefined)) => {
      onSettingsChange((newSettings: any) => ({
        ...newSettings,
        colorMode: typeof newValue === "function" ? newValue(newSettings.colorMode) : newValue,
      }));
    },
    [onSettingsChange],
  );

  const hasRGB = message?.fields?.some(({ name }) => name === "rgb") ?? false;
  const defaultColorField = message?.fields?.find(({ name }) => name !== "rgb")?.name;
  const colorMode: ColorMode = (settings as any).colorMode
    ? (settings as any).colorMode
    : hasRGB
    ? { mode: "rgb" }
    : { mode: "flat", flatColor: DEFAULT_FLAT_COLOR };

  return (
    <Flex col>
      <CommonPointSettings settings={settings} defaultPointSize={2} onFieldChange={onFieldChange} />
      <CommonDecaySettings settings={settings} onFieldChange={onFieldChange} />

      <SLabel>Color by</SLabel>
      <Flex row style={{ justifyContent: "space-between", marginBottom: "8px" }}>
        <SegmentedControlWrapper>
          <SegmentedControl
            selectedId={colorMode.mode === "flat" ? "flat" : "data"}
            onChange={(id) =>
              onColorModeChange((newColorMode) => {
                if (id === "flat") {
                  return {
                    mode: "flat",
                    flatColor:
                      newColorMode && newColorMode.mode === "gradient"
                        ? newColorMode.minColor
                        : DEFAULT_FLAT_COLOR,
                  };
                }
                if (hasRGB) {
                  return { mode: "rgb" };
                }
                return isNonEmptyOrUndefined(defaultColorField)
                  ? { mode: "rainbow", colorField: defaultColorField }
                  : undefined;
              })
            }
            options={[
              { id: "flat", label: "Flat" },
              { id: "data", label: "Point data" },
            ]}
          />
        </SegmentedControlWrapper>
        <Flex row style={{ margin: "2px 0 2px 12px", alignItems: "center" }}>
          {colorMode.mode === "flat" ? ( // For flat mode, pick a single color
            <ColorPickerForTopicSettings
              color={colorMode.flatColor}
              onChange={(flatColor) => onColorModeChange({ mode: "flat", flatColor })}
            /> // Otherwise, choose a field from the point cloud to color by
          ) : (
            <Select
              text={colorMode.mode === "rgb" ? "rgb" : colorMode.colorField}
              value={colorMode.mode === "rgb" ? "rgb" : colorMode.colorField}
              onChange={(value) =>
                onColorModeChange(
                  (newColorMode): ColorMode => {
                    if (value === "rgb") {
                      return { mode: "rgb" };
                    }
                    if (newColorMode && newColorMode.mode === "gradient") {
                      return { ...newColorMode, colorField: value };
                    }
                    if (newColorMode && newColorMode.mode === "rainbow") {
                      return { ...newColorMode, colorField: value };
                    }
                    return { mode: "rainbow", colorField: value };
                  },
                )
              }
            >
              {!message
                ? []
                : message.fields.map(({ name }) => (
                    <Option key={name} value={name}>
                      {name}
                    </Option>
                  ))}
            </Select>
          )}
        </Flex>
      </Flex>

      {(colorMode.mode === "gradient" || colorMode.mode === "rainbow") && (
        <Flex col style={{ marginBottom: "8px" }}>
          <SLabel>Value range</SLabel>
          <Flex row style={{ marginLeft: "8px" }}>
            <Flex row style={{ flex: "1 1 100%", alignItems: "baseline", marginRight: "20px" }}>
              Min
              <SValueRangeInput
                value={colorMode.minValue ?? ""}
                onChange={({ target: { value } }) =>
                  onColorModeChange((newColorMode: any) => ({
                    ...newColorMode,
                    minValue: value === "" ? undefined : +value,
                  }))
                }
              />
            </Flex>
            <Flex row style={{ flex: "1 1 100%", alignItems: "baseline" }}>
              Max
              <SValueRangeInput
                value={colorMode.maxValue ?? ""}
                onChange={({ target: { value } }) =>
                  onColorModeChange((newColorMode: any) => ({
                    ...newColorMode,
                    maxValue: value === "" ? undefined : +value,
                  }))
                }
              />
            </Flex>
          </Flex>
          <Radio
            selectedId={colorMode.mode}
            onChange={(id) =>
              onColorModeChange(({ colorField, minValue, maxValue }: any) =>
                id === "rainbow"
                  ? { mode: "rainbow", colorField, minValue, maxValue }
                  : {
                      mode: "gradient",
                      colorField,
                      minValue,
                      maxValue,
                      minColor: DEFAULT_MIN_COLOR,
                      maxColor: DEFAULT_MAX_COLOR,
                    },
              )
            }
            options={[
              {
                id: "rainbow",
                label:
                  colorMode.mode === "rainbow" ? <RainbowText>Rainbow</RainbowText> : "Rainbow",
              },
              { id: "gradient", label: "Custom gradient" },
            ]}
          />
        </Flex>
      )}
      {colorMode.mode === "gradient" && (
        <div style={{ margin: "8px" }}>
          <GradientPicker
            minColor={colorMode.minColor ?? DEFAULT_MIN_COLOR}
            maxColor={colorMode.maxColor ?? DEFAULT_MAX_COLOR}
            onChange={({ minColor, maxColor }) =>
              onColorModeChange((newColorMode: any) => ({
                mode: "gradient",
                ...newColorMode,
                minColor,
                maxColor,
              }))
            }
          />
        </div>
      )}
    </Flex>
  );
}

PointCloudSettingsEditor.canEditNamespaceOverrideColor = true;
