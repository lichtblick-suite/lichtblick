// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { Layout } from "@lichtblick/suite-base/services/ILayoutStorage";

export type UseLayoutActions = {
  onRenameLayout: (item: Layout, newName: string) => Promise<void>;
  onDuplicateLayout: (item: Layout) => Promise<void>;
  onDeleteLayout: (item: Layout) => Promise<void>;
  onRevertLayout: (item: Layout) => Promise<void>;
  onOverwriteLayout: (item: Layout) => Promise<void>;
  confirmModal: React.JSX.Element | undefined;
};
