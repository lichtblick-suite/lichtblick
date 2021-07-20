// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import { useState, ReactElement } from "react";
import styled from "styled-components";

import "@foxglove/studio-base/styles/global.scss";

const MINIMUM_CHROME_VERSION = 76;
const StyledBanner = styled.div`
  text-align: center;
  position: absolute;
  top: 0px;
  left: 0px;
  width: 100vw;
  padding: 10px;
  background-color: rgba(99, 102, 241, 0.9);
  z-index: 100;
`;

const VersionBanner = function ({
  isChrome,
  currentVersion,
}: {
  isChrome: boolean;
  currentVersion: number;
}): ReactElement | ReactNull {
  const [showBanner, setShowBanner] = useState(true);

  if (!showBanner || currentVersion >= MINIMUM_CHROME_VERSION) {
    return ReactNull;
  }

  const prompt = isChrome
    ? `Update Chrome to version ${MINIMUM_CHROME_VERSION}+ to continue.`
    : `You're using an unsupported browser. Use Chrome ${MINIMUM_CHROME_VERSION}+ to continue.`;
  const fixText = isChrome ? "Update Chrome" : "Download Chrome";
  const continueText = isChrome
    ? "Continue with unsupported version"
    : "Continue with unsupported browser";

  return (
    <StyledBanner>
      <div>
        <p>{prompt} </p>
        {isChrome ? undefined : (
          <p>
            Check out our browser support progress in{" "}
            <a href="https://github.com/foxglove/studio/issues/1422">this GitHub issue</a>.
          </p>
        )}
      </div>

      <div style={{ paddingTop: "20px" }}>
        <a href="https://www.google.com/chrome/" target="_blank" rel="noreferrer">
          <button>{fixText}</button>
        </a>
        <button onClick={() => setShowBanner(false)}>{continueText}</button>
      </div>
    </StyledBanner>
  );
};

export default VersionBanner;
