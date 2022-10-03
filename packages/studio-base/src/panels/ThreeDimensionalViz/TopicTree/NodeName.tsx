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

import styled from "styled-components";

import TextMiddleTruncate from "@foxglove/studio-base/components/TextMiddleTruncate";
import Tooltip from "@foxglove/studio-base/components/Tooltip";

import TextHighlight from "./TextHighlight";

// Extra text length to make sure text such as `1000 visible topics` don't get truncated.
const DEFAULT_END_TEXT_LENGTH = 22;

export const STopicNameDisplay = styled.div`
  display: inline-block;
`;

export const SDisplayName = styled.div`
  font-size: 13px;
  line-height: 1.4;
  margin-right: 4px;
  word-break: break-word;
  /* disallow selection to prevent shift + click from accidentally select */
  user-select: none;
  width: 100%;
`;

export const SName = styled.div`
  /* disallow selection to prevent shift + click from accidentally select */
  user-select: none;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;
const SWrapper = styled.div`
  display: flex;
  align-items: center;
`;

type Props = {
  // Additional element to show in non xs view when not searching. Currently only used for showing visible topic count.
  additionalElem?: React.ReactNode;
  displayName: string;
  isXSWidth: boolean;
  maxWidth: number;
  topicName: string;
  searchText?: string;
  style?: {
    [attr: string]: string | number;
  };
  tooltips?: React.ReactNode[];
};

export default function NodeName({
  additionalElem,
  displayName,
  isXSWidth,
  maxWidth,
  topicName,
  searchText,
  style = {},
  tooltips,
}: Props): JSX.Element {
  let targetStr = displayName ? displayName : topicName;

  if (searchText) {
    if (displayName.length > 0 && topicName.length > 0 && displayName !== topicName) {
      targetStr = `${displayName} (${topicName})`;
    }
  }
  const xsWidthElem =
    isXSWidth &&
    (tooltips ? (
      <Tooltip contents={tooltips} placement="top">
        <SName>{targetStr}</SName>
      </Tooltip>
    ) : (
      <SName>{targetStr}</SName>
    ));

  const textTruncateElem = (
    <TextMiddleTruncate
      text={targetStr}
      endTextLength={
        topicName.length > 0 ? topicName.split("/").pop()!.length + 1 : DEFAULT_END_TEXT_LENGTH
      }
    />
  );
  return (
    <STopicNameDisplay style={style}>
      <SDisplayName style={{ maxWidth }}>
        {searchText ? (
          <TextHighlight targetStr={targetStr} searchText={searchText} />
        ) : (
          <>
            {isXSWidth ? (
              xsWidthElem
            ) : additionalElem ? ( // eslint-disable-line @typescript-eslint/strict-boolean-expressions
              <SWrapper style={{ width: maxWidth }}>
                {textTruncateElem}
                {additionalElem}
              </SWrapper>
            ) : (
              textTruncateElem
            )}
          </>
        )}
      </SDisplayName>
    </STopicNameDisplay>
  );
}
