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

import { Square24Filled } from "@fluentui/react-icons";
import { sortBy, take } from "lodash";
import { Fragment, PropsWithChildren, useMemo } from "react";
import { DeepReadonly } from "ts-essentials";
import { makeStyles } from "tss-react/mui";

import Stack from "@foxglove/studio-base/components/Stack";
import { fonts } from "@foxglove/studio-base/util/sharedStyleConstants";

export type TimeBasedChartTooltipData = {
  datasetIndex?: number;
  x: number | bigint;
  y: number | bigint;
  path: string;
  value: number | bigint | boolean | string;
  constantName?: string;
};

type Props = DeepReadonly<{
  colorsByDatasetIndex?: Record<string, undefined | string>;
  content: TimeBasedChartTooltipData[];
  labelsByDatasetIndex?: Record<string, undefined | string>;
  // Flag indicating the containing chart has multiple datasets
  multiDataset: boolean;
}>;

const useStyles = makeStyles()((theme) => ({
  root: {
    fontFamily: fonts.MONOSPACE,
    fontSize: theme.typography.caption.fontSize,
    lineHeight: theme.typography.caption.lineHeight,
    overflowWrap: "break-word",
  },
  grid: {
    columnGap: theme.spacing(0.5),
    display: "grid",
    gridTemplateColumns: "auto minmax(0px, max-content) minmax(auto, max-content)",
    alignItems: "center",
    fontFamily: fonts.MONOSPACE,
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

  const itemsByPath = useMemo(() => {
    const out = new Map<string, TimeBasedChartTooltipData[]>();
    const overflow = new Set<string>();
    // for single dataset plots we don't care about grouping by path - there is only one path
    if (!multiDataset) {
      return { out, overflow };
    }
    // group items by path
    for (const item of content) {
      const existing = out.get(item.path) ?? [];
      existing.push(item);
      out.set(item.path, existing);

      if (existing.length > 1) {
        overflow.add(item.path);
      }
    }

    return { out, overflow };
  }, [content, multiDataset]);

  // If the chart contains only one dataset, we don't need to render the dataset label - saving space
  // We cannot detect this from the content since content is only what is actively hovered which may
  // not include all datasets
  if (!multiDataset) {
    return (
      <Stack className={classes.root} data-testid="TimeBasedChartTooltipContent">
        {take(content, 1).map((item, idx) => {
          const value =
            typeof item.value === "string"
              ? item.value
              : typeof item.value === "bigint"
              ? item.value.toString()
              : JSON.stringify(item.value);
          return (
            <div key={idx}>
              {value}
              {item.constantName != undefined ? ` (${item.constantName})` : ""}
            </div>
          );
        })}
        {content.length > 1 && <OverflowMessage />}
      </Stack>
    );
  }

  // Sort items by their dataset index to maintain the same ordering as the series in the legend.
  const sortedItems = sortBy(
    [...itemsByPath.out.entries()],
    ([_, items]) => items[0]?.datasetIndex ?? 0,
  );

  return (
    <div className={cx(classes.root, classes.grid)} data-testid="TimeBasedChartTooltipContent">
      {sortedItems.map(([path, items], idx) => {
        const firstItem = items[0];
        const color =
          firstItem?.datasetIndex != undefined
            ? colorsByDatasetIndex?.[firstItem.datasetIndex]
            : "auto";
        const label =
          firstItem?.datasetIndex != undefined
            ? labelsByDatasetIndex?.[firstItem.datasetIndex]
            : undefined;
        return (
          <Fragment key={idx}>
            <Square24Filled className={classes.icon} primaryFill={color} />
            <div className={classes.path}>{label ?? path}</div>
            {take(items, 1).map((item, itemIdx) => {
              const value =
                typeof item.value === "string"
                  ? item.value
                  : typeof item.value === "bigint"
                  ? item.value.toString()
                  : JSON.stringify(item.value);
              return (
                <div className={classes.value} key={itemIdx}>
                  {value}
                  {item.constantName != undefined ? ` (${item.constantName})` : ""}
                </div>
              );
            })}
            {itemsByPath.overflow.has(path) && <OverflowMessage />}
          </Fragment>
        );
      })}
    </div>
  );
}
