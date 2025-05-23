// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useCallback } from "react";

import { PanelSelection } from "@lichtblick/suite-base/components/PanelCatalog";
import { useCurrentLayoutActions } from "@lichtblick/suite-base/context/CurrentLayoutContext";
import { getPanelIdForType } from "@lichtblick/suite-base/util/layout";

export default function useAddPanel(): (selection: PanelSelection) => void {
  const { addPanel } = useCurrentLayoutActions();
  return useCallback(
    ({ type, config }: PanelSelection) => {
      const id = getPanelIdForType(type);
      addPanel({ id, config });
    },
    [addPanel],
  );
}
