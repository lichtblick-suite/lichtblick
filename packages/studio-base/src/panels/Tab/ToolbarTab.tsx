// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2019-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import CheckIcon from "@mdi/svg/svg/check.svg";
import CloseIcon from "@mdi/svg/svg/close.svg";
import cx from "classnames";
import React, { Ref as ReactRef, useCallback, useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";
import textMetrics from "text-metrics";

import Icon from "@foxglove/studio-base/components/Icon";
import { LegacyInput } from "@foxglove/studio-base/components/LegacyStyledComponents";
import Tooltip from "@foxglove/studio-base/components/Tooltip";
import { TabActions } from "@foxglove/studio-base/panels/Tab/TabDndContext";
import { colors, fonts } from "@foxglove/studio-base/util/sharedStyleConstants";

import styles from "./Tab.module.scss";

const MAX_TAB_WIDTH = 100;
const MIN_ACTIVE_TAB_WIDTH = 40;
const MIN_OTHER_TAB_WIDTH = 14;

const fontFamily = fonts.SANS_SERIF;
const fontSize = "12px";
let textMeasure: textMetrics.TextMeasure;
function measureText(text: string): number {
  if (textMeasure == undefined) {
    textMeasure = textMetrics.init({ fontFamily, fontSize });
  }
  return textMeasure.width(text) + 3;
}

const STab = styled.div<{
  isDragging: boolean;
  isActive: boolean;
  tabCount: number;
  highlight: boolean;
  value: string;
  hidden: boolean;
}>(({ isActive, value, tabCount, isDragging, hidden, highlight }) => ({
  opacity: hidden ? 0 : 1,
  borderColor: isDragging || highlight ? colors.DARK6 : "transparent",
  boxShadow: isDragging ? `0px 2px 6px rgba(0, 0, 0, 0.2)` : "none",
  backgroundColor: isActive ? colors.DARK4 : isDragging ? colors.DARK2 : "transparent",
  minWidth: isActive
    ? `calc(max(${MIN_ACTIVE_TAB_WIDTH}px,  min(${Math.ceil(
        measureText(value) + 30,
      )}px, ${MAX_TAB_WIDTH}px, 100% - ${MIN_OTHER_TAB_WIDTH * (tabCount - 1)}px)))`
    : undefined,
  maxWidth: `${MAX_TAB_WIDTH}px`,
}));

const SInput = styled(LegacyInput)<{ editable: boolean }>(({ editable }) => ({
  pointerEvents: editable ? "all" : "none",
  width: "100%",
}));
const clearBgStyle = { backgroundColor: "transparent", padding: 0 };

type Props = {
  hidden: boolean;
  highlight: boolean;
  innerRef?: ReactRef<HTMLDivElement>;
  isActive: boolean;
  isDragging: boolean;
  actions: TabActions;
  tabCount: number;
  tabIndex: number;
  tabTitle: string;
};

export function ToolbarTab(props: Props): JSX.Element {
  const {
    tabIndex,
    isActive,
    tabCount,
    tabTitle,
    isDragging,
    actions,
    innerRef,
    highlight,
    hidden,
  } = props;

  const inputRef = useRef<HTMLInputElement>(ReactNull);
  const [title, setTitle] = useState<string>(tabTitle ?? "");
  const [editingTitle, setEditingTitle] = useState<boolean>(false);
  const onChangeTitleInput = useCallback(
    (ev: React.ChangeEvent<HTMLInputElement>) => setTitle(ev.target.value),
    [],
  );

  const { selectTab, removeTab } = useMemo(
    () => ({
      selectTab: () => actions.selectTab(tabIndex),
      removeTab: () => actions.removeTab(tabIndex),
    }),
    [actions, tabIndex],
  );
  const setTabTitle = useCallback(
    () => actions.setTabTitle(tabIndex, title),
    [actions, tabIndex, title],
  );

  const onClickTab = useCallback(() => {
    if (!isActive) {
      selectTab();
    } else {
      setEditingTitle(true);

      setImmediate(() => {
        if (inputRef.current) {
          const inputEl: HTMLInputElement = inputRef.current;
          inputEl.focus();
          inputEl.select();
        }
      });
    }
  }, [isActive, selectTab, inputRef]);

  const endTitleEditing = useCallback(() => {
    setEditingTitle(false);
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }, []);

  const confirmNewTitle = useCallback(() => {
    setTabTitle();
    endTitleEditing();
  }, [endTitleEditing, setTabTitle]);

  const resetTitle = useCallback(() => {
    setTitle(tabTitle);
    endTitleEditing();
  }, [endTitleEditing, tabTitle]);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Escape") {
        resetTitle();
      } else if (event.key === "Enter") {
        confirmNewTitle();
      }
    },
    [confirmNewTitle, resetTitle],
  );

  // If the tab is no longer active, stop editing the title
  useEffect(() => {
    if (!isActive) {
      setEditingTitle(false);
    }
  }, [isActive]);

  // Update the cached title if the tabTitle changes
  useEffect(() => {
    setTitle(tabTitle);
  }, [tabTitle]);

  const tooltip = tabTitle ? tabTitle : "Enter tab name";

  return (
    <STab
      hidden={hidden}
      isDragging={isDragging}
      isActive={isActive}
      highlight={highlight}
      tabCount={tabCount}
      value={tabTitle}
      onClick={onClickTab}
      ref={innerRef}
      className={cx(styles.tab, { [styles.active!]: isActive })}
    >
      <Tooltip contents={editingTitle ? "" : tooltip} placement="top">
        {/* This div has to be here because the <ToolTip> overwrites the ref of its child*/}
        <div>
          <SInput
            readOnly={!editingTitle}
            editable={editingTitle}
            placeholder="Enter tab name"
            style={clearBgStyle}
            value={title}
            onChange={onChangeTitleInput}
            onBlur={setTabTitle}
            onKeyDown={onKeyDown}
            ref={inputRef}
          />
        </div>
      </Tooltip>
      {isActive ? (
        <Icon
          small
          fade
          dataTest="tab-icon"
          tooltip={editingTitle ? "Set new name" : "Remove tab"}
          style={{ width: "22px" }}
          onClick={editingTitle ? confirmNewTitle : removeTab}
        >
          {editingTitle ? (
            <CheckIcon onMouseDown={(e) => e.preventDefault()} />
          ) : (
            <CloseIcon onMouseDown={(e) => e.preventDefault()} />
          )}
        </Icon>
      ) : undefined}
    </STab>
  );
}
