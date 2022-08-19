// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import styled from "styled-components";

import { fonts } from "@foxglove/studio-base/util/sharedStyleConstants";

/**
 * @deprecated The LegacyInput should not be used for new features. use fluentui/react instead
 */
export const LegacyInput = styled.input`
  background-color: ${({ theme }) => theme.palette.neutralLighter};
  border-radius: ${({ theme }) => theme.effects.roundedCorner2};
  border: none;
  color: ${({ theme }) => theme.semanticColors.inputText};
  font: inherit;
  font-family: ${fonts.SANS_SERIF};
  font-feature-settings: ${fonts.SANS_SERIF_FEATURE_SETTINGS};
  font-size: 100%;
  margin: 0 0.2em;
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
 * @deprecated The LegacyTable should not be used for new features. use fluentui/react instead
 */
export const LegacyTable = styled.table`
  border: none;
  width: 100%;
  border-collapse: collapse;
  border-spacing: 0;

  th {
    color: ${({ theme }) => theme.semanticColors.bodyText};

    tr:first-of-type & {
      padding-top: 4px;
      padding-bottom: 4px;
    }
  }
  th,
  td {
    vertical-align: top;
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
