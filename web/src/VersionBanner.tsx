// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import { DefaultButton, Stack, Text } from "@fluentui/react";
import CloseIcon from "@mdi/svg/svg/close.svg";
import { useState, ReactElement } from "react";
import styled from "styled-components";

const MINIMUM_CHROME_VERSION = 76;

const StyledBanner = styled.div<{
  isDismissable: boolean;
}>`
  height: ${(props) => (props.isDismissable ? "auto" : "100vh")};
  ${(props) =>
    !props.isDismissable &&
    `position: fixed;
  top: 0;
  left:0;
  right:0;
  bottom:0;`};
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  width: 100vw;
  padding: 10px;
  color: white;
  background-color: rgba(99, 102, 241, 0.9);
  z-index: 100;
`;
const StyledIconWrapper = styled.div`
  fill: white;
  position: absolute;
  top: 10px;
  right: 10px;
`;

const VersionBanner = function ({
  isChrome,
  currentVersion,
  isDismissable,
}: {
  isChrome: boolean;
  currentVersion: number;
  isDismissable: boolean;
}): ReactElement | ReactNull {
  const [showBanner, setShowBanner] = useState(true);

  if (!showBanner || currentVersion >= MINIMUM_CHROME_VERSION) {
    return ReactNull;
  }

  const prompt = isChrome
    ? "You're using an outdated version of Chrome."
    : "You're using an unsupported browser.";
  const fixText = isChrome ? "Update Chrome" : "Download Chrome";

  return (
    <StyledBanner isDismissable={isDismissable}>
      <Stack tokens={{ childrenGap: 8 }} horizontalAlign="center">
        {isDismissable ? (
          <StyledIconWrapper onClick={() => setShowBanner(false)}>
            <CloseIcon />
          </StyledIconWrapper>
        ) : (
          ReactNull
        )}

        <Text styles={{ root: { color: "white" } }}>
          {prompt} Foxglove Studio currently requires Chrome v{MINIMUM_CHROME_VERSION}+.
        </Text>

        {isChrome ? undefined : (
          <Text styles={{ root: { color: "white" } }}>
            Check out our cross-browser support progress in GitHub issue{" "}
            <a href="https://github.com/foxglove/studio/issues/1511">#1511</a>.
          </Text>
        )}

        <DefaultButton
          href="https://www.google.com/chrome/"
          target="_blank"
          rel="noreferrer"
          styles={{
            root: {
              color: "rgba(255,255, 255, 0.7)",
              backgroundColor: "rgba(255,255, 255, 0.1)",
              borderRadius: "4px",
              border: "none",
            },
            rootHovered: {
              color: "white",
              backgroundColor: "rgba(255,255, 255, 0.4)",
            },
          }}
        >
          {fixText}
        </DefaultButton>
      </Stack>
    </StyledBanner>
  );
};

export default VersionBanner;
