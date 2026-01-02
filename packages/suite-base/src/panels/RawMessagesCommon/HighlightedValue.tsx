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

import MaybeCollapsedValue from "@lichtblick/suite-base/panels/RawMessagesCommon/MaybeCollapsedValue";
import { diffArrow } from "@lichtblick/suite-base/panels/RawMessagesCommon/constants";
import {
  diffLabels,
  PropsHighlightedValue,
} from "@lichtblick/suite-base/panels/RawMessagesCommon/types";

import { DiffSpan } from "./DiffSpan";

export default function HighlightedValue({ itemLabel }: PropsHighlightedValue): React.JSX.Element {
  // react-json-tree's valueRenderer only gets called for primitives, so diff before/after values must be at same level by the time it gets to the tree
  const splitItemLabel = itemLabel.length > 0 ? itemLabel.split(diffArrow) : [];
  const itemLabelContainsChange = splitItemLabel.length === 2;

  if (itemLabelContainsChange) {
    const [before, after] = splitItemLabel;
    const beforeText = before ?? "";
    const afterText = after ?? "";

    return (
      <DiffSpan style={{ color: diffLabels.CHANGED.color }}>
        <MaybeCollapsedValue itemLabel={beforeText} />
        {diffArrow}
        <MaybeCollapsedValue itemLabel={afterText} />
      </DiffSpan>
    );
  }

  return (
    <DiffSpan>
      <MaybeCollapsedValue itemLabel={itemLabel} />
    </DiffSpan>
  );
}
