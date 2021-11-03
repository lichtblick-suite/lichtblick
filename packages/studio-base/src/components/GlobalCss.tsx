// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { createGlobalStyle } from "styled-components";

/** GlobalCss component configures html, body, and #root with theme elements */
const GlobalCss = createGlobalStyle`
html, body {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  height: 100%;
  width: 100%;

  // https://github.com/necolas/normalize.css/blob/master/normalize.css#L12
  line-height: 1.15;
}
*, *:before, *:after {
  box-sizing: inherit;
}
body {
  background: ${({ theme }) => theme.semanticColors.bodyBackground};
  color: ${({ theme }) => theme.semanticColors.bodyText};
  font: inherit;
  font-family: ${({ theme }) => theme.fonts.small.fontFamily};
  font-feature-settings: ${({ theme }) => theme.fonts.small.fontFeatureSettings};
  font-size: ${({ theme }) => theme.fonts.small.fontSize};
  font-weight: ${({ theme }) => theme.fonts.small.fontWeight};
}
#root {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
  flex: 1 1 100%;
  outline: none;
  overflow: hidden;
  z-index: 0;
}
`;

export default GlobalCss;
