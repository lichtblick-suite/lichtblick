// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

// See: https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/react-table

import {
  UseExpandedInstanceProps,
  UseExpandedOptions,
  UseExpandedRowProps,
  UseExpandedState,
  UsePaginationInstanceProps,
  UsePaginationOptions,
  UsePaginationState,
  UseResizeColumnsColumnProps,
  UseRowStateRowProps,
  UseSortByColumnProps,
  UseSortByOptions,
} from "react-table";

declare module "react-table" {
  export interface TableOptions<D extends Record<string, unknown>>
    extends UsePaginationOptions<D>,
      UseSortByOptions<D>,
      UseExpandedOptions<D> {}

  export interface TableInstance<D extends Record<string, unknown> = Record<string, unknown>>
    extends UseExpandedInstanceProps<D>,
      UsePaginationInstanceProps<D> {}

  export interface TableState<D extends Record<string, unknown> = Record<string, unknown>>
    extends UseExpandedState<D>,
      UsePaginationState<D> {}

  export interface ColumnInstance<D extends Record<string, unknown> = Record<string, unknown>>
    extends UseResizeColumnsColumnProps<D>,
      UseSortByColumnProps<D> {}

  export interface Row<D extends Record<string, unknown> = Record<string, unknown>>
    extends UseExpandedRowProps<D>,
      UseRowStateRowProps<D> {}
}
