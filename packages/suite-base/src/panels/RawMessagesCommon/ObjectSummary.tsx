// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { memo } from "react";

import { useStyles } from "./ObjectSummary.style";

type ObjectSummaryProps = {
  value: unknown;
};

/**
 * Component that displays a summary for arrays and objects in the tree view.
 */
function ObjectSummary({ value }: ObjectSummaryProps): React.JSX.Element | ReactNull {
  const { classes } = useStyles();

  if (typeof value !== "object" || value == undefined) {
    return ReactNull;
  }

  if (Array.isArray(value)) {
    return <span className={classes.summary}>[] {value.length} items</span>;
  }

  return <span className={classes.summary}>{`{} ${Object.keys(value).length} keys`}</span>;
}

export default memo(ObjectSummary);
