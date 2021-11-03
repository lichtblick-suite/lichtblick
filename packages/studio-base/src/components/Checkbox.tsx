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

import CheckboxBlankOutlineIcon from "@mdi/svg/svg/checkbox-blank-outline.svg";
import CheckboxMarkedIcon from "@mdi/svg/svg/checkbox-marked.svg";
import styled from "styled-components";

import Icon from "@foxglove/studio-base/components/Icon";

export const SCheckbox = styled.div<{
  labelDirection: "top" | "left" | "right";
  disabled: boolean;
}>`
  display: flex;
  align-items: center;
  flex-direction: ${(props) => (props.labelDirection === "top" ? "column" : "row")};
  align-items: ${(props) => (props.labelDirection === "top" ? "flex-start" : "center")};
  color: ${({ disabled, theme }) =>
    disabled ? theme.semanticColors.disabledText : theme.semanticColors.bodyText};
  cursor: ${(props) => (props.disabled ? "not-allowed" : "pointer")};
`;

export const SLabel = styled.label<{ labelDirection: "top" | "left" | "right"; disabled: boolean }>`
  margin: ${(props) => (props.labelDirection === "top" ? "6px 6px 6px 0" : "6px")};
  color: ${({ disabled, labelDirection, theme }) =>
    disabled || labelDirection === "top"
      ? theme.semanticColors.disabledText
      : theme.semanticColors.bodyText};
`;

export type Props = {
  checked: boolean;
  disabled?: boolean;
  label: string;
  labelStyle?: {
    [key: string]: string | number;
  };
  labelDirection?: "top" | "left" | "right";
  tooltip?: string;
  onChange: (newChecked: boolean) => void; // eslint-disable-line @foxglove/no-boolean-parameters
  style?: {
    [key: string]: string | number;
  };
  dataTest?: string;
};

export default function Checkbox({
  label,
  labelStyle,
  labelDirection = "right",
  checked,
  tooltip,
  onChange,
  disabled = false,
  style = {},
  dataTest,
}: Props): JSX.Element {
  const Component = checked ? CheckboxMarkedIcon : CheckboxBlankOutlineIcon;
  const onClick = React.useCallback(() => {
    if (!disabled) {
      onChange(!checked);
    }
  }, [checked, disabled, onChange]);

  const styledLabel = (
    <SLabel labelDirection={labelDirection} disabled={disabled} style={labelStyle}>
      {label}
    </SLabel>
  );

  if (labelDirection === "top") {
    return (
      <SCheckbox disabled={disabled} labelDirection={labelDirection} style={style}>
        {styledLabel}
      </SCheckbox>
    );
  }

  return (
    <SCheckbox disabled={disabled} labelDirection={labelDirection} style={style}>
      {labelDirection === "left" && styledLabel}
      <Icon size="small" tooltip={tooltip} onClick={onClick} dataTest={dataTest}>
        <Component />
      </Icon>
      {labelDirection === "right" && styledLabel}
    </SCheckbox>
  );
}
