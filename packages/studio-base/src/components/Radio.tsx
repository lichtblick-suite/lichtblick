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
import RadioButtonUncheckedIcon from "@mdi/svg/svg/radiobox-blank.svg";
import RadioButtonCheckedIcon from "@mdi/svg/svg/radiobox-marked.svg";
import { ReactElement } from "react";
import styled from "styled-components";

import { colors } from "@foxglove/studio-base/util/sharedStyleConstants";

import Icon from "./Icon";
import { colorToAlpha } from "./SegmentedControl";

export type RadioOption = {
  id: string;
  label: React.ReactNode;
};

export type RadioProps = {
  options: RadioOption[];
  selectedId?: string;
  onChange: (selectedId: string) => void;
};

const SOption = styled.div`
  display: flex;
  align-items: center;
  cursor: pointer;
  outline: 0;
  &:not(:last-child) {
    margin-bottom: 8px;
  }
  > .icon svg {
    flex: none;
    transition: all 80ms ease-in-out;
    border-radius: 50%;
  }
  &:hover {
    > .icon svg {
      opacity: 0.8;
    }
  }
  &:focus-within,
  &:focus,
  &:active {
    > .icon svg {
      box-shadow: 0 0 0 2px ${colorToAlpha(colors.LIGHT, 0.2)};
    }
  }
`;
const SLabel = styled.div`
  margin-left: 8px;
  overflow: hidden;
`;

export default function Radio(props: RadioProps): ReactElement {
  const { options, selectedId, onChange, ...restProps } = props;
  return (
    <>
      {options.map(({ id, label }: RadioOption) => (
        <SOption tabIndex={0} key={id} data-test={id} onClick={() => onChange(id)} {...restProps}>
          <Icon size="small">
            {id === selectedId ? <RadioButtonCheckedIcon /> : <RadioButtonUncheckedIcon />}
          </Icon>
          <SLabel>{label}</SLabel>
        </SOption>
      ))}
    </>
  );
}
