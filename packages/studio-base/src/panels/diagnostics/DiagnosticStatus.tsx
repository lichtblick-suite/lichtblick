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

import { mergeStyleSets } from "@fluentui/merge-styles";
import ChartLineVariantIcon from "@mdi/svg/svg/chart-line-variant.svg";
import DotsHorizontalIcon from "@mdi/svg/svg/dots-horizontal.svg";
import ChevronDownIcon from "@mdi/svg/svg/unfold-less-horizontal.svg";
import ChevronUpIcon from "@mdi/svg/svg/unfold-more-horizontal.svg";
import cx from "classnames";
import { clamp } from "lodash";
import { ReactElement } from "react";
import { createSelector } from "reselect";
import sanitizeHtml from "sanitize-html";

import Flex from "@foxglove/studio-base/components/Flex";
import Icon from "@foxglove/studio-base/components/Icon";
import Tooltip from "@foxglove/studio-base/components/Tooltip";
import { openSiblingPlotPanel } from "@foxglove/studio-base/panels/Plot";
import { openSiblingStateTransitionsPanel } from "@foxglove/studio-base/panels/StateTransitions";
import { Config } from "@foxglove/studio-base/panels/diagnostics/DiagnosticStatusPanel";
import { PanelConfig } from "@foxglove/studio-base/types/panels";
import { colors } from "@foxglove/studio-base/util/sharedStyleConstants";

import { LEVEL_NAMES, DiagnosticInfo, KeyValue, DiagnosticStatusMessage } from "./util";

const MIN_SPLIT_FRACTION = 0.1;

type Props = {
  info: DiagnosticInfo;
  splitFraction: number;
  onChangeSplitFraction: (arg0: number) => void;
  topicToRender: string;
  openSiblingPanel: (type: string, cb: (arg0: PanelConfig) => PanelConfig) => void;
  collapsedSections: { name: string; section: string }[];
  saveConfig: (arg0: Partial<Config>) => void;
};

const classes = mergeStyleSets({
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
  ok: { color: `${colors.GREEN2} !important` },
  warn: { color: `${colors.ORANGE2} !important` },
  error: { color: `${colors.RED2} !important` },
  stale: { color: `${colors.GRAY2} !important` },
  unknown: { color: `${colors.RED2} !important` },

  collapsedSection: {
    textAlign: "center",
    color: colors.RED2,
  },
  interactiveRow: {
    cursor: "pointer",

    ":nth-child(odd)": {
      backgroundColor: colors.DARK3,
    },
    ":hover": {
      backgroundColor: colors.DARK4,

      ".icon": {
        visibility: "visible",
      },
    },
  },
  icon: {
    color: "white",
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
        backgroundColor: colors.DIVIDER,
      },
    },
  },
});

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
class DiagnosticStatus extends React.Component<Props, unknown> {
  private _tableRef = React.createRef<HTMLTableElement>();

  static defaultProps = {
    splitFraction: 0.5,
  };

  private _onClickSection(sectionObj: { name: string; section: string }): void {
    const { collapsedSections, saveConfig } = this.props;
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
  }

  private _resizeMouseDown = (event: React.MouseEvent<Element>): void => {
    event.preventDefault();
    window.addEventListener("mousemove", this._resizeMouseMove);
    window.addEventListener("mouseup", this._resizeMouseUp);
  };

  private _resizeMouseUp = (): void => {
    window.removeEventListener("mousemove", this._resizeMouseMove);
  };

  private _resizeMouseMove = (event: MouseEvent): void => {
    const {
      _tableRef,
      props: { onChangeSplitFraction },
    } = this;

    if (!_tableRef.current) {
      return;
    }

    const { left, right } = _tableRef.current.getBoundingClientRect();
    const splitFraction = clamp(
      (event.clientX - left) / (right - left),
      MIN_SPLIT_FRACTION,
      1 - MIN_SPLIT_FRACTION,
    );
    onChangeSplitFraction(splitFraction);
  };

  override componentWillUnmount(): void {
    window.removeEventListener("mousemove", this._resizeMouseMove);
    window.removeEventListener("mouseup", this._resizeMouseUp);
  }

