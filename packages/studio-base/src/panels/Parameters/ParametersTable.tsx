// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import styled from "styled-components";

import { colors as sharedColors } from "@foxglove/studio-base/util/sharedStyleConstants";

const ParametersTable = styled.div`
  display: flex;
  flex-direction: column;
  white-space: nowrap;
  color: ${sharedColors.LIGHT};

  table {
    width: calc(100% + 1px);
  }

  thead {
    user-select: none;
    border-bottom: 1px solid ${sharedColors.BORDER_LIGHT};
  }

  th,
  td {
    padding: 3px 16px;
    line-height: 100%;
    border: none;
  }

  tr:first-child th {
    padding: 8px 16px;
    border: none;
    text-align: left;
    color: rgba(255, 255, 255, 0.6);
    min-width: 120px;
  }

  td {
    input {
      background: none !important;
      color: inherit;
      width: 100%;
      padding-left: 0;
      padding-right: 0;
      min-width: 40px;
    }
    &:last-child {
      color: rgba(255, 255, 255, 0.6);
    }
  }
`;

export default ParametersTable;
