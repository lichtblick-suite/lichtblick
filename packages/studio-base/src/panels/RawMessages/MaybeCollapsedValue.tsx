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

import { Tooltip } from "@mui/material";
import { useCallback, useState } from "react";

// Strings longer than this many characters will start off collapsed.
const COLLAPSE_TEXT_OVER_LENGTH = 512;

type Props = { itemLabel: string };

export default function MaybeCollapsedValue({ itemLabel }: Props): JSX.Element {
  const lengthOverLimit = itemLabel.length >= COLLAPSE_TEXT_OVER_LENGTH;

  const [showingEntireLabel, setShowingEntireLabel] = useState(!lengthOverLimit);

  const expandText = useCallback(() => {
    setShowingEntireLabel(true);
  }, []);

  const truncatedItemText = showingEntireLabel
    ? itemLabel
    : itemLabel.slice(0, COLLAPSE_TEXT_OVER_LENGTH);

  // Tooltip is expensive to render. Skip it if we're not truncating.
  if (!lengthOverLimit) {
    return <span>{itemLabel}</span>;
  }

  return (
    <Tooltip
      title={!showingEntireLabel ? "Text was truncated, click to see all" : ""}
      placement="top"
    >
      <span onClick={expandText} style={{ cursor: !showingEntireLabel ? "pointer" : "inherit" }}>
        {`${truncatedItemText}${!showingEntireLabel ? "..." : ""}`}
      </span>
    </Tooltip>
  );
}
