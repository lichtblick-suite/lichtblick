// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { DEFAULT_LAYOUT } from "@lichtblick/suite-base/providers/CurrentLayoutProvider/constants";
import { ILayoutManager } from "@lichtblick/suite-base/services/ILayoutManager";
import { Layout } from "@lichtblick/suite-base/services/ILayoutStorage";

export async function cleanupDuplicateDefaultLayouts(
  layouts: readonly Layout[],
  layoutManager: ILayoutManager,
): Promise<void> {
  const defaultLayouts = layouts.filter(
    (layout) =>
      layout.name === DEFAULT_LAYOUT.name && layout.permission === DEFAULT_LAYOUT.permission,
  );
  if (defaultLayouts.length <= 1) {
    return;
  }

  const layoutToKeep =
    defaultLayouts.find((layout) => layout.permission === DEFAULT_LAYOUT.permission) ??
    defaultLayouts[0];

  for (const layout of defaultLayouts) {
    if (layout.id !== layoutToKeep?.id) {
      await layoutManager.deleteLayout({ id: layout.id });
    }
  }
}
