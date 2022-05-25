// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { TransitionStatus } from "react-transition-group";
import styled, { css } from "styled-components";

import { spacing } from "@foxglove/studio-base/util/sharedStyleConstants";

export const FULLSCREEN_TRANSITION_DURATION_MS = 200;

// This is in a separate file to prevent circular import issues.
export const PanelRoot = styled.div<{
  fullscreenState: TransitionStatus;
  selected: boolean;
  sourceRect: DOMRectReadOnly | undefined;
  hasFullscreenDescendant: boolean;
}>`
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  overflow: hidden;
  background-color: ${({ theme }) => theme.semanticColors.bodyBackground};
  border: 0px solid rgba(110, 81, 238, 0.3);
  transition: border-width ${FULLSCREEN_TRANSITION_DURATION_MS}ms;

  ${({ fullscreenState, sourceRect, hasFullscreenDescendant }) => {
    switch (fullscreenState) {
      case "entering":
        return css`
          position: fixed;
          top: ${sourceRect?.top ?? 0}px;
          left: ${sourceRect?.left ?? 0}px;
          right: ${sourceRect ? window.innerWidth - sourceRect.right : 0}px;
          bottom: ${sourceRect ? window.innerHeight - sourceRect.bottom : 0}px;
          z-index: 10000;
        `;
      case "entered":
        return css`
          transition: border-width ${FULLSCREEN_TRANSITION_DURATION_MS}ms,
            top ${FULLSCREEN_TRANSITION_DURATION_MS}ms, left ${FULLSCREEN_TRANSITION_DURATION_MS}ms,
            right ${FULLSCREEN_TRANSITION_DURATION_MS}ms,
            bottom ${FULLSCREEN_TRANSITION_DURATION_MS}ms;
          border-width: 4px;
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: ${spacing.PLAYBACK_CONTROL_HEIGHT};
          z-index: 10000;
        `;
      case "exiting":
        return css`
          transition: border-width ${FULLSCREEN_TRANSITION_DURATION_MS}ms,
            top ${FULLSCREEN_TRANSITION_DURATION_MS}ms, left ${FULLSCREEN_TRANSITION_DURATION_MS}ms,
            right ${FULLSCREEN_TRANSITION_DURATION_MS}ms,
            bottom ${FULLSCREEN_TRANSITION_DURATION_MS}ms;
          position: fixed;
          top: ${sourceRect?.top ?? 0}px;
          left: ${sourceRect?.left ?? 0}px;
          right: ${sourceRect ? window.innerWidth - sourceRect.right : 0}px;
          bottom: ${sourceRect ? window.innerHeight - sourceRect.bottom : 0}px;
          z-index: 10000;
        `;
      case "exited":
        return css`
          position: relative;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          // "z-index: 1" makes panel drag & drop work more reliably (see
          // https://github.com/foxglove/studio/pull/3355), but it also makes fullscreen panels get
          // overlapped by other parts of the panel layout. So we turn it back to auto when a
          // descendant is fullscreen.
          z-index: ${hasFullscreenDescendant ? "auto" : 1};
        `;
      case "unmounted":
        return css``;
    }
  }}

  :after {
    content: "";
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    inset: 1px;
    opacity: ${({ selected }) => (selected ? 1 : 0)};
    border: 1px solid ${({ theme }) => theme.palette.themePrimary};
    position: absolute;
    pointer-events: none;
    transition: ${({ selected }) =>
      selected ? "opacity 0.125s ease-out" : "opacity 0.05s ease-out"};
    z-index: 100000;
  }
`;
