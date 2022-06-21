// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import styled from "styled-components";

import { colors } from "@foxglove/studio-base/util/sharedStyleConstants";

export const SRow = styled.div`
  display: flex;
  align-items: center;
  padding: 0;
  margin: 4px 0;
`;
export const SLabel = styled.label<{ width?: number }>`
  width: ${(props) => `${props.width ?? 80}px`};
  margin: 4px 0;
  font-size: 10px;
`;
export const SValue = styled.div`
  color: ${colors.HIGHLIGHT};
  word-break: break-word;
`;
export const SEmptyState = styled.div`
  color: ${({ theme }) => theme.semanticColors.disabledText};
  line-height: 1.4;
  margin-bottom: 8px;
`;