  private _renderKeyValueCell(
    html: { __html: string } | undefined,
    str: string,
    openPlotPanelIconElem?: React.ReactNode,
  ): ReactElement {
    if (html) {
      return <td dangerouslySetInnerHTML={html} />;
    }
    return (
      <td>
        {str ? str : "\xa0"}
        {openPlotPanelIconElem}
      </td>
    );
  }

  private _renderKeyValueSections = (): React.ReactNode => {
    const { info, topicToRender, openSiblingPanel, collapsedSections } = this.props;
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
          <tr key={idx} onClick={() => this._onClickSection(sectionObj)}>
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
          {this._renderKeyValueCell(keyHtml, key)}
          {this._renderKeyValueCell(valueHtml, value, openPlotPanelIconElem)}
        </tr>
      );
    });
  };

  private _getSectionsCollapsedForCurrentName = (): { name: string; section: string }[] => {
    const { collapsedSections, info } = this.props;
    return collapsedSections.filter(({ name }) => name === info.status.name);
  };

  private _getSectionsThatCanBeCollapsed = (): FormattedKeyValue[] => {
    const { info } = this.props;
    const formattedKeyVals = getFormattedKeyValues(info.status);
    return formattedKeyVals.filter(({ key, value }) => {
      const keyIsSection = value.length === 0 && (key.startsWith("==") || key.startsWith("--"));
      const valIsSection = key.length === 0 && (value.startsWith("==") || value.startsWith("--"));
      return keyIsSection || valIsSection;
    });
  };

  private _toggleSections = (): void => {
    const { saveConfig, collapsedSections, info } = this.props;
    const newSectionsForCurrentName =
      this._getSectionsCollapsedForCurrentName().length > 0
        ? []
        : this._getSectionsThatCanBeCollapsed().map(({ key, value }) => ({
            name: info.status.name,
            section: `${key}${value}`,
          }));
    const otherSections = collapsedSections.filter(({ name }) => name !== info.status.name);
    saveConfig({ collapsedSections: newSectionsForCurrentName.concat(otherSections) });
  };

  override render(): JSX.Element {
    const {
      info: { status, displayName },
      splitFraction,
      openSiblingPanel,
      topicToRender,
    } = this.props;
    const statusClass = cx({
      [classes.ok]: LEVEL_NAMES[status.level] === "ok",
      [classes.error]: LEVEL_NAMES[status.level] === "error",
      [classes.warn]: LEVEL_NAMES[status.level] === "warn",
      [classes.stale]: LEVEL_NAMES[status.level] === "stale",
      [classes.unknown]: LEVEL_NAMES[status.level] === "unknown",
    });

    return (
      <div>
        <div
          className={classes.resizeHandle}
          style={{ left: `${100 * splitFraction}%` }}
          onMouseDown={this._resizeMouseDown}
          data-test-resizehandle
        />
        <table className={classes.table} ref={this._tableRef}>
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
                      Hardware ID: <code>{status.hardware_id}</code>
                      <br />
                      Name: <code>{status.name}</code>
                    </div>
                  }
                >
                  <span>{displayName}</span>
                </Tooltip>
              </th>
            </tr>
            <tr className={cx(classes.interactiveRow, statusClass)}>
              <td colSpan={2}>
                <Flex style={{ justifyContent: "space-between" }}>
                  <div>
                    {status.message}{" "}
                    <Icon
                      fade
                      className={classes.icon}
                      onClick={() =>
                        openSiblingStateTransitionsPanel(
                          openSiblingPanel,
                          `${topicToRender}.status[:]{hardware_id=="${status.hardware_id}"}{name=="${status.name}"}.message`,
                        )
                      }
                      tooltip="State Transitions"
                    >
                      <DotsHorizontalIcon />
                    </Icon>
                  </div>
                  {this._getSectionsThatCanBeCollapsed().length > 0 && (
                    <div
                      style={{ color: "white", cursor: "pointer" }}
                      onClick={this._toggleSections}
                    >
                      <Icon
                        size="medium"
                        fade
                        style={{ padding: 4 }}
                        tooltip={
                          this._getSectionsCollapsedForCurrentName().length > 0
                            ? "Expand all"
                            : "Collapse all"
                        }
                      >
                        {this._getSectionsCollapsedForCurrentName().length > 0 ? (
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
            {this._renderKeyValueSections()}
          </tbody>
        </table>
      </div>
    );
  }
}

export default DiagnosticStatus;
