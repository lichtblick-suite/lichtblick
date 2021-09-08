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

import ChartLineVariantIcon from "@mdi/svg/svg/chart-line-variant.svg";
import DotsHorizontalIcon from "@mdi/svg/svg/dots-horizontal.svg";
import ChevronDownIcon from "@mdi/svg/svg/unfold-less-horizontal.svg";
import ChevronUpIcon from "@mdi/svg/svg/unfold-more-horizontal.svg";
import cx from "classnames";
import { clamp } from "lodash";
import { ReactElement } from "react";
import { createSelector } from "reselect";
import sanitizeHtml from "sanitize-html";
import styled from "styled-components";

import Flex from "@foxglove/studio-base/components/Flex";
import Icon from "@foxglove/studio-base/components/Icon";
import { LegacyTable } from "@foxglove/studio-base/components/LegacyStyledComponents";
import Tooltip from "@foxglove/studio-base/components/Tooltip";
import { openSiblingPlotPanel } from "@foxglove/studio-base/panels/Plot";
import { openSiblingStateTransitionsPanel } from "@foxglove/studio-base/panels/StateTransitions";
import { Config } from "@foxglove/studio-base/panels/diagnostics/DiagnosticStatusPanel";
import { PanelConfig } from "@foxglove/studio-base/types/panels";
import { colors } from "@foxglove/studio-base/util/sharedStyleConstants";

import style from "./DiagnosticStatus.module.scss";
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

const ResizeHandle = styled.div.attrs<{ splitFraction: number }>(({ splitFraction }) => ({
  style: { left: `${100 * splitFraction}%` },
}))<{ splitFraction: number }>`
  position: absolute;
  top: 0;
  bottom: 0;
  width: 12px;
  margin-left: -6px;
  cursor: col-resize;
  :hover,
  :active,
  :focus {
    outline: none;
    ::after {
      content: "";
      position: absolute;
      top: 0;
      bottom: 0;
      left: 6px;
      margin-left: -2px;
      width: 4px;
      background-color: ${colors.DIVIDER};
    }
  }
`;

const KeyValueTable = styled(LegacyTable)`
  table-layout: fixed;
  width: 100%;
  line-height: 1.3em;
  white-space: pre-line;
  overflow-wrap: break-word;
  text-align: left;
  tr:nth-child(odd) {
    background-color: #222;
  }
  td {
    border: none;
    padding: 1px 3px;
  }
  /* nested table styles */
  table {
    th {
      font-weight: bold;
    }
  }
`;

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
  _tableRef = React.createRef<HTMLTableElement>();

  static defaultProps = {
    splitFraction: 0.5,
  };

  _onClickSection(sectionObj: { name: string; section: string }): void {
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

  _resizeMouseDown = (event: React.MouseEvent<Element>): void => {
    event.preventDefault();
    window.addEventListener("mousemove", this._resizeMouseMove);
    window.addEventListener("mouseup", this._resizeMouseUp);
  };

  _resizeMouseUp = (): void => {
    window.removeEventListener("mousemove", this._resizeMouseMove);
  };

  _resizeMouseMove = (event: MouseEvent): void => {
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

  _renderKeyValueCell(
    _cls: string,
    html: { __html: string } | undefined,
    str: string,
    openPlotPanelIconElem?: React.ReactNode,
  ): ReactElement {
    if (html) {
      return <td className={style.valueCell} dangerouslySetInnerHTML={html} />;
    }
    return (
      <td className={style.valueCell}>
        {str ? str : "\xa0"}
        {openPlotPanelIconElem}
      </td>
    );
  }

  _renderKeyValueSections = (): React.ReactNode => {
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
          <tr key={idx} className={style.section} onClick={() => this._onClickSection(sectionObj)}>
            <th colSpan={2}>
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
            <td colSpan={2} className={style.collapsedSection}>
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
            className={style.plotIcon}
            onClick={() => openSiblingPlotPanel(openSiblingPanel, valuePath)}
            tooltip="Line chart"
          >
            <ChartLineVariantIcon />
          </Icon>
        ) : (
          <Icon
            fade
            className={style.stateTransitionsIcon}
            onClick={() => openSiblingStateTransitionsPanel(openSiblingPanel, valuePath)}
            tooltip="State Transitions"
          >
            <DotsHorizontalIcon />
          </Icon>
        );
      }
      return (
        <tr key={idx} className={style.row}>
          {this._renderKeyValueCell(style.keyCell as string, keyHtml, key)}
          {this._renderKeyValueCell(
            style.valueCell as string,
            valueHtml,
            value,
            openPlotPanelIconElem,
          )}
        </tr>
      );
    });
  };

  _getSectionsCollapsedForCurrentName = (): { name: string; section: string }[] => {
    const { collapsedSections, info } = this.props;
    return collapsedSections.filter(({ name }) => name === info.status.name);
  };

  _getSectionsThatCanBeCollapsed = (): FormattedKeyValue[] => {
    const { info } = this.props;
    const formattedKeyVals = getFormattedKeyValues(info.status);
    return formattedKeyVals.filter(({ key, value }) => {
      const keyIsSection = value.length === 0 && (key.startsWith("==") || key.startsWith("--"));
      const valIsSection = key.length === 0 && (value.startsWith("==") || value.startsWith("--"));
      return keyIsSection || valIsSection;
    });
  };

  _toggleSections = (): void => {
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
    const statusClass = style[`status-${LEVEL_NAMES[status.level] ?? "unknown"}`];

    return (
      <div>
        <ResizeHandle
          data-test-resizehandle
          splitFraction={splitFraction}
          onMouseDown={this._resizeMouseDown}
        />
        <KeyValueTable ref={this._tableRef}>
          <tbody>
            {/* Use a dummy row to fix the column widths */}
            <tr style={{ height: 0 }}>
              <td style={{ padding: 0, width: `${100 * splitFraction}%`, borderRight: "none" }} />
              <td style={{ padding: 0, borderLeft: "none" }} />
            </tr>
            <tr className={cx(style.section, statusClass)}>
              <th data-test="DiagnosticStatus-display-name" colSpan={2}>
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
            <tr className={cx(style.row, statusClass)}>
              <td colSpan={2}>
                <Flex style={{ justifyContent: "space-between" }}>
                  <div>
                    {status.message}{" "}
                    <Icon
                      fade
                      className={style.stateTransitionsIcon}
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
        </KeyValueTable>
      </div>
    );
  }
}

export default DiagnosticStatus;
