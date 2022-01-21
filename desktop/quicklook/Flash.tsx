// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import styled from "styled-components";

const colors = {
  error: {
    color: undefined,
    background: "#ffeaea",
    border: "#cc5f5f",

    darkColor: undefined,
    darkBackground: "#673636",
    darkBorder: "#bb5959",
  },
  info: {
    color: "#8a8a8a",
    background: "#f5f5f5",
    border: "#dfdfdf",

    darkColor: "#bbbbbb",
    darkBackground: "#4e4e4e",
    darkBorder: "#727272",
  },
};

const Flash = styled.div<{ type: "error" | "info" }>`
  padding: 12px;
  border-radius: 4px;

  color: ${({ type }) => colors[type].color};
  background: ${({ type }) => colors[type].background};
  border: 1px dashed ${({ type }) => colors[type].border};

  @media (prefers-color-scheme: dark) {
    color: ${({ type }) => colors[type].darkColor};
    background: ${({ type }) => colors[type].darkBackground};
    border: 1px dashed ${({ type }) => colors[type].darkBorder};
  }
`;

export default Flash;
