// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import styled from "styled-components";

import { LegacyTable } from "@foxglove/studio-base/components/LegacyStyledComponents";
import { colors } from "@foxglove/studio-base/util/sharedStyleConstants";

export default styled(LegacyTable)`
  th,
  td {
    border: none;
    padding: 0;
  }
  td {
    word-break: break-word;
  }
  max-width: 100%;
  th {
    color: ${colors.TEXT_MUTED};
    padding-right: 4px;
  }
`;
