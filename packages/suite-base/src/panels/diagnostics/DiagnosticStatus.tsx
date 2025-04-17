// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
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
import { createSelector } from "reselect";
import sanitizeHtml from "sanitize-html";

import Stack from "@lichtblick/suite-base/components/Stack";
import { openSiblingPlotPanel } from "@lichtblick/suite-base/panels/Plot/utils/openSiblingPlotPanel";
import { openSiblingStateTransitionsPanel } from "@lichtblick/suite-base/panels/StateTransitions/openSiblingStateTransitionsPanel";
import { useStyles } from "@lichtblick/suite-base/panels/diagnostics/DiagnosticsStatus.style";
import { MESSAGE_COLORS } from "@lichtblick/suite-base/panels/diagnostics/constants";
import {
  DiagnosticInfo,
  DiagnosticStatusMessage,
  KeyValue,
} from "@lichtblick/suite-base/panels/diagnostics/types";
import { OpenSiblingPanel } from "@lichtblick/suite-base/types/panels";

const MIN_SPLIT_FRACTION = 0.1;

type DiagnosticStatusProps = {
  info: DiagnosticInfo;
  numericPrecision: number | undefined;
  onChangeSplitFraction: (arg0: number) => void;
  openSiblingPanel: OpenSiblingPanel;
  splitFraction: number | undefined;
  topicToRender: string;
};

type FormattedKeyValue = {
  key: string;
  keyHtml: { __html: string } | undefined;
  value: string;
  valueHtml: { __html: string } | undefined;
};

const allowedTags = [
  "b",
  "br",
  "center",
  "code",
  "em",
  "font",
  "i",
  "strong",
  "table",
  "td",
  "th",
  "tr",
  "tt",
  "u",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
];

function sanitize(value: string): { __html: string } {
  return {
    __html: sanitizeHtml(value, {
      allowedTags,
      allowedAttributes: {
        font: ["color", "size"],
        td: ["colspan"],
        th: ["colspan"],
      },
    }),
  };
}

// preliminary check to avoid expensive operations when there is no html
const HAS_ANY_HTML = new RegExp(`<(${allowedTags.join("|")})`);

const getFormattedKeyValues = createSelector(
  (message: DiagnosticStatusMessage) => message,
  (message: DiagnosticStatusMessage): FormattedKeyValue[] => {
    return message.values.map(({ key, value }: KeyValue) => {
      return {
        key,
        keyHtml: HAS_ANY_HTML.test(key) ? sanitize(key) : undefined,
        value,
        valueHtml: HAS_ANY_HTML.test(value) ? sanitize(value) : undefined,
      };
    });
  },
);

// component to display a single diagnostic status
export default function DiagnosticStatus(props: DiagnosticStatusProps): React.JSX.Element {
  const {
    onChangeSplitFraction,
    info,
    topicToRender,
    numericPrecision,
    openSiblingPanel,
    splitFraction = 0.5,
  } = props;
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
        <>
          <TableCell padding="checkbox">
            <Stack
              direction="row"
              gap={1}
              alignItems="center"
              flex="auto"
              justifyContent="space-between"
            >
              {strToRender ? strToRender : "\xa0"}
              {openPlotPanelIconElem}
            </Stack>
          </TableCell>
        </>
      );
    },
    [classes.htmlTableCell, numericPrecision],
  );

  const renderKeyValueSections = useCallback((): React.ReactNode => {
    const formattedKeyVals: FormattedKeyValue[] = getFormattedKeyValues(info.status);

    return formattedKeyVals.map(({ key, value, keyHtml, valueHtml }, idx) => {
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
            data-testid="open-plot-icon"
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
            onClick={() => {
              openSiblingStateTransitionsPanel(openSiblingPanel, valuePath);
            }}
          >
            <PowerInputIcon fontSize="inherit" />
          </IconButton>
        );
      }
      return (
        <TableRow key={idx} hover>
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
        data-testid-resizehandle
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
            <TableCell variant="head" data-testid="DiagnosticStatus-display-name" colSpan={2}>
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

// Returns true if the input string can be parsed as a float or an integer using
// parseFloat(). Hex and octal numbers will return false.
function isFloatOrInteger(n: string): boolean {
  if (n.startsWith("0") && n.length > 1) {
    if (n[1] === "x" || n[1] === "X" || n[1] === "o" || n[1] === "O") {
      return false;
    }
  }
  return !isNaN(parseFloat(n)) && isFinite(Number(n));
}
