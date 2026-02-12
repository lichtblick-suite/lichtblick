// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { Immutable } from "@lichtblick/suite";
import { FocusedExtension } from "@lichtblick/suite-base/components/ExtensionsSettings/types";
import { ExtensionMarketplaceDetail } from "@lichtblick/suite-base/context/ExtensionMarketplaceContext";

export const paginationModel = {
  pageSize: 10,
  page: 0,
};

export type ExtensionListProps = {
  namespace: string;
  entries: Immutable<ExtensionMarketplaceDetail>[];
  filterText: string;
  selectExtension: (newFocusedExtension: FocusedExtension) => void;
};
