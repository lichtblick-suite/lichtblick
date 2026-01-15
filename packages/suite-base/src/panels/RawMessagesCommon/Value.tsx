// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import ErrorIcon from "@mui/icons-material/Error";
import { Tooltip, useTheme } from "@mui/material";
import { useCallback, useMemo, useState, useRef, useEffect } from "react";
import { withStyles } from "tss-react/mui";

import HoverableIconButton from "@lichtblick/suite-base/components/HoverableIconButton";
import Stack from "@lichtblick/suite-base/components/Stack";
import { openSiblingPlotPanel } from "@lichtblick/suite-base/panels/Plot/utils/openSiblingPlotPanel";
import HighlightedValue from "@lichtblick/suite-base/panels/RawMessagesCommon/HighlightedValue";
import { useStylesValue } from "@lichtblick/suite-base/panels/RawMessagesCommon/index.style";
import { PropsValue, ValueActionItem } from "@lichtblick/suite-base/panels/RawMessagesCommon/types";
import {
  getCopyAction,
  getFilterAction,
  getLineChartAction,
  getScatterPlotAction,
  getStateTransitionsAction,
} from "@lichtblick/suite-base/panels/RawMessagesCommon/utils";
import { TRANSITIONABLE_ROS_TYPES } from "@lichtblick/suite-base/panels/StateTransitions/constants";
import { openSiblingStateTransitionsPanel } from "@lichtblick/suite-base/panels/StateTransitions/openSiblingStateTransitionsPanel";
import { PLOTABLE_ROS_TYPES } from "@lichtblick/suite-base/panels/shared/constants";
import clipboard from "@lichtblick/suite-base/util/clipboard";
import { getValueColor } from "@lichtblick/suite-base/util/globalConstants";

const StyledIconButton = withStyles(HoverableIconButton, (theme) => ({
  root: {
    "&.MuiIconButton-root": {
      fontSize: theme.typography.pxToRem(16),
      opacity: 0.6,
      padding: 0,
    },
  },
}));

const emptyAction: ValueActionItem = {
  key: "",
  tooltip: "",
  icon: <ErrorIcon fontSize="inherit" />,
};

const MAX_ACTION_ITEMS = 4;

function Value(props: PropsValue): React.JSX.Element {
  const timeOutID = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const {
    arrLabel,
    basePath,
    itemLabel,
    itemValue,
    valueAction,
    onTopicPathChange,
    openSiblingPanel,
  } = props;
  const [copied, setCopied] = useState(false);
  const { palette } = useTheme();
  const valueColor = useMemo(
    () => getValueColor(itemValue, palette.mode),
    [itemValue, palette.mode],
  );

  const openPlotPanel = useCallback(
    (pathSuffix: string) => () => {
      openSiblingPlotPanel(openSiblingPanel, `${basePath}${pathSuffix}`);
    },
    [basePath, openSiblingPanel],
  );

  const openStateTransitionsPanel = useCallback(
    (pathSuffix: string) => () => {
      openSiblingStateTransitionsPanel(openSiblingPanel, `${basePath}${pathSuffix}`);
    },
    [basePath, openSiblingPanel],
  );

  const onFilter = useCallback(() => {
    onTopicPathChange(`${basePath}${valueAction?.filterPath}`);
  }, [basePath, valueAction, onTopicPathChange]);

  const handleCopy = useCallback((value: string) => {
    clipboard
      .copy(value)
      .then(() => {
        setCopied(true);
        timeOutID.current = setTimeout(() => {
          setCopied(false);
        }, 1500);
      })
      .catch((e: unknown) => {
        console.warn(e);
      });
  }, []);

  const availableActions = useMemo(() => {
    const actions: ValueActionItem[] = [];

    if (arrLabel.length > 0) {
      actions.push(getCopyAction({ copied }, itemValue, handleCopy));
    }

    if (valueAction == undefined) {
      return actions;
    }

    const isPlotableType = PLOTABLE_ROS_TYPES.includes(valueAction.primitiveType);
    const isTransitionalType = TRANSITIONABLE_ROS_TYPES.includes(valueAction.primitiveType);
    const isMultiSlicePath = valueAction.multiSlicePath === valueAction.singleSlicePath;

    if (valueAction.filterPath.length > 0) {
      actions.push(getFilterAction(onFilter));
    }

    if (isPlotableType) {
      actions.push(getLineChartAction(valueAction.singleSlicePath, openPlotPanel));

      if (!isMultiSlicePath) {
        actions.push(getScatterPlotAction(valueAction.multiSlicePath, openPlotPanel));
      }
    }

    if (isTransitionalType && isMultiSlicePath) {
      actions.push(
        getStateTransitionsAction(valueAction.singleSlicePath, openStateTransitionsPanel),
      );
    }

    return actions;
  }, [
    arrLabel.length,
    copied,
    handleCopy,
    itemValue,
    onFilter,
    openPlotPanel,
    openStateTransitionsPanel,
    valueAction,
  ]);

  // need to keep space to prevent resizing and wrapping on hover
  const placeholderActionsForSpacing = useMemo(() => {
    const actions: ValueActionItem[] = [];
    for (let i = availableActions.length; i < MAX_ACTION_ITEMS; i++) {
      actions.push({ ...emptyAction, key: `empty-${i}` });
    }
    return actions;
  }, [availableActions.length]);
  const { classes, cx } = useStylesValue();

  useEffect(() => {
    return () => {
      if (timeOutID.current != undefined) {
        clearTimeout(timeOutID.current);
      }
    };
  }, []);

  // The Tooltip and StyledIconButton components seem to be expensive to render so we
  // track our hover state and render them conditionally only when this component is
  // hovered.
  const [pointerOver, setPointerOver] = useState(false);

  return (
    <Stack
      inline
      flexWrap="wrap"
      direction="row"
      alignItems="center"
      gap={0.25}
      onPointerEnter={() => {
        setPointerOver(true);
      }}
      onPointerLeave={() => {
        setPointerOver(false);
      }}
    >
      <span style={valueColor ? { color: valueColor } : undefined}>
        <HighlightedValue itemLabel={itemLabel} />
      </span>
      {arrLabel}
      {pointerOver &&
        availableActions.map((action) => (
          <Tooltip key={action.key} arrow title={action.tooltip} placement="top">
            <StyledIconButton
              size="small"
              activeColor={action.activeColor}
              onClick={action.onClick}
              color="inherit"
              icon={action.icon}
            />
          </Tooltip>
        ))}
      <span className={cx(classes.placeholderActionContainer)}>
        {pointerOver &&
          placeholderActionsForSpacing.map((action) => (
            <Tooltip key={action.key} arrow title={action.tooltip} placement="top">
              <StyledIconButton size="small" color="inherit" icon={action.icon} />
            </Tooltip>
          ))}
      </span>
    </Stack>
  );
}

// In practice this seems to be an expensive component to render.
// Memoization provides a very noticeable performance boost.
export default React.memo(Value);
