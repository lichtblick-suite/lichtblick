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

import { makeStyles, useTheme } from "@fluentui/react";
import ChartLineVariantIcon from "@mdi/svg/svg/chart-line-variant.svg";
import DotsHorizontalIcon from "@mdi/svg/svg/dots-horizontal.svg";
import ChevronDownIcon from "@mdi/svg/svg/unfold-less-horizontal.svg";
import ChevronUpIcon from "@mdi/svg/svg/unfold-more-horizontal.svg";
import cx from "classnames";
import { clamp } from "lodash";
import { ReactElement, useCallback, useEffect, useRef, useState } from "react";
import { createSelector } from "reselect";
import sanitizeHtml from "sanitize-html";

import Flex from "@foxglove/studio-base/components/Flex";
import Icon from "@foxglove/studio-base/components/Icon";
import Tooltip from "@foxglove/studio-base/components/Tooltip";
import { openSiblingPlotPanel } from "@foxglove/studio-base/panels/Plot";
import { openSiblingStateTransitionsPanel } from "@foxglove/studio-base/panels/StateTransitions";
import { Config } from "@foxglove/studio-base/panels/diagnostics/DiagnosticStatusPanel";
import { OpenSiblingPanel } from "@foxglove/studio-base/types/panels";
import { colors } from "@foxglove/studio-base/util/sharedStyleConstants";

import { LEVEL_NAMES, DiagnosticInfo, KeyValue, DiagnosticStatusMessage } from "./util";

const MIN_SPLIT_FRACTION = 0.1;

type Props = {
  info: DiagnosticInfo;
  splitFraction: number | undefined;
  onChangeSplitFraction: (arg0: number) => void;
  topicToRender: string;
  openSiblingPanel: OpenSiblingPanel;
  collapsedSections: { name: string; section: string }[];
  saveConfig: (arg0: Partial<Config>) => void;
};

