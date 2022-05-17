// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import styled, { css } from "styled-components";

import { makeFlashAnimation } from "@foxglove/studio-base/components/GlobalVariablesTable";
import { colors as sharedColors } from "@foxglove/studio-base/util/sharedStyleConstants";

const FlashRowAnimation = makeFlashAnimation(
  css`
    background: transparent;
  `,
  css`
    background: ${sharedColors.HIGHLIGHT_MUTED};
  `,
);

const AnimationDuration = 3;
const AnimatedRow = styled.tr<{ animate: boolean; skipAnimation: boolean }>`
  background: transparent;
  animation: ${({ animate, skipAnimation }) =>
      animate && !skipAnimation ? FlashRowAnimation : "none"}
    ${AnimationDuration}s ease-in-out;
  animation-iteration-count: 1;
  animation-fill-mode: forwards;
  border-bottom: 1px solid ${({ theme }) => theme.semanticColors.bodyDivider};
`;

export default AnimatedRow;
