// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { Square12Filled } from "@fluentui/react-icons";
import * as _ from "lodash-es";
import { Fragment, PropsWithChildren, useMemo } from "react";
import { makeStyles } from "tss-react/mui";

import { Immutable } from "@foxglove/studio";
import Stack from "@foxglove/studio-base/components/Stack";

export type TimeBasedChartTooltipData = {
  datasetIndex: number;
  value: number | bigint | boolean | string;
  constantName?: string;
};

type Props = Immutable<{
  colorsByDatasetIndex?: Record<string, undefined | string>;
  content: TimeBasedChartTooltipData[];
  labelsByDatasetIndex?: Record<string, undefined | string>;
  // Flag indicating the containing chart has multiple datasets
  multiDataset: boolean;
}>;

const useStyles = makeStyles()((theme) => ({
  root: {
    fontFamily: theme.typography.fontMonospace,
    fontSize: theme.typography.caption.fontSize,
    lineHeight: theme.typography.caption.lineHeight,
    overflowWrap: "break-word",
  },
  grid: {
    columnGap: theme.spacing(0.5),
    display: "grid",
    gridTemplateColumns: "auto minmax(0px, max-content) minmax(auto, max-content)",
    alignItems: "center",
    fontFamily: theme.typography.fontMonospace,
    fontSize: theme.typography.caption.fontSize,
    lineHeight: theme.typography.caption.lineHeight,
    overflowWrap: "break-word",
  },
  icon: {
    gridColumn: "1",
    height: 12,
    width: 12,
  },
  path: {
    opacity: 0.9,
    whiteSpace: "nowrap",
  },
  value: {
    fontWeight: 600,
    paddingLeft: theme.spacing(2),
  },
  overflow: {
    gridColumn: "2/4",
    opacity: theme.palette.action.disabledOpacity,
    fontStyle: "italic",

    ":not(:last-child)": {
      marginBottom: theme.spacing(0.5),
    },
  },
}));

function OverflowMessage(): JSX.Element {
  const { classes } = useStyles();

  return <div className={classes.overflow}>&lt;multiple values under cursor&gt;</div>;
}

export default function TimeBasedChartTooltipContent(
  props: PropsWithChildren<Props>,
): React.ReactElement {
  const { colorsByDatasetIndex, content, labelsByDatasetIndex, multiDataset } = props;
  const { classes, cx } = useStyles();

  // Compute whether there are multiple items for the dataset so we can show the user
  // a message informing them about the multiple items.
  //
  // We do not actually show all the items to keep the tooltip size sane.
  const sortedItems = useMemo(() => {
    // for single dataset plots we don't care about grouping by path - there is only one path
    if (!multiDataset) {
      return [];
    }

    const out = new Map<
      number,
      { tooltip: TimeBasedChartTooltipData; hasMultipleValues: boolean }
    >();

    // group items by path
    for (const item of content) {
      const datasetIndex = item.datasetIndex;
      const existing = out.get(datasetIndex);
      if (existing) {
        existing.hasMultipleValues = true;
        continue;
      }

      out.set(datasetIndex, {
        tooltip: item,
        hasMultipleValues: false,
      });
    }

    // Sort by datasetIndex to keep the displayed values in the same order as the settings
    return _.sortBy([...out.entries()], ([, items]) => items.tooltip.datasetIndex);
  }, [content, multiDataset]);

  // If the chart contains only one dataset, we don't need to render the dataset label - saving space
  //
  // We cannot detect this from the content since content is only what is actively hovered which may
  // not include all datasets
  if (!multiDataset) {
    const tooltip = content[0];
    if (!tooltip) {
      return <></>;
    }

    const value =
      typeof tooltip.value === "string"
        ? tooltip.value
        : typeof tooltip.value === "bigint"
        ? tooltip.value.toString()
        : JSON.stringify(tooltip.value);

    return (
      <Stack className={classes.root} data-testid="TimeBasedChartTooltipContent">
        <div>
          {value}
          {tooltip.constantName != undefined ? ` (${tooltip.constantName})` : ""}
        </div>
        {content.length > 1 && <OverflowMessage />}
      </Stack>
    );
  }

  return (
    <div className={cx(classes.root, classes.grid)} data-testid="TimeBasedChartTooltipContent">
      {sortedItems.map(([datasetIndex, item], idx) => {
        const color = colorsByDatasetIndex?.[datasetIndex] ?? "auto";
        const label = labelsByDatasetIndex?.[datasetIndex];
        const tooltip = item.tooltip;
        const value =
          typeof tooltip.value === "string"
            ? tooltip.value
            : typeof tooltip.value === "bigint"
            ? tooltip.value.toString()
            : JSON.stringify(tooltip.value);

        return (
          <Fragment key={idx}>
            <Square12Filled className={classes.icon} primaryFill={color} />
            <div className={classes.path}>{label ?? ""}</div>
            <div className={classes.value}>
              {value}
              {tooltip.constantName != undefined ? ` (${tooltip.constantName})` : ""}
            </div>
            {item.hasMultipleValues && <OverflowMessage />}
          </Fragment>
        );
      })}
    </div>
  );
}
