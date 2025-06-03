// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

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

import PowerInputIcon from "@mui/icons-material/PowerInput";
import ShowChartIcon from "@mui/icons-material/ShowChart";
import {
  Tooltip,
  Table,
  TableBody,
  TableCell,
  TableRow,
  IconButton,
  Typography,
} from "@mui/material";
import * as _ from "lodash-es";
import { ReactElement, useCallback, useEffect, useRef, useState } from "react";

import Stack from "@lichtblick/suite-base/components/Stack";
import { useStyles } from "@lichtblick/suite-base/panels/DiagnosticStatus/DiagnosticTable.style";
import { MIN_SPLIT_FRACTION } from "@lichtblick/suite-base/panels/DiagnosticStatus/constants";
import {
  DiagnosticStatusProps,
  FormattedKeyValue,
} from "@lichtblick/suite-base/panels/DiagnosticStatus/types";
import { getFormattedKeyValues } from "@lichtblick/suite-base/panels/DiagnosticStatus/utils/getFormattedKeyValues";
import { isFloatOrInteger } from "@lichtblick/suite-base/panels/DiagnosticStatus/utils/isFloaterOrInteger";
import { MESSAGE_COLORS } from "@lichtblick/suite-base/panels/DiagnosticSummary/constants";
import { openSiblingPlotPanel } from "@lichtblick/suite-base/panels/Plot/utils/openSiblingPlotPanel";
import { openSiblingStateTransitionsPanel } from "@lichtblick/suite-base/panels/StateTransitions/openSiblingStateTransitionsPanel";

