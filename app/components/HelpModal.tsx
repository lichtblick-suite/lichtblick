// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { PropsWithChildren, ReactElement } from "react";
import styled, { CSSProperties } from "styled-components";

import Modal from "@foxglove-studio/app/components/Modal";
import TextContent from "@foxglove-studio/app/components/TextContent";

const SRoot = styled.div`
  max-width: 700px; // Px value because beyond a certain absolute width the lines become harder to read.
  width: calc(100vw - 30px);
  max-height: calc(100vh - 30px);
  overflow-y: auto;
  padding: 2.5em;
`;

type Props = {
  onRequestClose: () => void;
  rootStyle?: CSSProperties;
};

export default function HelpModal({
  onRequestClose,
  children,
  rootStyle,
}: PropsWithChildren<Props>): ReactElement {
  return (
    <Modal onRequestClose={onRequestClose}>
      <SRoot {...(rootStyle ? { style: rootStyle } : undefined)}>
        <TextContent allowMarkdownHtml={true}>{children}</TextContent>
      </SRoot>
    </Modal>
  );
}
