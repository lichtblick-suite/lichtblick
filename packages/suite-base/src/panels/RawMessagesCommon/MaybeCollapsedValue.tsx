// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

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

import { COLLAPSE_TEXT_OVER_LENGTH } from "@lichtblick/suite-base/panels/RawMessagesCommon/constants";
import { PropsMaybeCollapsedValue } from "@lichtblick/suite-base/panels/RawMessagesCommon/types";

export default function MaybeCollapsedValue({
  itemLabel,
}: PropsMaybeCollapsedValue): React.JSX.Element {
  const lengthOverLimit = itemLabel.length >= COLLAPSE_TEXT_OVER_LENGTH;

  const [showingEntireLabel, setShowingEntireLabel] = useState(!lengthOverLimit);

  const expandText = useCallback(() => {
    setShowingEntireLabel(true);
  }, []);

  // Tooltip is expensive to render. Skip it if we're not truncating.
  if (!lengthOverLimit) {
    return <span>{itemLabel}</span>;
  }

  const truncatedItemText = showingEntireLabel
    ? itemLabel
    : itemLabel.slice(0, COLLAPSE_TEXT_OVER_LENGTH);

  return (
    <Tooltip
      title={showingEntireLabel ? "" : "Text was truncated, click to see all"}
      placement="top"
    >
      <button
        onClick={expandText}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            expandText();
          }
        }}
        tabIndex={showingEntireLabel ? undefined : 0}
        style={{
          cursor: showingEntireLabel ? "inherit" : "pointer",
        }}
        aria-expanded={showingEntireLabel}
      >
        {`${truncatedItemText}${showingEntireLabel ? "" : "…"}`}
      </button>
    </Tooltip>
  );
}
