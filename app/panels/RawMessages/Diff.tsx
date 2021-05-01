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

import { useCallback, useState } from "react";
import styled from "styled-components";

import Tooltip from "@foxglove-studio/app/components/Tooltip";
import { diffLabels, diffArrow } from "@foxglove-studio/app/panels/RawMessages/getDiff";

// Strings longer than this many characters will start off collapsed.
const COLLAPSE_TEXT_OVER_LENGTH = 512;

export const SDiffSpan = styled.span`
  padding: 0px 4px;
  text-decoration: inherit;
  white-space: pre-line;
`;

export function HighlightedValue({ itemLabel }: { itemLabel: string }): JSX.Element {
  const diffArrowStr = ` ${diffArrow} `;
  // react-json-tree's valueRenderer only gets called for primitives, so diff before/after values must be at same level by the time it gets to the tree
  const splitItemLabel = `${itemLabel}`.split(diffArrowStr);
  const itemLabelContainsChange = splitItemLabel.length === 2;
  if (itemLabelContainsChange) {
    const [before, after] = splitItemLabel;
    const beforeText = JSON.parse(JSON.stringify(before));
    const afterText = JSON.parse(JSON.stringify(after));
    return (
      <SDiffSpan style={{ color: diffLabels.CHANGED.color }}>
        <MaybeCollapsedValue itemLabel={beforeText} />
        {diffArrowStr}
        <MaybeCollapsedValue itemLabel={afterText} />
      </SDiffSpan>
    );
  }

  return (
    <SDiffSpan>
      <MaybeCollapsedValue itemLabel={itemLabel} />
    </SDiffSpan>
  );
}

export function MaybeCollapsedValue({ itemLabel }: { itemLabel: string }): JSX.Element {
  const lengthOverLimit = itemLabel.length >= COLLAPSE_TEXT_OVER_LENGTH;
  const [showingEntireLabel, setShowingEntireLabel] = useState(!lengthOverLimit);
  const itemLabelToShow = showingEntireLabel
    ? itemLabel
    : itemLabel.slice(0, COLLAPSE_TEXT_OVER_LENGTH);
  const expandText = useCallback(() => setShowingEntireLabel(true), []);
  return (
    <Tooltip contents={!showingEntireLabel ? "Text was truncated, click to see all" : ""}>
      <span onClick={expandText} style={{ cursor: !showingEntireLabel ? "pointer" : "inherit" }}>
        {`${itemLabelToShow}${!showingEntireLabel ? "..." : ""}`}
      </span>
    </Tooltip>
  );
}
