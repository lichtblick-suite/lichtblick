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

import { ReactElement } from "react";
import styled from "styled-components";
import tinyColor from "tinycolor2";

import { colors } from "@foxglove/studio-base/util/sharedStyleConstants";

export const colorToAlpha = (hex: string, alpha: number): string => {
  const color = tinyColor(hex);
  color.setAlpha(alpha);
  return color.toRgbString();
};

const SSegmentedControl = styled.div`
  white-space: nowrap;
  display: inline-flex;
  padding: 4px;
  border-radius: 6px;
  background-color: ${({ theme }) => colorToAlpha(theme.palette.neutralPrimary, 0.15)};
  outline: 0;
  &:focus-within,
  &:focus,
  &:active {
    box-shadow: inset 0 0 0 2px ${({ theme }) => colorToAlpha(theme.palette.neutralPrimary, 0.1)};
  }
`;

const SOption = styled.div<{ isSelected: boolean }>`
  flex: none;
  cursor: pointer;
  transition: all 80ms ease-in-out;
  border-radius: 4px;
  background-color: ${(props) => (props.isSelected ? colors.PRIMARY : "transparent")};
  color: ${({ isSelected, theme }) =>
    isSelected ? theme.palette.white : theme.palette.neutralDark};
  padding: 8px 16px;
  &:hover {
    opacity: 0.8;
  }
`;

export type Option = {
  id: string;
  label: string;
};

type Props = {
  options: Option[];
  selectedId: string;
  onChange: (id: string) => void;
};

export default function SegmentedControl({ options, selectedId, onChange }: Props): ReactElement {
  if (options.length === 0) {
    throw new Error("<SegmentedControl> requires at least one option");
  }

  return (
    <SSegmentedControl tabIndex={0}>
      {options.map(({ id, label }) => (
        <SOption
          key={id}
          data-test={id}
          onClick={() => onChange(id)}
          isSelected={selectedId === id}
        >
          {label}
        </SOption>
      ))}
    </SSegmentedControl>
  );
}
