// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import CheckIcon from "@mui/icons-material/Check";
import CopyAllIcon from "@mui/icons-material/CopyAll";
import ErrorIcon from "@mui/icons-material/Error";
import FilterIcon from "@mui/icons-material/FilterAlt";
import StateTransitionsIcon from "@mui/icons-material/PowerInput";
import ScatterPlotIcon from "@mui/icons-material/ScatterPlot";
import LineChartIcon from "@mui/icons-material/ShowChart";
import { IconButtonProps, Tooltip, TooltipProps } from "@mui/material";
import { useCallback, useMemo, useState, useRef, useEffect } from "react";
import { withStyles, makeStyles } from "tss-react/mui";

import HoverableIconButton from "@lichtblick/suite-base/components/HoverableIconButton";
import Stack from "@lichtblick/suite-base/components/Stack";
import { openSiblingPlotPanel } from "@lichtblick/suite-base/panels/Plot/utils/openSiblingPlotPanel";
import { openSiblingStateTransitionsPanel } from "@lichtblick/suite-base/panels/StateTransitions/openSiblingStateTransitionsPanel";
import { PLOTABLE_ROS_TYPES } from "@lichtblick/suite-base/panels/shared/constants";
import { OpenSiblingPanel } from "@lichtblick/suite-base/types/panels";
import clipboard from "@lichtblick/suite-base/util/clipboard";

import HighlightedValue from "./HighlightedValue";
import { copyMessageReplacer } from "./copyMessageReplacer";
import { ValueAction } from "./getValueActionForValue";
import { TRANSITIONABLE_ROS_TYPES } from "../StateTransitions/constants";

const StyledIconButton = withStyles(HoverableIconButton, (theme) => ({
  root: {
    "&.MuiIconButton-root": {
      fontSize: theme.typography.pxToRem(16),
      opacity: 0.6,
      padding: 0,
    },
  },
}));

const useStyles = makeStyles()({
  // always hidden, just used to keep space and prevent resizing on hover
  placeholderActionContainer: {
    alignItems: "inherit",
    display: "inherit",
    gap: "inherit",
    visibility: "hidden",
  },
});

type ValueProps = {
  arrLabel: string;
  basePath: string;
  itemLabel: string;
  itemValue: unknown;
  valueAction: ValueAction | undefined;
  onTopicPathChange: (arg0: string) => void;
  openSiblingPanel: OpenSiblingPanel;
};

type ValueActionItem = {
  key: string;
  tooltip: TooltipProps["title"];
  icon: React.ReactNode;
  onClick?: IconButtonProps["onClick"];
  activeColor?: IconButtonProps["color"];
  color?: IconButtonProps["color"];
};

const emptyAction: ValueActionItem = {
  key: "",
  tooltip: "",
  icon: <ErrorIcon fontSize="inherit" />,
};

const MAX_ACTION_ITEMS = 4;

function Value(props: ValueProps): React.JSX.Element {
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
      actions.push({
        key: "Copy",
        activeColor: copied ? "success" : "primary",
        tooltip: copied ? "Copied" : "Copy to Clipboard",
        icon: copied ? <CheckIcon fontSize="inherit" /> : <CopyAllIcon fontSize="inherit" />,
        onClick: () => {
          handleCopy(JSON.stringify(itemValue, copyMessageReplacer, 2) ?? "");
        },
      });
    }
    if (valueAction != undefined) {
      const isPlotableType = PLOTABLE_ROS_TYPES.includes(valueAction.primitiveType);
      const isTransitionalType = TRANSITIONABLE_ROS_TYPES.includes(valueAction.primitiveType);
      const isMultiSlicePath = valueAction.multiSlicePath === valueAction.singleSlicePath;

      if (valueAction.filterPath.length > 0) {
        actions.push({
          key: "Filter",
          tooltip: "Filter on this value",
          icon: <FilterIcon fontSize="inherit" />,
          onClick: onFilter,
        });
      }
      if (isPlotableType) {
        actions.push({
          key: "line",
          tooltip: "Plot this value on a line chart",
          icon: <LineChartIcon fontSize="inherit" />,
          onClick: openPlotPanel(valueAction.singleSlicePath),
        });
      }
      if (isPlotableType && !isMultiSlicePath) {
        actions.push({
          key: "scatter",
          tooltip: "Plot this value on a scatter plot",
          icon: <ScatterPlotIcon fontSize="inherit" />,
          onClick: openPlotPanel(valueAction.multiSlicePath),
        });
      }
      if (isTransitionalType && isMultiSlicePath) {
        actions.push({
          key: "stateTransitions",
          tooltip: "View state transitions for this value",
          icon: <StateTransitionsIcon fontSize="inherit" />,
          onClick: openStateTransitionsPanel(valueAction.singleSlicePath),
        });
      }
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
  const { classes, cx } = useStyles();

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
      <HighlightedValue itemLabel={itemLabel} />
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
