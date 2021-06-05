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

import fuzzySort from "fuzzysort";
import styled from "styled-components";

import { colors } from "@foxglove/studio-base/util/sharedStyleConstants";

const STextHighlight = styled.span`
  .TextHighlight-highlight {
    color: ${colors.PURPLE};
    font-weight: bold;
  }
`;

type Props = {
  targetStr: string;
  searchText?: string;
};

export default function TextHighlight({ targetStr = "", searchText = "" }: Props): JSX.Element {
  if (searchText.length === 0) {
    return <>{targetStr}</>;
  }
  const result = fuzzySort.highlight(
    fuzzySort.single(searchText, targetStr) ?? undefined,
    "<span class='TextHighlight-highlight'>",
    "</span>",
  );
  // TODO(Audrey): compute highlighted parts separately in order to avoid dangerouslySetInnerHTML
  return (
    <STextHighlight>
      {result != undefined && result.length > 0 ? (
        <span dangerouslySetInnerHTML={{ __html: result }} />
      ) : (
        targetStr
      )}
    </STextHighlight>
  );
}
