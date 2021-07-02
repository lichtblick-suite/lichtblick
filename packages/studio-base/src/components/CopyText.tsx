// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2019-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.
import ClipboardOutlineIcon from "@mdi/svg/svg/clipboard-outline.svg";
import styled from "styled-components";

import Icon from "@foxglove/studio-base/components/Icon";
import clipboard from "@foxglove/studio-base/util/clipboard";

const SCopyTextWrapper = styled.div`
  display: flex;
  align-items: center;
  cursor: pointer;
  .icon {
    visibility: hidden;
  }
  :hover {
    .icon {
      visibility: visible;
    }
  }
`;

type Props = {
  copyText: string;
  tooltip: string;
  children: React.ReactNode;
};

function CopyText({ copyText, tooltip, children }: Props): JSX.Element | ReactNull {
  if (copyText.length === 0 || children == undefined) {
    return ReactNull;
  }
  return (
    <SCopyTextWrapper onClick={() => void clipboard.copy(copyText)}>
      {children != undefined ? children : copyText}
      <Icon fade style={{ margin: "0 8px", verticalAlign: "middle" }} tooltip={tooltip}>
        <ClipboardOutlineIcon />
      </Icon>
    </SCopyTextWrapper>
  );
}

export default CopyText;
