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

import CloseIcon from "@mui/icons-material/Close";
import { IconButton, InputBase } from "@mui/material";
import React, { Ref as ReactRef, useCallback, useEffect, useMemo, useRef, useState } from "react";
import textMetrics from "text-metrics";
import { makeStyles } from "tss-react/mui";

import { PANEL_TOOLBAR_MIN_HEIGHT } from "@foxglove/studio-base/components/PanelToolbar";
import { TabActions } from "@foxglove/studio-base/panels/Tab/TabDndContext";
import { fontSansSerif } from "@foxglove/theme";

const MAX_TAB_WIDTH = 120;
const MIN_ACTIVE_TAB_WIDTH = 40;
const MIN_OTHER_TAB_WIDTH = 14;

const useStyles = makeStyles<void, "active">()((theme, _params, classes) => ({
  root: {
    cursor: "pointer",
    color: theme.palette.text.secondary,
    fontSize: theme.typography.body2.fontSize,
    fontWeight: theme.typography.body2.fontWeight,
    position: "relative",
    display: "flex",
    alignItems: "center",
    width: "100%",
    height: PANEL_TOOLBAR_MIN_HEIGHT,
    padding: theme.spacing(0, 1),
    userSelect: "none",
    backgroundColor: "transparent",
    maxWidth: MAX_TAB_WIDTH,
    gap: theme.spacing(0.5),
    top: 1,

    [`:not(.${classes.active}):hover`]: {
      color: theme.palette.text.primary,
    },
  },
  active: {
    color: theme.palette.text.primary,
    fontWeight: theme.typography.subtitle2.fontWeight,
    backgroundColor: theme.palette.background.paper,
    userSelect: "all",
    zIndex: 1,
    boxShadow: theme.shadows[2],
  },
  dragging: {
    backgroundColor: theme.palette.background.paper,
    borderColor: theme.palette.action.selected,
  },
  hidden: {
    visibility: "hidden",
  },
  input: {
    font: "inherit",
    color: "inherit",
  },
  dropIndicator: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 2,
    height: "100%",
    backgroundColor: theme.palette.primary.main,
    opacity: 0.8,
    borderRadius: theme.shape.borderRadius,
    zIndex: 1,
  },
  iconButton: {
    padding: theme.spacing(0.125),
    color: theme.palette.text.secondary,

    ":hover": {
      color: theme.palette.text.primary,
    },
  },
}));

const fontFamily = fontSansSerif;
const fontSize = "12px";

let textMeasure: undefined | textMetrics.TextMeasure;

function measureText(text: string): number {
  if (textMeasure == undefined) {
    textMeasure = textMetrics.init({ fontFamily, fontSize });
  }
  return textMeasure.width(text) + 3;
}

type Props = {
  hidden: boolean;
  highlight: "before" | "after" | undefined;
  innerRef?: ReactRef<HTMLDivElement>;
  isActive: boolean;
  isDragging: boolean;
  actions: TabActions;
  tabCount: number;
  tabIndex: number;
  tabTitle?: string;
};

export function ToolbarTab(props: Props): JSX.Element {
  const {
    tabIndex,
    isActive,
    tabCount,
    tabTitle = "",
    isDragging,
    actions,
    innerRef,
    highlight,
    hidden,
  } = props;
  const { classes, cx } = useStyles();
  const inputRef = useRef<HTMLInputElement>(ReactNull);
  const [title, setTitle] = useState<string>(tabTitle);
  const [editingTitle, setEditingTitle] = useState<boolean>(false);
  const onChangeTitleInput = useCallback((ev: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(ev.target.value);
  }, []);

  const { selectTab, removeTab } = useMemo(
    () => ({
      selectTab: () => {
        actions.selectTab(tabIndex);
      },
      removeTab: () => {
        actions.removeTab(tabIndex);
      },
    }),
    [actions, tabIndex],
  );
  const setTabTitle = useCallback(() => {
    actions.setTabTitle(tabIndex, title);
  }, [actions, tabIndex, title]);

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

  return (
    <div
      hidden={hidden}
      onClick={onClickTab}
      ref={innerRef}
      title={tabTitle ? tabTitle : "Enter tab name"}
      data-testid="toolbar-tab"
      className={cx(classes.root, {
        [classes.active]: isActive,
        [classes.dragging]: isDragging,
        [classes.hidden]: hidden,
      })}
      style={{
        minWidth: isActive
          ? `calc(max(${MIN_ACTIVE_TAB_WIDTH}px,  min(${Math.ceil(
              measureText(tabTitle) + 30,
            )}px, ${MAX_TAB_WIDTH}px, 100% - ${MIN_OTHER_TAB_WIDTH * (tabCount - 1)}px)))`
          : undefined,
      }}
    >
      {highlight != undefined && (
        <div
          className={classes.dropIndicator}
          style={{
            left: highlight === "before" ? 0 : "auto",
            right: highlight === "before" ? "auto" : 0,
          }}
        />
      )}
      <InputBase
        className={classes.input}
        readOnly={!editingTitle}
        placeholder="Enter tab name"
        value={title}
        onChange={onChangeTitleInput}
        onBlur={setTabTitle}
        onKeyDown={onKeyDown}
        inputRef={inputRef}
        style={{ pointerEvents: editingTitle ? "all" : "none" }}
      />
      {isActive && (
        <IconButton
          edge="end"
          size="small"
          data-testid="tab-icon"
          title="Remove tab"
          onClick={removeTab}
          className={classes.iconButton}
        >
          <CloseIcon fontSize="inherit" />
        </IconButton>
      )}
    </div>
  );
}
