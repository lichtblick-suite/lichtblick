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

import MinusIcon from "@mui/icons-material/IndeterminateCheckBoxOutlined";
import { IconButton } from "@mui/material";
import { Row } from "@tanstack/react-table";
import { PropsWithChildren } from "react";
import { makeStyles } from "tss-react/mui";

import { CellValue } from "@foxglove/studio-base/panels/Table/types";

import { sanitizeAccessorPath } from "./sanitizeAccessorPath";

const useStyles = makeStyles()((theme) => ({
  objectCell: {
    fontStyle: "italic",
    cursor: "pointer",
  },
  iconButton: {
    marginTop: theme.spacing(-0.5),
    marginLeft: theme.spacing(-0.5),

    "&:hover": {
      backgroundColor: "transparent",
    },
  },
}));

type TableCellProps = {
  row: Row<CellValue>;
  accessorPath: string;
};

export default function TableCell({
  row,
  accessorPath,
  children,
}: PropsWithChildren<TableCellProps>): JSX.Element {
  const { classes } = useStyles();
  const [isExpanded, setIsExpanded] = React.useState(false);
  const toggleIsExpanded = React.useCallback(() => {
    setIsExpanded((expanded) => !expanded);
  }, []);

  if (row.getIsExpanded() || isExpanded) {
    return (
      <div>
        {isExpanded && (
          <IconButton size="small" onClick={toggleIsExpanded} className={classes.iconButton}>
            <MinusIcon fontSize="small" />
          </IconButton>
        )}
        {children}
      </div>
    );
  }

  return (
    <span
      className={classes.objectCell}
      data-testid={`expand-cell-${sanitizeAccessorPath(accessorPath)}-${row.index}`}
      onClick={toggleIsExpanded}
    >
      Object
    </span>
  );
}
