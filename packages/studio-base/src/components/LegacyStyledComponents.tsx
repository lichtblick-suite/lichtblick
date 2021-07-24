// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import styled from "styled-components";

import { MONOSPACE, SANS_SERIF } from "@foxglove/studio-base/styles/fonts";
import { colors as sharedColors, spacing } from "@foxglove/studio-base/util/sharedStyleConstants";

/**
 * @deprecated The LegacyButton should not be used for new features. use fluentui/react instead
 */
export const LegacyButton = styled.button`
  background-color: ${sharedColors.BACKGROUND_CONTROL};
  border-radius: 4px;
  border: none;
  color: ${sharedColors.TEXT_CONTROL};
  font: inherit;
  line-height: 100%;
  font-family: ${SANS_SERIF};
  font-size: 100%;
  margin: ${spacing.CONTROL_MARGIN};
  padding: 8px 12px;
  position: relative;
  text-align: center;

  &:focus {
    outline: none;
  }
  &.is-danger {
    background-color: ${sharedColors.RED};
  }
  &.is-warning {
    background-color: ${sharedColors.BACKGROUND_CONTROL};
  }
  &:not(.disabled):not(:disabled):not(.ms-Button):hover {
    cursor: pointer;
    color: ${sharedColors.TEXT_CONTROL_HOVER};
  }
  &.is-primary {
    background-color: ${sharedColors.GREEN};
    color: ${sharedColors.BACKGROUND};
  }
  &.selected {
    background-color: ${sharedColors.DARK5};
    color: ${sharedColors.TEXT_NORMAL};
  }
  &.disabled,
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  &.is-small {
    padding: 4px 8px;
  }
`;

/**
 * @deprecated The LegacyInput should not be used for new features. use fluentui/react instead
 */
export const LegacyInput = styled.input`
  background-color: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
  border: none;
  color: ${sharedColors.TEXT_CONTROL};
  font: inherit;
  font-family: ${SANS_SERIF};
  font-size: 100%;
  margin: ${spacing.CONTROL_MARGIN};
  padding: 8px 12px;
  text-align: left;

  &.disabled {
    color: ${sharedColors.TEXT_INPUT_DISABLED};
    background-color: rgba(255, 255, 255, 0.3);
  }
  &:focus {
    background-color: rgba(255, 255, 255, 0.075);
    outline: none;
  }
`;

/**
 * @deprecated The LegacyTextarea should not be used for new features. use fluentui/react instead
 */
export const LegacyTextarea = styled.textarea`
  background-color: ${sharedColors.DARK};
  border-radius: 4px;
  border: 2px solid ${sharedColors.TEXT_NORMAL};
  color: ${sharedColors.TEXT_NORMAL};
  font: inherit;
  line-height: 1.4;
  font-family: ${MONOSPACE};
  font-size: 100%;
  margin: ${spacing.CONTROL_MARGIN};
  padding: 8px 12px;
  text-align: left;

  &:focus {
    background-color: black;
    outline: none;
  }
  &.disabled {
    background-color: rgba(255, 255, 255, 0.3);
    color: ${sharedColors.TEXT_INPUT_DISABLED};
  }
`;

/**
 * @deprecated The LegacySelect should not be used for new features. use fluentui/react instead
 */
export const LegacySelect = styled.select`
  background-color: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
  border: none;
  color: ${sharedColors.TEXT_CONTROL};
  font: inherit;
  font-family: ${SANS_SERIF};
  font-size: 100%;
  margin: ${spacing.CONTROL_MARGIN};
  padding: 8px 12px;
  text-align: left;

  &:focus {
    outline: none;
    background-color: rgba(255, 255, 255, 0.075);
  }
  &.disabled {
    color: ${sharedColors.TEXT_INPUT_DISABLED};
    background-color: rgba(255, 255, 255, 0.3);
  }
`;

/**
 * @deprecated The LegacyTable should not be used for new features. use fluentui/react instead
 */
export const LegacyTable = styled.table`
  border: "none";
  width: 100%;

  th {
    color: ${sharedColors.TEXT_NORMAL};

    tr:first-child & {
      padding-top: 4px;
      padding-bottom: 4px;
    }
  }
  th,
  td {
    border: 1px solid ${sharedColors.DIVIDER};
    padding: 0 0.3em;
    line-height: 1.3em;
  }
  tr {
    svg {
      opacity: 0.6;
    }
  }

  tr:hover {
    td {
      background-color: ${sharedColors.DARK4};
      cursor: pointer;
    }

    svg {
      opacity: 0.8;
    }
  }
`;
