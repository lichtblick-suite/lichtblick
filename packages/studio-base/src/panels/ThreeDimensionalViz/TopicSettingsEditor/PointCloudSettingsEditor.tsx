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
import styled from "styled-components";

import { Color } from "@foxglove/regl-worldview";
import ColorPicker from "@foxglove/studio-base/components/ColorPicker";
import DropdownItem from "@foxglove/studio-base/components/Dropdown/DropdownItem";
import Dropdown from "@foxglove/studio-base/components/Dropdown/index";
import Flex from "@foxglove/studio-base/components/Flex";
import GradientPicker from "@foxglove/studio-base/components/GradientPicker";
import Radio from "@foxglove/studio-base/components/Radio";
import SegmentedControl from "@foxglove/studio-base/components/SegmentedControl";
import CommonPointSettings from "@foxglove/studio-base/panels/ThreeDimensionalViz/TopicSettingsEditor/CommonPointSettings";
import { TopicSettingsEditorProps } from "@foxglove/studio-base/panels/ThreeDimensionalViz/TopicSettingsEditor/types";
import { PointCloud2 } from "@foxglove/studio-base/types/Messages";

import CommonDecaySettings from "./CommonDecaySettings";
import { SLabel, SInput } from "./common";

export type ColorMode =
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
    }
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
    (
      newValue: (ColorMode | undefined) | ((prevColorMode?: ColorMode) => ColorMode | undefined),
    ) => {
      onSettingsChange((newSettings) => ({
        ...newSettings,
        colorMode: typeof newValue === "function" ? newValue(newSettings.colorMode) : newValue,
      }));
    },
    [onSettingsChange],
  );

  const hasRGB = message?.fields?.some(({ name }) => name === "rgb") ?? false;
  const defaultColorField = message?.fields?.find(({ name }) => name !== "rgb")?.name;
  const colorMode: ColorMode =
    settings.colorMode ??
    (hasRGB ? { mode: "rgb" } : { mode: "flat", flatColor: DEFAULT_FLAT_COLOR });

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
              onColorModeChange((prevColorMode) => {
                if (id === "flat") {
                  return {
                    mode: "flat",
                    flatColor:
                      prevColorMode && prevColorMode.mode === "gradient"
                        ? prevColorMode.minColor
                        : DEFAULT_FLAT_COLOR,
                  };
                }
                if (hasRGB) {
                  return { mode: "rgb" };
                }
                return defaultColorField
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
            <ColorPicker
              color={colorMode.flatColor}
              onChange={(flatColor) => onColorModeChange({ mode: "flat", flatColor })}
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
                  if (prevColorMode?.mode === "gradient") {
                    return { ...prevColorMode, colorField: value };
                  }
                  if (prevColorMode?.mode === "rainbow") {
                    return { ...prevColorMode, colorField: value };
                  }
                  return { mode: "rainbow", colorField: value };
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
                  onColorModeChange((prevColorMode) =>
                    prevColorMode?.mode === "gradient" || prevColorMode?.mode === "rainbow"
                      ? { ...prevColorMode, minValue: value === "" ? undefined : +value }
                      : prevColorMode,
                  )
                }
              />
            </Flex>
            <Flex row style={{ flex: "1 1 100%", alignItems: "baseline" }}>
              Max
              <SValueRangeInput
                value={colorMode.maxValue ?? ""}
                onChange={({ target: { value } }) =>
                  onColorModeChange((prevColorMode) =>
                    prevColorMode?.mode === "gradient" || prevColorMode?.mode === "rainbow"
                      ? { ...prevColorMode, maxValue: value === "" ? undefined : +value }
                      : prevColorMode,
                  )
                }
              />
            </Flex>
          </Flex>
          <Radio
            selectedId={colorMode.mode}
            onChange={(id) =>
              onColorModeChange((prevColorMode) => {
                if (prevColorMode?.mode === "rainbow" || prevColorMode?.mode === "gradient") {
                  const { colorField, minValue, maxValue } = prevColorMode;
                  return id === "rainbow"
                    ? { mode: "rainbow", colorField, minValue, maxValue }
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
              onColorModeChange((prevColorMode) =>
                prevColorMode?.mode === "gradient"
                  ? { ...prevColorMode, minColor, maxColor }
                  : prevColorMode,
              )
            }
          />
        </div>
      )}
    </Flex>
  );
}

PointCloudSettingsEditor.canEditNamespaceOverrideColor = true;
