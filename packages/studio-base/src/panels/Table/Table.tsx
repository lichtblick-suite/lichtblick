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

/// <reference types="./react-table-config" />

import PlusIcon from "@mui/icons-material/AddBoxOutlined";
import MinusIcon from "@mui/icons-material/IndeterminateCheckBoxOutlined";
import KeyboardArrowLeftIcon from "@mui/icons-material/KeyboardArrowLeft";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import KeyboardDoubleArrowLeftIcon from "@mui/icons-material/KeyboardDoubleArrowLeft";
import KeyboardDoubleArrowRightIcon from "@mui/icons-material/KeyboardDoubleArrowRight";
import {
  Container,
  IconButton,
  MenuItem,
  Select,
  styled as muiStyled,
  Typography,
} from "@mui/material";
import { noop } from "lodash";
import {
  useTable,
  usePagination,
  useExpanded,
  useSortBy,
  Column,
  ColumnWithLooseAccessor,
} from "react-table";

import EmptyState from "@foxglove/studio-base/components/EmptyState";
import Stack from "@foxglove/studio-base/components/Stack";

import TableCell from "./TableCell";
import { sanitizeAccessorPath } from "./sanitizeAccessorPath";

export const StyledTable = muiStyled("table")(({ theme }) => ({
  border: "none",
  width: "100%",
  borderCollapse: "collapse",
  borderSpacing: 0,

  th: {
    color: theme.palette.text.primary,

    "tr:first-of-type &": {
      paddingTop: theme.spacing(0.5),
      paddingBottom: theme.spacing(0.5),
    },
  },
  "th, td": {
    verticalAlign: "top",
    border: `1px solid ${theme.palette.divider}`,
    padding: "0 0.3em",
    lineHeight: "1.3em",
  },
  tr: {
    svg: {
      opacity: 0.6,
    },
  },
  "tr:hover": {
    td: {
      backgroundColor: theme.palette.action.hover,
      cursor: "pointer",
    },
    svg: {
      opacity: 0.8,
    },
  },
}));

const SIconButton = muiStyled(IconButton)({
  "&:hover": {
    backgroundColor: "transparent",
  },
});

const STableRow = muiStyled("tr")(({ theme }) => ({
  "&:nth-child(even)": {
    backgroundColor: theme.palette.action.hover,
  },
  "&:hover": {
    backgroundColor: theme.palette.action.selected,
  },
}));

const STableHeader = muiStyled("th", {
  shouldForwardProp: (prop) => prop !== "isSortedAsc" && prop !== "isSortedDesc" && prop !== "id",
})<{ id: string; isSortedAsc: boolean; isSortedDesc: boolean }>(
  ({ theme, id, isSortedAsc, isSortedDesc }) => ({
    borderLeftColor: "transparent !important",
    borderRightColor: "transparent !important",
    padding: `${theme.spacing(0.5)} !important`,
    fontWeight: "bold !important",
    cursor: "pointer",
    width: "auto",
    textAlign: "left",

    ...(isSortedAsc && {
      borderBottomColor: `${theme.palette.primary.main} !important`,
    }),
    ...(isSortedDesc && {
      borderTopColor: `${theme.palette.primary.main} !important`,
    }),
    ...(id === "expander" && {
      width: 25,
    }),
  }),
);

const STableData = muiStyled("td")(({ theme }) => ({
  padding: `${theme.spacing(0.5)} !important`,
  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
}));

function getColumnsFromObject(
  val: { toJSON?: () => Record<string, unknown> },
  accessorPath: string,
): Column[] {
  const obj = val.toJSON?.() ?? val;
  const columns = [
    ...Object.keys(obj).map((accessor) => {
      const id = accessorPath.length !== 0 ? `${accessorPath}.${accessor}` : accessor;
      return {
        Header: accessor,
        accessor,
        id,
        Cell({ value, row }) {
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

          // In case the value is null.
          return `${value}`;
        },
      } as Column;
    }),
  ];

  const Cell: ColumnWithLooseAccessor["Cell"] = ({ row }) => (
    <SIconButton
      {...row.getToggleRowExpandedProps()}
      size="small"
      data-testid={`expand-row-${row.index}`}
      style={{ margin: -4 }}
    >
      {row.isExpanded ? <MinusIcon fontSize="small" /> : <PlusIcon fontSize="small" />}
    </SIconButton>
  );

  if (accessorPath.length === 0) {
    columns.unshift({
      id: "expander",
      Cell,
    });
  }

  return columns;
}

export default function Table({
  value,
  accessorPath,
}: {
  value: unknown;
  accessorPath: string;
}): JSX.Element {
  const isNested = accessorPath.length > 0;
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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return getColumnsFromObject(maybeMessage, accessorPath);
  }, [accessorPath, value]);

  const data = React.useMemo(() => (Array.isArray(value) ? value : [value]), [value]);

  const tableInstance = useTable(
    {
      columns,
      data,
      autoResetExpanded: false,
      initialState: { pageSize: 30 },
    },
    useSortBy,
    useExpanded,
    !isNested ? usePagination : noop,
  );

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

  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    page,
    prepareRow,
    rows,
    canPreviousPage,
    canNextPage,
    pageOptions,
    pageCount,
    gotoPage,
    nextPage,
    previousPage,
    setPageSize,
    state: { pageIndex, pageSize },
  } = tableInstance;

  return (
    <>
      <StyledTable {...getTableProps()}>
        <thead>
          {headerGroups.map((headerGroup, i) => {
            return (
              <STableRow {...headerGroup.getHeaderGroupProps()} key={i}>
                {headerGroup.headers.map((column) => {
                  return (
                    <STableHeader
                      isSortedAsc={column.isSorted && !(column.isSortedDesc ?? false)}
                      isSortedDesc={column.isSorted && (column.isSortedDesc ?? false)}
                      id={column.id}
                      {...column.getHeaderProps(column.getSortByToggleProps())}
                      key={column.id}
                      data-testid={`column-header-${sanitizeAccessorPath(column.id)}`}
                    >
                      {column.render("Header")}
                    </STableHeader>
                  );
                })}
              </STableRow>
            );
          })}
        </thead>
        <tbody {...getTableBodyProps()}>
          {(!isNested ? page : rows).map((row) => {
            prepareRow(row);
            return (
              <STableRow {...row.getRowProps()} key={row.index}>
                {row.cells.map((cell, i) => {
                  return (
                    <STableData {...cell.getCellProps()} key={i}>
                      {cell.render("Cell")}
                    </STableData>
                  );
                })}
              </STableRow>
            );
          })}
        </tbody>
      </StyledTable>
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
            <IconButton onClick={() => gotoPage(0)} disabled={!canPreviousPage}>
              <KeyboardDoubleArrowLeftIcon fontSize="small" />
            </IconButton>
            <IconButton onClick={() => previousPage()} disabled={!canPreviousPage}>
              <KeyboardArrowLeftIcon fontSize="small" />
            </IconButton>
            <Typography flex="auto" variant="inherit" align="center" noWrap>
              Page{" "}
              <strong>
                {pageIndex + 1} of {pageOptions.length}
              </strong>
            </Typography>
            <IconButton onClick={() => nextPage()} disabled={!canNextPage}>
              <KeyboardArrowRightIcon fontSize="small" />
            </IconButton>
            <IconButton onClick={() => gotoPage(pageCount - 1)} disabled={!canNextPage}>
              <KeyboardDoubleArrowRightIcon fontSize="small" />
            </IconButton>
            <Select
              value={pageSize}
              size="small"
              onChange={(e) => setPageSize(Number(e.target.value))}
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