// component to display a single diagnostic status
export default function DiagnosticTable({
  info,
  numericPrecision,
  onChangeSplitFraction,
  openSiblingPanel,
  splitFraction = 0.5,
  topicToRender,
}: DiagnosticStatusProps): React.JSX.Element {
  const { classes } = useStyles();
  const tableRef = useRef<HTMLTableElement>(ReactNull);

  const resizeMouseDown = useCallback((event: React.MouseEvent) => {
    setResizing(true);
    event.preventDefault();
  }, []);
  const resizeMouseUp = useCallback(() => {
    setResizing(false);
  }, []);
  const resizeMouseMove = useCallback(
    (event: MouseEvent) => {
      if (!tableRef.current) {
        return;
      }

      const { left, right } = tableRef.current.getBoundingClientRect();
      const newSplitFraction = _.clamp(
        (event.clientX - left) / (right - left),
        MIN_SPLIT_FRACTION,
        1 - MIN_SPLIT_FRACTION,
      );
      onChangeSplitFraction(newSplitFraction);
    },
    [onChangeSplitFraction],
  );

  const [resizing, setResizing] = useState(false);
  useEffect(() => {
    if (resizing) {
      window.addEventListener("mousemove", resizeMouseMove);
      window.addEventListener("mouseup", resizeMouseUp);
      return () => {
        window.removeEventListener("mousemove", resizeMouseMove);
        window.removeEventListener("mouseup", resizeMouseUp);
      };
    } else {
      return undefined;
    }
  }, [resizeMouseMove, resizeMouseUp, resizing]);

  const renderKeyValueCell = useCallback(
    (
      html: { __html: string } | undefined,
      str: string,
      openPlotPanelIconElem?: React.ReactNode,
    ): ReactElement => {
      if (html) {
        return <TableCell className={classes.htmlTableCell} dangerouslySetInnerHTML={html} />;
      }

      // Apply numeric precision to the value if requested and it can be parsed
      // as a float
      let strToRender = str;
      if (numericPrecision != undefined && isFloatOrInteger(str)) {
        strToRender = parseFloat(str).toFixed(numericPrecision);
      }

      return (
        <TableCell padding="checkbox">
          <Stack
            direction="row"
            gap={1}
            alignItems="center"
            flex="auto"
            justifyContent="space-between"
          >
            {strToRender || "\xa0"}
            {openPlotPanelIconElem}
          </Stack>
        </TableCell>
      );
    },
    [classes.htmlTableCell, numericPrecision],
  );

  const renderKeyValueSections = useCallback((): React.ReactNode => {
    const formattedKeyVals: FormattedKeyValue[] = getFormattedKeyValues(info.status);

    return formattedKeyVals.map(({ key, value, keyHtml, valueHtml }) => {
      // We need both `hardware_id` and `name`; one of them is not enough. That's also how we identify
      // what to show in this very panel; see `selectedHardwareId` AND `selectedName` in the config.
      const valuePath = `${topicToRender}.status[:]{hardware_id=="${info.status.hardware_id}"}{name=="${info.status.name}"}.values[:]{key=="${key}"}.value`;

      let openPlotPanelIconElem = undefined;
      if (value.length > 0) {
        openPlotPanelIconElem = !isNaN(Number(value)) ? (
          <IconButton
            className={classes.iconButton}
            title="Open in Plot panel"
            color="inherit"
            size="small"
            data-testid="open-plot-button"
            onClick={() => {
              openSiblingPlotPanel(openSiblingPanel, valuePath);
            }}
          >
            <ShowChartIcon fontSize="inherit" />
          </IconButton>
        ) : (
          <IconButton
            className={classes.iconButton}
            title="Open in State Transitions panel"
            color="inherit"
            size="small"
            data-testid="open-state-transitions-button"
            onClick={() => {
              openSiblingStateTransitionsPanel(openSiblingPanel, valuePath);
            }}
          >
            <PowerInputIcon fontSize="inherit" />
          </IconButton>
        );
      }
      return (
        <TableRow key={key} hover>
          {renderKeyValueCell(keyHtml, key)}
          {renderKeyValueCell(valueHtml, value, openPlotPanelIconElem)}
        </TableRow>
      );
    });
  }, [classes.iconButton, info.status, openSiblingPanel, renderKeyValueCell, topicToRender]);

  return (
    <div>
      <div
        className={classes.resizeHandle}
        style={{
          left: `${100 * splitFraction}%`,
        }}
        onMouseDown={resizeMouseDown}
        data-testid="DiagnosticTable-resizeHandle"
      />
      <Table className={classes.table} size="small" ref={tableRef}>
        <TableBody>
          {/* Use a dummy row to fix the column widths */}
          <TableRow style={{ height: 0 }}>
            <TableCell
              padding="none"
              style={{ width: `${100 * splitFraction}%`, borderRight: "none" }}
            />
            <TableCell padding="none" style={{ borderLeft: "none" }} />
          </TableRow>
          <TableRow className={classes.tableHeaderRow}>
            <TableCell variant="head" data-testid="DiagnosticTable-display-name" colSpan={2}>
              <Tooltip
                arrow
                title={
                  <>
                    <Typography variant="body2">
                      Hardware ID: <code>{info.status.hardware_id}</code>
                    </Typography>
                    <Typography variant="body2">
                      Name: <code>{info.status.name}</code>
                    </Typography>
                  </>
                }
              >
                <Typography
                  color={MESSAGE_COLORS[info.status.level]}
                  variant="subtitle1"
                  fontWeight={800}
                >
                  {info.displayName}
                </Typography>
              </Tooltip>
            </TableCell>
          </TableRow>
          <TableRow hover>
            <TableCell colSpan={2} padding="checkbox">
              <Stack
                direction="row"
                flex="auto"
                alignItems="center"
                justifyContent="space-between"
                gap={1}
              >
                <Typography
                  flex="auto"
                  color={MESSAGE_COLORS[info.status.level]}
                  variant="inherit"
                  fontWeight={800}
                >
                  {info.status.message}
                </Typography>
                <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
                  <IconButton
                    className={classes.iconButton}
                    title="Open in State Transitions panel"
                    size="small"
                    onClick={() => {
                      openSiblingStateTransitionsPanel(
                        openSiblingPanel,
                        `${topicToRender}.status[:]{hardware_id=="${info.status.hardware_id}"}{name=="${info.status.name}"}.message`,
                      );
                    }}
                  >
                    <PowerInputIcon fontSize="inherit" />
                  </IconButton>
                </Stack>
              </Stack>
            </TableCell>
          </TableRow>
          {renderKeyValueSections()}
        </TableBody>
      </Table>
    </div>
  );
}
