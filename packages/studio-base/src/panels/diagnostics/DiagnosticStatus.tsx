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
  styled as muiStyled,
} from "@mui/material";
import { clamp } from "lodash";
import { ReactElement, useCallback, useEffect, useRef, useState } from "react";
import { createSelector } from "reselect";
import sanitizeHtml from "sanitize-html";

import Stack from "@foxglove/studio-base/components/Stack";
import { openSiblingPlotPanel } from "@foxglove/studio-base/panels/Plot";
import { openSiblingStateTransitionsPanel } from "@foxglove/studio-base/panels/StateTransitions";
import { OpenSiblingPanel } from "@foxglove/studio-base/types/panels";

import { DiagnosticInfo, KeyValue, DiagnosticStatusMessage, LEVELS } from "./util";

const MIN_SPLIT_FRACTION = 0.1;

type Props = {
  info: DiagnosticInfo;
  splitFraction: number | undefined;
  onChangeSplitFraction: (arg0: number) => void;
  topicToRender: string;
  openSiblingPanel: OpenSiblingPanel;
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

const ResizeHandle = muiStyled("div", {
  shouldForwardProp: (prop) => prop !== "splitFraction",
})<{ splitFraction: number }>(({ theme, splitFraction }) => ({
  position: "absolute",
  top: 0,
  bottom: 0,
  width: 12,
  marginLeft: -6,
  cursor: "col-resize",
  left: `${100 * splitFraction}%`,

  "&:hover, &:active, &:focus": {
    outline: "none",

    "&::after": {
      content: '""',
      position: "absolute",
      top: 0,
      bottom: 0,
      left: 6,
      marginLeft: -2,
      width: 4,
      backgroundColor: theme.palette.action.focus,
    },
  },
}));

const StyledTable = muiStyled(Table)({
  "@media (pointer: fine)": {
    ".MuiTableRow-root .MuiIconButton-root": { visibility: "hidden" },
    ".MuiTableRow-root:hover .MuiIconButton-root": { visibility: "visible" },
  },
});

const HeaderTableRow = muiStyled(TableRow)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
}));

const HTMLTableCell = muiStyled(TableCell)(({ theme }) => ({
  "h1, h2, h3, h4, h5, h6": {
    ...theme.typography.subtitle2,
    fontWeight: 800,
    margin: 0,
  },
}));

const StyledIconButton = muiStyled(IconButton)({
  "&:hover, &:active, &:focus": {
    backgroundColor: "transparent",
  },
});

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
export default function DiagnosticStatus(props: Props): JSX.Element {
  const {
    onChangeSplitFraction,
    info,
    topicToRender,
    openSiblingPanel,
    splitFraction = 0.5,
  } = props;
  const tableRef = useRef<HTMLTableElement>(ReactNull);

  const resizeMouseDown = useCallback((event: React.MouseEvent<Element>) => {
    setResizing(true);
    event.preventDefault();
  }, []);
  const resizeMouseUp = useCallback(() => setResizing(false), []);
  const resizeMouseMove = useCallback(
    (event: MouseEvent) => {
      if (!tableRef.current) {
        return;
      }

      const { left, right } = tableRef.current.getBoundingClientRect();
      const newSplitFraction = clamp(
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
        return <HTMLTableCell dangerouslySetInnerHTML={html} />;
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
              {str ? str : "\xa0"}
              {openPlotPanelIconElem}
            </Stack>
          </TableCell>
        </>
      );
    },
    [],
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
          <StyledIconButton
            title="Open in Plot panel"
            color="inherit"
            size="small"
            data-testid="open-plot-icon"
            onClick={() => openSiblingPlotPanel(openSiblingPanel, valuePath)}
          >
            <ShowChartIcon fontSize="inherit" />
          </StyledIconButton>
        ) : (
          <StyledIconButton
            title="Open in State Transitions panel"
            color="inherit"
            size="small"
            onClick={() => openSiblingStateTransitionsPanel(openSiblingPanel, valuePath)}
          >
            <PowerInputIcon fontSize="inherit" />
          </StyledIconButton>
        );
      }
      return (
        <TableRow key={idx} hover>
          {renderKeyValueCell(keyHtml, key)}
          {renderKeyValueCell(valueHtml, value, openPlotPanelIconElem)}
        </TableRow>
      );
    });
  }, [info.status, openSiblingPanel, renderKeyValueCell, topicToRender]);

  const STATUS_COLORS: Record<number, string> = {
    [LEVELS.OK]: "success.main",
    [LEVELS.ERROR]: "error.main",
    [LEVELS.WARN]: "warning.main",
    [LEVELS.STALE]: "info.main",
  };

  return (
    <div>
      <ResizeHandle
        splitFraction={splitFraction}
        onMouseDown={resizeMouseDown}
        data-testid-resizehandle
      />
      <StyledTable size="small" ref={tableRef}>
        <TableBody>
          {/* Use a dummy row to fix the column widths */}
          <TableRow style={{ height: 0 }}>
            <TableCell
              padding="none"
              style={{ width: `${100 * splitFraction}%`, borderRight: "none" }}
            />
            <TableCell padding="none" style={{ borderLeft: "none" }} />
          </TableRow>
          <HeaderTableRow>
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
                  color={STATUS_COLORS[info.status.level]}
                  variant="subtitle1"
                  fontWeight={800}
                >
                  {info.displayName}
                </Typography>
              </Tooltip>
            </TableCell>
          </HeaderTableRow>
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
                  color={STATUS_COLORS[info.status.level]}
                  variant="inherit"
                  fontWeight={800}
                >
                  {info.status.message}
                </Typography>
                <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
                  <StyledIconButton
                    title="Open in State Transitions panel"
                    size="small"
                    onClick={() =>
                      openSiblingStateTransitionsPanel(
                        openSiblingPanel,
                        `${topicToRender}.status[:]{hardware_id=="${info.status.hardware_id}"}{name=="${info.status.name}"}.message`,
                      )
                    }
                  >
                    <PowerInputIcon fontSize="inherit" />
                  </StyledIconButton>
                </Stack>
              </Stack>
            </TableCell>
          </TableRow>
          {renderKeyValueSections()}
        </TableBody>
      </StyledTable>
    </div>
  );
}
