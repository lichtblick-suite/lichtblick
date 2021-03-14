// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2020-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import * as React from "react";

// Since flow-types do not exist for react-table, this is a rough approximation
// of what the types react-table gives us, which is pulled from
// https://react-table.tanstack.com/docs/api/overview.
//
// There is an entry in definitely-typed for react-table here:
// https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/react-table
// which we can use in the future for reference. Unfortunately flowgen could not
// easily convert these types.

type CellProps<C, R> = {
  column: C;
  row: R;
  cell: any;
  value: any;
};

type Cell = {
  getCellProps(): any;
  render(props: any): React.ReactElement<any>;
};

type Row = {
  cells: Cell[];
  allCells: Cell[];
  values: any;
  getRowProps(): void;
  index: number;
  original: any;
  subRows: Row[];
  state: any;

  // useExpanded properties.
  getToggleRowExpandedProps(): any;
  isExpanded: boolean;
};

export type PaginationProps = {
  pageCount: number;
  page: Row[];
  pageOptions: number[];
  canPreviousPage: boolean;
  canNextPage: boolean;
  gotoPage(index: number): void;
  previousPage(): void;
  nextPage(): void;
  setPageSize(size: number): void;
};

export type PaginationState = {
  pageSize: number;
  pageIndex: number;
};

type ColumnInstance = {
  id: string;
  isVisible: boolean;
  render(props: any): React.ReactElement<any>;
  totalLeft: number;
  totalWidth: number;
  getHeaderProps(
    props: any,
  ): {
    // no-op
  };
  toggleHidden(hidden: boolean): void;
  getToggleHiddenProps(
    userProps: any,
  ): {
    // no-op
  };
  // useSortBy properties.
  isSorted?: boolean;
  isSortedDesc?: boolean;
  getSortByToggleProps(): {
    // no-op
  };
};

export type ColumnOptions = {
  Header?: string | (() => React.ReactElement<any> | null | undefined);
  accessor?: string;
  columns?: ColumnOptions[];
  Cell?: (props: CellProps<ColumnInstance, Row>) => any;
  id?: string;
  width?: number;
  minWidth?: number;
  maxWidth?: number;
};

type HeaderGroup = {
  headers: ColumnInstance[];
  getHeaderGroupProps(): any;
  getFooterGroupProps(): any;
};

export type TableInstance<HookInstances, HookState> = HookInstances & {
  state: HookState;
  columns: ColumnInstance[];
  allColumns: ColumnInstance[];
  visibleColumns: ColumnInstance[];
  headerGroups: HeaderGroup[];
  footerGroups: HeaderGroup[];
  headers: ColumnInstance[];
  flatHeaders: ColumnInstance[];
  rows: Row[];
  getTableProps(): any;
  getTableBodyProps(): any;
  // Responsible for lazily preparing a row for rendering.
  prepareRow(row: Row): void;
  flatRows: Row[];
  totalColumnsWidth: number;
  toggleHideColumn(columnId: string, value?: boolean): void;
  setHiddenColumns(columnIds: string[]): void;
  toggleHideAllColumns(val?: boolean): void;
  getToggleHideAllColumnsProps(userProps: any): any;
};
