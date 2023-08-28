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

import PlusIcon from "@mui/icons-material/AddBoxOutlined";
import MinusIcon from "@mui/icons-material/IndeterminateCheckBoxOutlined";
import KeyboardArrowLeftIcon from "@mui/icons-material/KeyboardArrowLeft";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import KeyboardDoubleArrowLeftIcon from "@mui/icons-material/KeyboardDoubleArrowLeft";
import KeyboardDoubleArrowRightIcon from "@mui/icons-material/KeyboardDoubleArrowRight";
import { Container, IconButton, MenuItem, Select, Typography } from "@mui/material";
import {
  ExpandedState,
  PaginationState,
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { makeStyles } from "tss-react/mui";

import EmptyState from "@foxglove/studio-base/components/EmptyState";
import Stack from "@foxglove/studio-base/components/Stack";

import TableCell from "./TableCell";
import { sanitizeAccessorPath } from "./sanitizeAccessorPath";
import { CellValue } from "./types";

type TypedArray =
  | Int8Array
  | Uint8Array
  | Uint8ClampedArray
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Float32Array
  | Float64Array;

function isTypedArray(value: unknown): value is TypedArray {
  return (
    value instanceof Uint8Array ||
    value instanceof Uint8ClampedArray ||
    value instanceof Int8Array ||
    value instanceof Uint16Array ||
    value instanceof Int16Array ||
    value instanceof Uint32Array ||
    value instanceof Int32Array ||
    value instanceof Float32Array ||
    value instanceof Float64Array
  );
}

const useStyles = makeStyles<void, "tableData" | "tableHeader">()((theme, _params, classes) => ({
  table: {
    border: "none",
    width: "100%",
    borderCollapse: "collapse",
    borderSpacing: 0,
  },
  tableRow: {
    svg: { opacity: 0.6 },

    "&:nth-of-type(even)": {
      backgroundColor: theme.palette.action.hover,
    },
    "&:hover": {
      backgroundColor: theme.palette.action.focus,

      [`.${classes.tableData}`]: {
        backgroundColor: theme.palette.action.hover,
        cursor: "pointer",
      },
      svg: { opacity: 0.8 },
    },

    [`.${classes.tableHeader}:first-of-type`]: {
      paddingTop: theme.spacing(0.5),
      paddingBottom: theme.spacing(0.5),
    },
  },
  tableData: {
    border: `1px solid ${theme.palette.divider}`,
    lineHeight: "1.3em",
    padding: `${theme.spacing(0.5)} !important`,
    verticalAlign: "top",
  },
  tableHeader: {
    color: theme.palette.text.primary,
    verticalAlign: "top",
    border: `1px solid ${theme.palette.divider}`,
    lineHeight: "1.3em",
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    padding: theme.spacing(0.5),
    fontWeight: "bold !important",
    cursor: "pointer",
    width: "auto",
    textAlign: "left",

    "&#expander": { width: 28 },
  },
  sortAsc: {
    borderBottomColor: theme.palette.primary.main,
  },
  sortDesc: {
    borderTopColor: theme.palette.primary.main,
  },
  iconButton: {
    margin: theme.spacing(-0.5),

    "&:hover": {
      backgroundColor: "transparent",
    },
  },
  textContent: {
    maxWidth: "75vw",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
}));

const columnHelper = createColumnHelper<CellValue>();

function getColumnsFromObject(val: CellValue, accessorPath: string, iconButtonClasses: string) {
  const obj = val.toJSON?.() ?? val;
  if (isTypedArray(obj)) {
    return [
      columnHelper.accessor((row) => row, {
        id: "typedArray",
        header: "",
        cell: (info) => info.getValue(),
      }),
    ];
  }
  const columns = Object.keys(obj).map((accessor) => {
    const id = accessorPath.length !== 0 ? `${accessorPath}.${accessor}` : accessor;
    return columnHelper.accessor(accessor, {
      header: accessor,
      id,
      cell: (info) => {
        const value = info.getValue();
        const row = info.row;
        if (Array.isArray(value) && typeof value[0] !== "object") {
          return JSON.stringify(value);
        }

        // eslint-disable-next-line no-restricted-syntax
        if (typeof value === "object" && value != null) {
          return (
            <TableCell row={row} accessorPath={id}>
              <Table value={value} accessorPath={accessorPath} />
            </TableCell>
          );
        }

        // Interpolate in case the value is null.
        return <TextCellContent value={`${value}`} />;
      },
    });
  });

  if (accessorPath.length === 0) {
    const expandColumn = columnHelper.display({
      id: "expander",
      header: "",
      cell: ({ row }) => {
        return (
          <IconButton
            className={iconButtonClasses}
            size="small"
            data-testid={`expand-row-${row.index}`}
            onClick={() => row.toggleExpanded()}
          >
            {row.getIsExpanded() ? <MinusIcon fontSize="small" /> : <PlusIcon fontSize="small" />}
          </IconButton>
        );
      },
    });
    columns.unshift(expandColumn);
  }

  return columns;
}

function TextCellContent(props: { value: string }): JSX.Element {
  const { classes } = useStyles();

  return <div className={classes.textContent}>{props.value}</div>;
}

export default function Table({
  value,
  accessorPath,
}: {
  value: unknown;
  accessorPath: string;
}): JSX.Element {
  const isNested = accessorPath.length > 0;
  const { classes, cx } = useStyles();

  const columns = React.useMemo(() => {
    if (
      // eslint-disable-next-line no-restricted-syntax
      value == null ||
      typeof value !== "object" ||
      // eslint-disable-next-line no-restricted-syntax
      (Array.isArray(value) && typeof value[0] !== "object" && value[0] != null)
    ) {
      return [];
    }

    const maybeMessage = Array.isArray(value) ? value[0] ?? {} : value;

    // Strong assumption about structure of data.
    return getColumnsFromObject(maybeMessage as CellValue, accessorPath, classes.iconButton);
  }, [accessorPath, classes.iconButton, value]);

  const [{ pageIndex, pageSize }, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  const pagination = React.useMemo(
    () => ({
      pageIndex,
      pageSize,
    }),
    [pageIndex, pageSize],
  );

  const data = React.useMemo(() => {
    return Array.isArray(value) ? value : isTypedArray(value) ? Array.from(value) : [value];
  }, [value]);

  const [expanded, setExpanded] = React.useState<ExpandedState>({});

  const table = useReactTable({
    autoResetExpanded: false,
    columns,
    data: data.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize),
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getSortedRowModel: getSortedRowModel(),
    initialState: { pagination },
    onExpandedChange: setExpanded,
    manualPagination: true,
    pageCount: Math.ceil(data.length / pagination.pageSize),
    onPaginationChange: setPagination,
    state: {
      expanded,
      pagination,
    },
  });

  if (
    typeof value !== "object" ||
    // eslint-disable-next-line no-restricted-syntax
    value == null ||
    (!isNested && Array.isArray(value) && typeof value[0] !== "object")
  ) {
    return (
      <EmptyState>
        Cannot render primitive values in a table. Try using the Raw Messages panel instead.
      </EmptyState>
    );
  }

  return (
    <>
      <table className={classes.table}>
        <thead>
          {table.getHeaderGroups().map((headerGroup, i) => {
            return (
              <tr className={classes.tableRow} key={i}>
                {headerGroup.headers.map((header) => {
                  const column = header.column;
                  return (
                    <th
                      className={cx(classes.tableHeader, {
                        [classes.sortAsc]: column.getIsSorted() === "asc",
                        [classes.sortDesc]: column.getIsSorted() === "desc",
                      })}
                      id={column.id}
                      onClick={header.column.getToggleSortingHandler()}
                      key={column.id}
                      data-testid={`column-header-${sanitizeAccessorPath(column.id)}`}
                    >
                      {flexRender(header.column.columnDef.header, header)}
                    </th>
                  );
                })}
              </tr>
            );
          })}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => {
            return (
              <tr className={classes.tableRow} key={row.id}>
                {row.getVisibleCells().map((cell) => {
                  return (
                    <td className={classes.tableData} key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      {!isNested && (
        <Container maxWidth="xs" disableGutters>
          <Stack
            direction="row"
            flexWrap="wrap"
            gap={1}
            paddingX={0.5}
            paddingTop={0.5}
            alignItems="center"
          >
            <IconButton
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
            >
              <KeyboardDoubleArrowLeftIcon fontSize="small" />
            </IconButton>
            <IconButton onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
              <KeyboardArrowLeftIcon fontSize="small" />
            </IconButton>
            <Typography flex="auto" variant="inherit" align="center" noWrap>
              Page{" "}
              <strong>
                {table.getState().pagination.pageIndex + 1} of {table.getPageOptions().length}
              </strong>
            </Typography>
            <IconButton onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
              <KeyboardArrowRightIcon fontSize="small" />
            </IconButton>
            <IconButton
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
            >
              <KeyboardDoubleArrowRightIcon fontSize="small" />
            </IconButton>
            <Select
              value={pageSize}
              size="small"
              onChange={(e) => table.setPageSize(Number(e.target.value))}
              MenuProps={{ MenuListProps: { dense: true } }}
            >
              {[10, 20, 30, 40, 50].map((size) => (
                <MenuItem key={size} value={size}>{`Show ${size}`}</MenuItem>
              ))}
            </Select>
          </Stack>
        </Container>
      )}
    </>
  );
}
