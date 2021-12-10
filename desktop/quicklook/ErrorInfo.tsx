// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import styled from "styled-components";

const ErrorInfo = styled.div`
  padding: 12px;
  border-radius: 4px;

  background: #ffeaea;
  border: 1px dashed #cc5f5f;

  @media (prefers-color-scheme: dark) {
    background: #673636;
    border: 1px dashed #bb5959;
  }
`;

export default ErrorInfo;
