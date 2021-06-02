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
import styled from "styled-components";

export const SLabel = styled.label<{ strikethrough?: boolean }>`
  display: block;
  font-size: 14px;
  margin: 6px 2px;
  text-decoration: ${(props) => (props.strikethrough === true ? "line-through" : "none")};
`;
export const SDescription = styled.label`
  display: block;
  margin: 6px 2px;
  opacity: 0.8;
  line-height: 1.2;
`;

export const SInput = styled.input`
  flex: 1 1 auto;
  margin-bottom: 8px;
`;
