// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2020-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import styled from "styled-components";

import { LegacyInput } from "@foxglove/studio-base/components/LegacyStyledComponents";

const SSwitch = styled.label`
  position: relative;
  vertical-align: top;
  display: inline-flex;
  width: 28px;
  height: 16px;
  outline: 0;

  input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .circle {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(255, 255, 255, 0.15);
    transition: all 80ms ease-in-out;
    border-radius: 18px;
  }

  .circle:before {
    position: absolute;
    content: "";
    height: 12px;
    width: 12px;
    left: 2px;
    bottom: 2px;
    background-color: white;
    transition: all 80ms ease-in-out;
    border-radius: 50%;
  }

  input:checked + .circle {
    background-color: #2196f3;
  }

  input:checked + .circle:before {
    transform: translateX(12px);
  }
`;

type Props = {
  isChecked: boolean;
  onChange: () => void;
};

export default function Switch({ isChecked, onChange }: Props): JSX.Element {
  return (
    <SSwitch className="switch">
      <LegacyInput type="checkbox" checked={isChecked} onChange={onChange} />
      <span className="circle" />
    </SSwitch>
  );
}
