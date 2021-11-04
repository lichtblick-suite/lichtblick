// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import styled from "styled-components";

import { fonts, spacing } from "@foxglove/studio-base/util/sharedStyleConstants";

/**
 * @deprecated The LegacyButton should not be used for new features. use fluentui/react instead
 */
export const LegacyButton = styled.button`
  background-color: ${({ theme }) => theme.palette.neutralLighter};
  border-radius: 4px;
  border: none;
  color: ${({ theme }) => theme.semanticColors.buttonText};
  font: inherit;
  line-height: 100%;
  font-family: ${fonts.SANS_SERIF};
  font-feature-settings: ${fonts.SANS_SERIF_FEATURE_SETTINGS};
  font-size: 100%;
  margin: ${spacing.CONTROL_MARGIN};
  padding: 8px 12px;
  position: relative;
  text-align: center;

  &:not(.disabled):not(:disabled):hover {
    background-color: ${({ theme }) => theme.semanticColors.buttonBackgroundHovered};
  }
  &:focus {
    outline: none;
  }
  &.is-danger {
    background-color: ${({ theme }) => theme.semanticColors.errorBackground};
  }
  &.is-warning {
    background-color: ${({ theme }) => theme.semanticColors.warningBackground};
  }
  &:not(.disabled):not(:disabled):not(.ms-Button):hover {
    cursor: pointer;
    color: ${({ theme }) => theme.semanticColors.buttonTextHovered};
  }
  &.is-primary {
    background-color: ${({ theme }) => theme.semanticColors.primaryButtonBackground};
    color: ${({ theme }) => theme.semanticColors.primaryButtonText};
  }
  &.selected {
    background-color: ${({ theme }) => theme.semanticColors.buttonBackgroundChecked};
    color: ${({ theme }) => theme.semanticColors.primaryButtonText};
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
  background-color: ${({ theme }) => theme.palette.neutralLighter};
  border-radius: 4px;
  border: none;
  color: ${({ theme }) => theme.semanticColors.inputText};
  font: inherit;
  font-family: ${fonts.SANS_SERIF};
  font-feature-settings: ${fonts.SANS_SERIF_FEATURE_SETTINGS};
  font-size: 100%;
  margin: ${spacing.CONTROL_MARGIN};
  padding: 8px 12px;
  text-align: left;

  &.disabled {
    color: ${({ theme }) => theme.semanticColors.disabledText};
    background-color: ${({ theme }) => theme.semanticColors.buttonBackgroundDisabled};
  }
  &:focus {
    background-color: ${({ theme }) => theme.palette.neutralLighterAlt};
    outline: none;
  }
`;

/**
 * @deprecated The LegacyTextarea should not be used for new features. use fluentui/react instead
 */
export const LegacyTextarea = styled.textarea`
  background-color: ${({ theme }) => theme.semanticColors.inputBackground};
  border-radius: 4px;
  border: 2px solid ${({ theme }) => theme.semanticColors.inputBorder};
  color: ${({ theme }) => theme.semanticColors.inputText};
  font: inherit;
  line-height: 1.4;
  font-family: ${fonts.MONOSPACE};
  font-size: 100%;
  margin: ${spacing.CONTROL_MARGIN};
  padding: 8px 12px;
  text-align: left;

  &:focus {
    border-color: ${({ theme }) => theme.semanticColors.inputFocusBorderAlt};
    outline: none;
  }
  &.disabled {
    color: ${({ theme }) => theme.semanticColors.disabledText};
  }
`;

/**
 * @deprecated The LegacySelect should not be used for new features. use fluentui/react instead
 */
export const LegacySelect = styled.select`
  background-color: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
  border: none;
  color: ${({ theme }) => theme.semanticColors.inputText};
  font: inherit;
  font-family: ${fonts.SANS_SERIF};
  font-feature-settings: ${fonts.SANS_SERIF_FEATURE_SETTINGS};
  font-size: 100%;
  margin: ${spacing.CONTROL_MARGIN};
  padding: 8px 12px;
  text-align: left;

  &:focus {
    outline: none;
    background-color: rgba(255, 255, 255, 0.075);
  }
  &.disabled {
    color: ${({ theme }) => theme.semanticColors.disabledText};
    background-color: ${({ theme }) => theme.semanticColors.buttonBackgroundDisabled};
  }
`;

/**
 * @deprecated The LegacyTable should not be used for new features. use fluentui/react instead
 */
export const LegacyTable = styled.table`
  border: none;
  width: 100%;

  th {
    color: ${({ theme }) => theme.semanticColors.bodyText};

    tr:first-child & {
      padding-top: 4px;
      padding-bottom: 4px;
    }
  }
  th,
  td {
    border: 1px solid ${({ theme }) => theme.semanticColors.bodyDivider};
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
      background-color: ${({ theme }) => theme.semanticColors.menuItemBackgroundHovered};
      cursor: pointer;
    }

    svg {
      opacity: 0.8;
    }
  }
`;
