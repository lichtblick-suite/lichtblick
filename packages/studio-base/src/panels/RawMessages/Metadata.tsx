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
import { cloneDeepWith } from "lodash";
import React, { useCallback } from "react";
import styled from "styled-components";

import Icon from "@foxglove/studio-base/components/Icon";
import { MessageEvent } from "@foxglove/studio-base/players/types";
import clipboard from "@foxglove/studio-base/util/clipboard";
import { formatTimeRaw } from "@foxglove/studio-base/util/time";

import { getMessageDocumentationLink } from "./utils";

const SMetadata = styled.div`
  margin-top: 4px;
  font-size: 11px;
  line-height: 1.3;
  color: #aaa;
`;
type Props = {
  data: unknown;
  diffData: unknown;
  diff: unknown;
  datatype?: string;
  message: MessageEvent<unknown>;
  diffMessage?: MessageEvent<unknown>;
};

function CopyMessageButton({
  text,
  onClick,
}: {
  text: string;
  onClick: (e: React.MouseEvent<HTMLElement>) => void;
}) {
  return (
    <a onClick={onClick} href="#" style={{ textDecoration: "none" }}>
      <Icon tooltip="Copy entire message to clipboard" style={{ position: "relative", top: -1 }}>
        <ClipboardOutlineIcon style={{ verticalAlign: "middle" }} />
      </Icon>{" "}
      {text}
    </a>
  );
}

export default function Metadata({
  data,
  diffData,
  diff,
  datatype,
  message,
  diffMessage,
}: Props): JSX.Element {
  const onClickCopy = useCallback(
    (dataToCopy: unknown) => (e: React.MouseEvent<HTMLElement>) => {
      e.stopPropagation();
      e.preventDefault();
      const dataWithoutLargeArrays = cloneDeepWith(dataToCopy, (value) => {
        if (typeof value === "object" && value.buffer) {
          return "<buffer>";
        }
        return undefined;
      });
      clipboard.copy(JSON.stringify(dataWithoutLargeArrays, undefined, 2) ?? "");
    },
    [],
  );
  return (
    <SMetadata>
      {!diffMessage && datatype && (
        <a
          style={{ color: "inherit" }}
          rel="noopener noreferrer"
          href={getMessageDocumentationLink(datatype)}
        >
          {datatype}
        </a>
      )}
      {diffMessage ? " base" : ""} @ {formatTimeRaw(message.receiveTime)} ROS{" "}
      <CopyMessageButton onClick={onClickCopy(data)} text="Copy msg" />
      {diffMessage?.receiveTime && (
        <>
          <div>
            {`diff @ ${formatTimeRaw(diffMessage.receiveTime)} ROS `}
            <CopyMessageButton onClick={onClickCopy(diffData)} text="Copy msg" />
          </div>
          <CopyMessageButton onClick={onClickCopy(diff)} text="Copy diff of msgs" />
        </>
      )}
    </SMetadata>
  );
}
