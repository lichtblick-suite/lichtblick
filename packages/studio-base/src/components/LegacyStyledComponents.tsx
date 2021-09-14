// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import styled from "styled-components";

import { fonts, colors, spacing } from "@foxglove/studio-base/util/sharedStyleConstants";

/**
 * @deprecated The LegacyButton should not be used for new features. use fluentui/react instead
 */
export const LegacyButton = styled.button`
  background-color: ${colors.BACKGROUND_CONTROL};
  border-radius: 4px;
  border: none;
  color: ${colors.TEXT_CONTROL};
  font: inherit;
  line-height: 100%;
  font-family: ${fonts.SANS_SERIF};
  font-feature-settings: "tnum";
  font-size: 100%;
  margin: ${spacing.CONTROL_MARGIN};
  padding: 8px 12px;
  position: relative;
  text-align: center;

  &:focus {
    outline: none;
  }
  &.is-danger {
    background-color: ${colors.RED};
  }
  &.is-warning {
    background-color: ${colors.BACKGROUND_CONTROL};
  }
  &:not(.disabled):not(:disabled):not(.ms-Button):hover {
    cursor: pointer;
    color: ${colors.TEXT_CONTROL_HOVER};
  }
  &.is-primary {
    background-color: ${colors.GREEN};
    color: ${colors.BACKGROUND};
  }
  &.selected {
    background-color: ${colors.DARK5};
    color: ${colors.TEXT_NORMAL};
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
  color: ${colors.TEXT_CONTROL};
  font: inherit;
  font-family: ${fonts.SANS_SERIF};
  font-feature-settings: "tnum";
  font-size: 100%;
  margin: ${spacing.CONTROL_MARGIN};
  padding: 8px 12px;
  text-align: left;

  &.disabled {
    color: ${colors.TEXT_INPUT_DISABLED};
    background-color: ${colors.BACKGROUND_DISABLED};
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
  background-color: ${colors.DARK};
  border-radius: 4px;
  border: 2px solid ${colors.TEXT_NORMAL};
  color: ${colors.TEXT_NORMAL};
  font: inherit;
  line-height: 1.4;
  font-family: ${fonts.MONOSPACE};
  font-size: 100%;
  margin: ${spacing.CONTROL_MARGIN};
  padding: 8px 12px;
  text-align: left;

  &:focus {
    background-color: black;
    outline: none;
  }
  &.disabled {
    background-color: ${colors.BACKGROUND_DISABLED};
    color: ${colors.TEXT_INPUT_DISABLED};
  }
`;

/**
 * @deprecated The LegacySelect should not be used for new features. use fluentui/react instead
 */
export const LegacySelect = styled.select`
  background-color: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
  border: none;
  color: ${colors.TEXT_CONTROL};
  font: inherit;
  font-family: ${fonts.SANS_SERIF};
  font-feature-settings: "tnum";
  font-size: 100%;
  margin: ${spacing.CONTROL_MARGIN};
  padding: 8px 12px;
  text-align: left;

  &:focus {
    outline: none;
    background-color: rgba(255, 255, 255, 0.075);
  }
  &.disabled {
    color: ${colors.TEXT_INPUT_DISABLED};
    background-color: ${colors.BACKGROUND_DISABLED};
  }
`;

/**
 * @deprecated The LegacyTable should not be used for new features. use fluentui/react instead
 */
export const LegacyTable = styled.table`
  border: "none";
  width: 100%;

  th {
    color: ${colors.TEXT_NORMAL};

    tr:first-child & {
      padding-top: 4px;
      padding-bottom: 4px;
    }
  }
  th,
  td {
    border: 1px solid ${colors.DIVIDER};
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
      background-color: ${colors.DARK4};
      cursor: pointer;
    }

    svg {
      opacity: 0.8;
    }
  }
`;
