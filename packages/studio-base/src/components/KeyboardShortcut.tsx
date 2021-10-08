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

import { colors, textSize, rounded, fonts } from "@foxglove/studio-base/util/sharedStyleConstants";

const SKeyboardShortcut = styled.div`
  padding: 4px 0;
  max-width: 400px;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const SDescription = styled.div`
  margin-right: 16px;
`;

const SKeyWrapper = styled.div`
  display: inline-flex;
  flex: none;
  color: ${colors.GRAY};
  border: 1px solid ${colors.DARK9};
  border-radius: ${rounded.SMALL};
  font-size: ${textSize.SMALL};
  font-weight: 500;
  min-width: 20px;
  align-items: center;
  justify-content: center;
`;

const SKey = styled.kbd`
  color: ${colors.GRAY};
  padding: 0 3px;
  font-size: 12px;
  line-height: 1.5;
  font-family: ${fonts.SANS_SERIF};

  :not(:last-child) {
    border-right: 1px solid ${colors.DARK9};
  }
`;

type Props = {
  keys: string[];
  description?: string;
  descriptionMaxWidth?: number;
};

export default function KeyboardShortcut({
  keys,
  description,
  descriptionMaxWidth,
}: Props): JSX.Element {
  return (
    <SKeyboardShortcut>
      {description != undefined && description.length > 0 && (
        <SDescription
          style={descriptionMaxWidth != undefined ? { width: descriptionMaxWidth } : {}}
        >
          {description}
        </SDescription>
      )}
      <span>
        {keys.map((key, idx) => (
          <SKeyWrapper key={idx} style={idx < keys.length - 1 ? { marginRight: 4 } : {}}>
            <SKey>{key}</SKey>
          </SKeyWrapper>
        ))}
      </span>
    </SKeyboardShortcut>
  );
}
