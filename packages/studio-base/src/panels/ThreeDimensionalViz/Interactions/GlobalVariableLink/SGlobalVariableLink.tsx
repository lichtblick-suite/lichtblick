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

import styled from "styled-components";

import { colors } from "@foxglove/studio-base/util/sharedStyleConstants";

export default styled.span`
  height: 15px;
  flex-direction: row;
  display: inline-flex;
  align-items: center;
  word-break: normal;

  span.icon {
    color: ${colors.BLUE};
    width: 18px;
    height: 18px;
    font-size: 18px;
    display: inline-block;
  }
  .link-icon {
    opacity: 0.2;
    display: none;
  }
  .highlight {
    opacity: 1;
    display: inline;
  }
  &:hover {
    .link-icon {
      opacity: 1;
    }
  }
`;
