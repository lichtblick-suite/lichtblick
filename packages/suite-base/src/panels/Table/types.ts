// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import {
  AccessorKeyColumnDef,
  DisplayColumnDef,
  createExpandedRowModel,
  createSortedRowModel,
  rowExpandingFeature,
  rowPaginationFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
} from "@tanstack/react-table";

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

export const tableFeatureSet = tableFeatures({
  rowExpandingFeature,
  rowSortingFeature,
  rowPaginationFeature,
  expandedRowModel: createExpandedRowModel(),
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, text: sortFn_text, datetime: sortFn_datetime },
});

export type TableFeatures = typeof tableFeatureSet;

export type CellValue = Record<string, unknown>;

export type MergedColumnsType = Array<
  AccessorKeyColumnDef<TableFeatures, CellValue> | DisplayColumnDef<TableFeatures, CellValue>
>;
