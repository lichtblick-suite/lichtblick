// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { memo, useMemo } from "react";

import useGetItemStringWithTimezone from "@lichtblick/suite-base/components/JsonTree/useGetItemStringWithTimezone";

import { useStyles } from "./ObjectSummary.style";

type ObjectSummaryProps = {
  value: unknown;
};

/**
 * Component that displays a summary for arrays and objects in the tree view.
 */
function ObjectSummary({ value }: ObjectSummaryProps): React.JSX.Element | ReactNull {
  const { classes } = useStyles();
  const getItemString = useGetItemStringWithTimezone();

  const summary = useMemo(() => {
    if (typeof value !== "object" || value == undefined) {
      return ReactNull;
    }

    const itemString = Array.isArray(value)
      ? `[] ${value.length} items`
      : `{} ${Object.keys(value).length} keys`;

    return getItemString("", value, "", itemString);
  }, [value, getItemString]);

  if (summary === ReactNull) {
    return ReactNull;
  }

  return <span className={classes.summary}>{summary}</span>;
}

export default memo(ObjectSummary);
