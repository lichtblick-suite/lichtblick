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

import ClipboardOutlineIcon from "@mdi/svg/svg/clipboard-outline.svg";
import * as React from "react";
import styled from "styled-components";

import Icon from "@foxglove-studio/app/components/Icon";
import clipboard from "@foxglove-studio/app/util/clipboard";

const IconWrapper = styled.div`
  vertical-align: middle;
  position: absolute;
  top: 0;
  right: 0;
  opacity: 0;
`;

const Wrapper = styled.div`
  position: relative;
  cursor: pointer;
  &:hover {
    ${IconWrapper} {
      opacity: 1;
    }
  }
`;

type Props = {
  children: React.ReactNode;
  styles: any;
  copyValue?: any;
};

class CopyToClipboardComponent extends React.Component<Props> {
  wrapper?: HTMLDivElement;
  copy = () => {
    if (this.wrapper) {
      const copyValue =
        typeof this.props.copyValue === "string"
          ? this.props.copyValue
          : JSON.stringify(this.props.copyValue);

      const value = copyValue || this.wrapper.innerText || "";
      clipboard.copy(value);
    }
  };
  render() {
    return (
      <Wrapper
        style={this.props.styles}
        onClick={this.copy}
        ref={(wrapper) => {
          this.wrapper = wrapper ?? undefined;
        }}
      >
        {this.props.children}
        <IconWrapper>
          <Icon>
            <ClipboardOutlineIcon />
          </Icon>
        </IconWrapper>
      </Wrapper>
    );
  }
}

export default CopyToClipboardComponent;
