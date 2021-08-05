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

import { Layer } from "@fluentui/react";
import CloseIcon from "@mdi/svg/svg/close.svg";
import { CSSProperties, PropsWithChildren } from "react";
import styled from "styled-components";

import Icon from "@foxglove/studio-base/components/Icon";
import KeyListener from "@foxglove/studio-base/components/KeyListener";
import { colors as sharedColors } from "@foxglove/studio-base/util/sharedStyleConstants";

const Container = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  right: 0;
  z-index: 0;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const Backdrop = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  right: 0;
  background-color: ${({ theme }) => theme.palette.blackTranslucent40};
  width: 100%;
  height: 100%;
`;

const StyledContent = styled.div`
  position: absolute;
  flex: 1 1 auto;
`;

type Props = {
  onRequestClose: () => void;
  contentStyle?: CSSProperties;
};

// Generic modal that renders a semi-transparent backdrop and close icon.
export default function Modal(props: PropsWithChildren<Props>): React.ReactElement {
  return (
    <Layer>
      <Container>
        <Backdrop onClick={props.onRequestClose} />
        <StyledContent
          style={{
            borderRadius: 6,
            backgroundColor: sharedColors.DARK2,
            ...props.contentStyle,
          }}
        >
          <KeyListener global keyDownHandlers={{ Escape: props.onRequestClose }} />
          <Icon
            fade
            dataTest="modal-close-icon"
            xsmall
            style={{
              position: "absolute",
              right: 25,
              top: 25,
              cursor: "pointer",
            }}
            onClick={props.onRequestClose}
          >
            <CloseIcon />
          </Icon>
          {props.children}
        </StyledContent>
      </Container>
    </Layer>
  );
}
