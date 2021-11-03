// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { ITheme, useTheme } from "@fluentui/react";
import BlockHelperIcon from "@mdi/svg/svg/block-helper.svg";
import { useCallback } from "react";
import styled from "styled-components";
import tinyColor from "tinycolor2";

import { Color } from "@foxglove/regl-worldview";
import Icon from "@foxglove/studio-base/components/Icon";
import { defaultedRGBStringFromColorObj } from "@foxglove/studio-base/util/colorUtils";
import { colors } from "@foxglove/studio-base/util/sharedStyleConstants";

import { ROW_HEIGHT } from "./constants";

export const TOPIC_ROW_PADDING = 3;

export const DISABLED_COLOR = colors.TEXT_MUTED;
export const TOGGLE_WRAPPER_SIZE = 24;

export const TOGGLE_SIZE_CONFIG = {
  NORMAL: { name: "NORMAL", size: 12 },
  SMALL: { name: "SMALL", size: 10 },
};

const SToggle = styled.label`
  width: ${TOGGLE_WRAPPER_SIZE}px;
  height: ${TOGGLE_WRAPPER_SIZE}px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  position: relative;
  cursor: pointer;
  outline: 0;
  span {
    border: 1px solid ${({ theme }) => theme.palette.neutralLight} !important;
  }
  :hover {
    background-color: rgba(255, 255, 255, 0.1);
  }
  :focus {
    span {
      border: 1px solid ${colors.BLUE} !important;
    }
  }
`;

const SSpan = styled.span`
  :hover {
    transform: scale(1.2);
  }
`;

export type Size = keyof typeof TOGGLE_SIZE_CONFIG;
type Props = {
  available: boolean;
  checked: boolean;
  dataTest?: string;
  onAltToggle?: () => void;
  onShiftToggle?: () => void;
  onToggle: () => void;
  onMouseEnter?: (arg0: React.MouseEvent) => void;
  onMouseLeave?: (arg0: React.MouseEvent) => void;
  overrideColor?: Color;
  size?: Size;
  unavailableTooltip?: string;
  visibleInScene: boolean;
  diffModeEnabled: boolean;
  columnIndex: number;
};

// eslint-disable-next-line @foxglove/no-boolean-parameters
function diffModeStyleOverrides(checked: boolean, columnIndex: number) {
  if (!checked) {
    return {
      border: `1px solid ${DISABLED_COLOR}`,
    };
  }

  const firstColor = columnIndex === 0 ? colors.DIFF_MODE_SOURCE_1 : colors.DIFF_MODE_SOURCE_BOTH;
  const secondColor = columnIndex === 0 ? colors.DIFF_MODE_SOURCE_BOTH : colors.DIFF_MODE_SOURCE_2;
  return {
    background: `linear-gradient(90deg, ${firstColor} 0%, ${firstColor} 50%, ${secondColor} 51%, ${secondColor} 100%)`,
  };
}

function getStyles({
  theme,
  checked,
  visibleInScene,
  overrideColor,
  size,
  diffModeEnabled,
  columnIndex,
}: {
  theme: ITheme;
  checked: boolean;
  visibleInScene: boolean;
  overrideColor?: Color;
  size?: Size;
  diffModeEnabled: boolean;
  columnIndex: number;
}): React.CSSProperties {
  const sizeInNumber =
    size === TOGGLE_SIZE_CONFIG.SMALL.name
      ? TOGGLE_SIZE_CONFIG.SMALL.size
      : TOGGLE_SIZE_CONFIG.NORMAL.size;
  let styles: React.CSSProperties = {
    width: sizeInNumber,
    height: sizeInNumber,
    borderRadius: sizeInNumber / 2,
  };

  if (diffModeEnabled) {
    return {
      ...styles,
      ...diffModeStyleOverrides(checked, columnIndex),
    };
  }

  const overrideRGB = defaultedRGBStringFromColorObj(overrideColor);
  const { enabledColor, disabledColor } = overrideColor
    ? {
        enabledColor: overrideRGB,
        disabledColor: tinyColor(overrideRGB).setAlpha(0.5).toRgbString(),
      }
    : { enabledColor: theme.palette.neutralLight, disabledColor: "transparent" };

  const color = visibleInScene ? enabledColor : disabledColor;
  if (checked) {
    styles = { ...styles, background: color };
  } else {
    styles = { ...styles, border: `1px solid ${color}` };
  }

  return styles;
}

// A toggle component that supports using tab key to focus and using space key to check/uncheck.
export default function VisibilityToggle({
  available,
  checked,
  dataTest,
  onAltToggle,
  onShiftToggle,
  onToggle,
  overrideColor,
  size,
  unavailableTooltip,
  visibleInScene,
  onMouseEnter,
  onMouseLeave,
  diffModeEnabled,
  columnIndex,
}: Props): JSX.Element {
  const theme = useTheme();
  // Handle shift + click/enter, option + click/enter, and click/enter.
  const onChange = useCallback(
    (e: React.MouseEvent | React.KeyboardEvent) => {
      if (onShiftToggle && e.shiftKey) {
        onShiftToggle();
      } else if (onAltToggle && e.altKey) {
        onAltToggle();
      } else {
        onToggle();
      }
    },
    [onAltToggle, onShiftToggle, onToggle],
  );

  if (!available) {
    return (
      <Icon
        tooltipProps={{ placement: "top" }}
        tooltip={unavailableTooltip ? unavailableTooltip : "Unavailable"}
        fade
        size="small"
        clickable={false}
        style={{
          fontSize: 10,
          cursor: "not-allowed",
          height: ROW_HEIGHT,
          width: TOGGLE_WRAPPER_SIZE,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "all 80ms ease-in-out",
        }}
      >
        <BlockHelperIcon />
      </Icon>
    );
  }

  return (
    <SToggle
      data-test={dataTest}
      tabIndex={0}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
          onChange(e);
        }
      }}
      onClick={onChange}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <SSpan
        style={getStyles({
          theme,
          checked,
          visibleInScene,
          size,
          overrideColor,
          diffModeEnabled,
          columnIndex,
        })}
      />
    </SToggle>
  );
}
