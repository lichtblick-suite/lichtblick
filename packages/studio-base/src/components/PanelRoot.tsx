// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import styled from "styled-components";

import { colors, spacing } from "@foxglove/studio-base/util/sharedStyleConstants";

// This is in a separate file to prevent circular import issues.
export const PanelRoot = styled.div<{ fullscreen: boolean; selected: boolean }>`
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  overflow: hidden;
  z-index: ${({ fullscreen }) => (fullscreen ? 10000 : 1)};
  background-color: ${({ theme }) => theme.semanticColors.bodyBackground};
  position: ${({ fullscreen }) => (fullscreen ? "fixed" : "relative")};
  border: ${({ fullscreen }) => (fullscreen ? "4px solid rgba(110, 81, 238, 0.3)" : "none")};
  top: 0;
  left: 0;
  right: 0;
  bottom: ${({ fullscreen }) => (fullscreen ? spacing.PLAYBACK_CONTROL_HEIGHT : 0)};

  :after {
    content: "";
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    opacity: ${({ selected }) => (selected ? 1 : 0)};
    border: 1px solid ${colors.ACCENT};
    position: absolute;
    pointer-events: none;
    transition: ${({ selected }) =>
      selected ? "opacity 0.125s ease-out" : "opacity 0.05s ease-out"};
    z-index: 100000;
  }
`;