const useStyles = makeStyles((theme) => ({
  table: {
    tableLayout: "fixed",
    width: "100%",
    lineHeight: "1.3em",
    whiteSpace: "pre-line",
    overflowWrap: "break-word",
    textAlign: "left",
    border: "none",

    td: {
      border: "none",
      padding: "1px 3px",
    },
    "td, th": {
      lineHeight: "1.3em",
    },
  },
  name: {
    fontWeight: "bold",
  },
  sectionHeader: {
    color: colors.HIGHLIGHT,
    textAlign: "center !important",
    fontSize: "1.2em",
    padding: 4,
    cursor: "pointer",
    border: "none",
  },

  // Status classes
  ok: { color: `${theme.semanticColors.successIcon} !important` },
  warn: { color: `${theme.semanticColors.warningBackground} !important` },
  error: { color: `${theme.semanticColors.errorBackground} !important` },
  stale: { color: `${theme.semanticColors.infoIcon} !important` },
  unknown: { color: `${theme.semanticColors.errorBackground} !important` },

  collapsedSection: {
    textAlign: "center",
    color: theme.semanticColors.errorBackground,
  },
  interactiveRow: {
    cursor: "pointer",

    ":nth-child(odd)": {
      backgroundColor: theme.palette.neutralLighterAlt,
    },
    ":hover": {
      backgroundColor: theme.palette.neutralLighter,

      ".icon": {
        visibility: "visible",
      },
    },
  },
  icon: {
    color: theme.palette.themePrimary,
    marginLeft: 4,
    visibility: "hidden",

    "> svg": {
      verticalAlign: -2,
    },
  },
  resizeHandle: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 12,
    marginLeft: -6,
    cursor: "col-resize",

    ":hover, :active, :focus": {
      outline: "none",

      "::after": {
        content: '""',
        position: "absolute",
        top: 0,
        bottom: 0,
        left: 6,
        marginLeft: -2,
        width: 4,
        backgroundColor: "rgba(127, 127, 127, 0.4)",
      },
    },
  },
}));

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
export default function DiagnosticStatus(props: Props): JSX.Element {
  const {
    saveConfig,
    collapsedSections,
    onChangeSplitFraction,
    info,
    topicToRender,
    openSiblingPanel,
    splitFraction = 0.5,
  } = props;
  const tableRef = useRef<HTMLTableElement>(ReactNull);
  const classes = useStyles();
  const theme = useTheme();

  const onClickSection = useCallback(
    (sectionObj: { name: string; section: string }): void => {
      const clickedSelectionIsCollapsed = collapsedSections.find(
        ({ name, section }) => name === sectionObj.name && section === sectionObj.section,
      );
      if (clickedSelectionIsCollapsed) {
        saveConfig({
          collapsedSections: collapsedSections.filter(
            ({ name, section }) => name !== sectionObj.name || section !== sectionObj.section,
          ),
        });
      } else {
        saveConfig({ collapsedSections: [...collapsedSections, sectionObj] });
      }
    },
    [collapsedSections, saveConfig],
  );

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
        return <td dangerouslySetInnerHTML={html} />;
      }
      return (
        <td>
          {str ? str : "\xa0"}
          {openPlotPanelIconElem}
        </td>
      );
    },
    [],
  );

  const renderKeyValueSections = useCallback((): React.ReactNode => {
    const formattedKeyVals: FormattedKeyValue[] = getFormattedKeyValues(info.status);
    let inCollapsedSection = false;
    let ellipsisShown = false;
    return formattedKeyVals.map(({ key, value, keyHtml, valueHtml }, idx) => {
      const keyIsSection = value.length === 0 && (key.startsWith("==") || key.startsWith("--"));
      const valIsSection = key.length === 0 && (key.startsWith("==") || value.startsWith("--"));
      if (keyIsSection || valIsSection) {
        const sectionObj = { name: info.status.name, section: `${key}${value}` };
        inCollapsedSection = collapsedSections.some(
          ({ name, section }) => name === sectionObj.name && section === sectionObj.section,
        );
        ellipsisShown = false;
        return (
          <tr key={idx} onClick={() => onClickSection(sectionObj)}>
            <th className={classes.sectionHeader} colSpan={2}>
              {key}
              {value}
            </th>
          </tr>
        );
      } else if (inCollapsedSection) {
        if (ellipsisShown) {
          return ReactNull;
        }
        ellipsisShown = true;
        return (
          <tr key={idx}>
            <td colSpan={2} className={classes.collapsedSection}>
              &hellip;
            </td>
          </tr>
        );
      }
      // We need both `hardware_id` and `name`; one of them is not enough. That's also how we identify
      // what to show in this very panel; see `selectedHardwareId` AND `selectedName` in the config.
      const valuePath = `${topicToRender}.status[:]{hardware_id=="${info.status.hardware_id}"}{name=="${info.status.name}"}.values[:]{key=="${key}"}.value`;
      let openPlotPanelIconElem = undefined;
      if (value.length > 0) {
        openPlotPanelIconElem = !isNaN(Number(value)) ? (
          <Icon
            fade
            dataTest="open-plot-icon"
            className={classes.icon}
            onClick={() => openSiblingPlotPanel(openSiblingPanel, valuePath)}
            tooltip="Line chart"
          >
            <ChartLineVariantIcon />
          </Icon>
        ) : (
          <Icon
            fade
            className={classes.icon}
            onClick={() => openSiblingStateTransitionsPanel(openSiblingPanel, valuePath)}
            tooltip="State Transitions"
          >
            <DotsHorizontalIcon />
          </Icon>
        );
      }
      return (
        <tr className={classes.interactiveRow} key={idx}>
          {renderKeyValueCell(keyHtml, key)}
          {renderKeyValueCell(valueHtml, value, openPlotPanelIconElem)}
        </tr>
      );
    });
  }, [
    classes,
    collapsedSections,
    info.status,
    onClickSection,
    openSiblingPanel,
    renderKeyValueCell,
    topicToRender,
  ]);

  const getSectionsCollapsedForCurrentName = useCallback((): {
    name: string;
    section: string;
  }[] => {
    return collapsedSections.filter(({ name }) => name === info.status.name);
  }, [collapsedSections, info.status.name]);

  const getSectionsThatCanBeCollapsed = useCallback((): FormattedKeyValue[] => {
    const formattedKeyVals = getFormattedKeyValues(info.status);
    return formattedKeyVals.filter(({ key, value }) => {
      const keyIsSection = value.length === 0 && (key.startsWith("==") || key.startsWith("--"));
      const valIsSection = key.length === 0 && (value.startsWith("==") || value.startsWith("--"));
      return keyIsSection || valIsSection;
    });
  }, [info.status]);

  const toggleSections = useCallback((): void => {
    const newSectionsForCurrentName =
      getSectionsCollapsedForCurrentName().length > 0
        ? []
        : getSectionsThatCanBeCollapsed().map(({ key, value }) => ({
            name: info.status.name,
            section: `${key}${value}`,
          }));
    const otherSections = collapsedSections.filter(({ name }) => name !== info.status.name);
    saveConfig({ collapsedSections: newSectionsForCurrentName.concat(otherSections) });
  }, [
    collapsedSections,
    getSectionsCollapsedForCurrentName,
    getSectionsThatCanBeCollapsed,
    info.status.name,
    saveConfig,
  ]);

  const statusClass = cx({
    [classes.ok]: LEVEL_NAMES[info.status.level] === "ok",
    [classes.error]: LEVEL_NAMES[info.status.level] === "error",
    [classes.warn]: LEVEL_NAMES[info.status.level] === "warn",
    [classes.stale]: LEVEL_NAMES[info.status.level] === "stale",
    [classes.unknown]: LEVEL_NAMES[info.status.level] === "unknown",
  });

  return (
    <div>
      <div
        className={classes.resizeHandle}
        style={{ left: `${100 * splitFraction}%` }}
        onMouseDown={resizeMouseDown}
        data-test-resizehandle
      />
      <table className={classes.table} ref={tableRef}>
        <tbody>
          {/* Use a dummy row to fix the column widths */}
          <tr style={{ height: 0 }}>
            <td style={{ padding: 0, width: `${100 * splitFraction}%`, borderRight: "none" }} />
            <td style={{ padding: 0, borderLeft: "none" }} />
          </tr>
          <tr>
            <th
              className={cx(classes.sectionHeader, statusClass)}
              data-test="DiagnosticStatus-display-name"
              colSpan={2}
            >
              <Tooltip
                placement="bottom"
                contents={
                  <div>
                    Hardware ID: <code>{info.status.hardware_id}</code>
                    <br />
                    Name: <code>{info.status.name}</code>
                  </div>
                }
              >
                <span>{info.displayName}</span>
              </Tooltip>
            </th>
          </tr>
          <tr className={cx(classes.interactiveRow, statusClass)}>
            <td colSpan={2}>
              <Flex style={{ justifyContent: "space-between" }}>
                <div>
                  {info.status.message}{" "}
                  <Icon
                    fade
                    className={classes.icon}
                    onClick={() =>
                      openSiblingStateTransitionsPanel(
                        openSiblingPanel,
                        `${topicToRender}.status[:]{hardware_id=="${info.status.hardware_id}"}{name=="${info.status.name}"}.message`,
                      )
                    }
                    tooltip="State Transitions"
                  >
                    <DotsHorizontalIcon />
                  </Icon>
                </div>
                {getSectionsThatCanBeCollapsed().length > 0 && (
                  <div
                    style={{ color: theme.semanticColors.bodyText, cursor: "pointer" }}
                    onClick={toggleSections}
                  >
                    <Icon
                      size="medium"
                      fade
                      style={{ padding: 4 }}
                      tooltip={
                        getSectionsCollapsedForCurrentName().length > 0
                          ? "Expand all"
                          : "Collapse all"
                      }
                    >
                      {getSectionsCollapsedForCurrentName().length > 0 ? (
                        <ChevronUpIcon />
                      ) : (
                        <ChevronDownIcon />
                      )}
                    </Icon>
                  </div>
                )}
              </Flex>
            </td>
          </tr>
          {renderKeyValueSections()}
        </tbody>
      </table>
    </div>
  );
}
