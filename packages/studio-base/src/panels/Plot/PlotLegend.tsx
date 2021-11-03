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

import { IconButton, ITheme, makeStyles } from "@fluentui/react";
import AlertCircleIcon from "@mdi/svg/svg/alert-circle.svg";
import MenuIcon from "@mdi/svg/svg/menu.svg";
import cx from "classnames";
import { last } from "lodash";
import { Fragment, useCallback, useMemo } from "react";
import tinycolor from "tinycolor2";

import Dropdown from "@foxglove/studio-base/components/Dropdown";
import DropdownItem from "@foxglove/studio-base/components/Dropdown/DropdownItem";
import Icon from "@foxglove/studio-base/components/Icon";
import MessagePathInput from "@foxglove/studio-base/components/MessagePathSyntax/MessagePathInput";
import { useTooltip } from "@foxglove/studio-base/components/Tooltip";
import { lineColors } from "@foxglove/studio-base/util/plotColors";
import { colors } from "@foxglove/studio-base/util/sharedStyleConstants";
import { TimestampMethod } from "@foxglove/studio-base/util/time";

import { PlotPath, BasePlotPath, isReferenceLinePlotPathType } from "./internalTypes";
import { plotableRosTypes, PlotConfig, PlotXAxisVal } from "./types";

const stylesForButtonsDisplayedOnHover = (theme: ITheme) =>
  ({
    visibility: "hidden",
    padding: 6,
    cursor: "pointer",
    position: "absolute",
    top: 0,
    height: 25,
    width: 25,
    borderRadius: 5,
    userSelect: "none",
    background: tinycolor(theme.palette.neutralLight).setAlpha(0.75).toRgbString(),

    ":hover": {
      background: tinycolor(theme.palette.neutralLight).setAlpha(0.75).toRgbString(),
    },
    ".mosaic-window:hover &": {
      visibility: "initial",
    },
  } as const);

const useStyles = makeStyles((theme) => ({
  root: {
    position: "absolute",
    left: 65,
    top: 6,
    background: tinycolor(theme.palette.neutralLight).setAlpha(0.25).toRgbString(),
    color: theme.semanticColors.bodySubtext,
    maxWidth: "calc(100% - 65px - 25px)",

    ":hover": {
      background: tinycolor(theme.palette.neutralLight).setAlpha(0.5).toRgbString(),
    },
  },
  dropdown: {
    backgroundColor: "transparent !important",
    padding: "3px !important",
  },
  addLine: {
    display: "none",
    content: "+ add line",
    position: "absolute",
    background: tinycolor(theme.palette.neutralLight).setAlpha(0.5).toRgbString(),
    left: 0,
    right: 0,
    bottom: 0,
    transform: "translateY(100%)",
    padding: 6,
    cursor: "pointer",
    textAlign: "center",

    ":hover": {
      background: tinycolor(theme.palette.neutralLight).setAlpha(0.75).toRgbString(),
    },
    ".mosaic-window:hover &": {
      display: "block",
    },
  },
  item: {
    display: "flex",
    padding: "0 5px",
    height: 20,
    lineHeight: 20,
    position: "relative",

    ":hover": {
      background: tinycolor(theme.palette.neutralLight).setAlpha(0.75).toRgbString(),

      "[data-item-remove]": {
        visibility: "initial",
      },
    },
  },
  itemIconContainer: {
    display: "inline-block",
    width: 22,
    height: 20,
    lineHeight: 0,
    cursor: "pointer",
    flexShrink: 0,

    ":hover": {
      background: theme.palette.neutralLight,
    },
  },
  itemIcon: {
    display: "inline-block",
    width: 15,
    borderBottom: "2px solid currentColor",
    height: 0,
    verticalAlign: "middle",
    position: "relative",
    top: "calc(50% - 1px)",
  },
  download: { ...stylesForButtonsDisplayedOnHover(theme), left: -60 },
  legendToggle: { ...stylesForButtonsDisplayedOnHover(theme), left: -30 },
  itemRemove: {
    visibility: "hidden",
    padding: "0 6px",
    cursor: "pointer",
    position: "absolute",
    right: -21,
    background: "transparent",
    height: 20,
    lineHeight: 20,
    userSelect: "none",

    ":hover": {
      background: tinycolor(theme.palette.neutralLight).setAlpha(0.75).toRgbString(),
    },
  },
  itemInput: {
    overflow: "hidden",
    width: "100%",
    display: "flex",
  },
  itemInputDisabled: {
    input: {
      textDecoration: "line-through",
    },
  },
}));

type PlotLegendProps = {
  paths: PlotPath[];
  saveConfig: (arg0: Partial<PlotConfig>) => void;
  showLegend: boolean;
  xAxisVal: PlotXAxisVal;
  xAxisPath?: BasePlotPath;
  pathsWithMismatchedDataLengths: string[];
  onDownload: () => void;
};

const shortXAxisLabel = (path: PlotXAxisVal): string => {
  switch (path) {
    case "custom":
      return "path (accum)";
    case "index":
      return "index";
    case "currentCustom":
      return "path (current)";
    case "timestamp":
      return "timestamp";
  }
  throw new Error(`unknown path: ${path}`);
};

export default function PlotLegend(props: PlotLegendProps): JSX.Element {
  const {
    paths,
    saveConfig,
    showLegend,
    xAxisVal,
    xAxisPath,
    pathsWithMismatchedDataLengths,
    onDownload,
  } = props;
  const lastPath = last(paths);
  const classes = useStyles();

  const onInputChange = useCallback(
    (value: string, index?: number) => {
      if (index == undefined) {
        throw new Error("index not set");
      }
      const newPaths = paths.slice();
      const newPath = newPaths[index];
      if (newPath) {
        newPaths[index] = { ...newPath, value: value.trim() };
      }
      saveConfig({ paths: newPaths });
    },
    [paths, saveConfig],
  );

  const onInputTimestampMethodChange = useCallback(
    (value: TimestampMethod, index?: number) => {
      if (index == undefined) {
        throw new Error("index not set");
      }
      const newPaths = paths.slice();
      const newPath = newPaths[index];
      if (newPath) {
        newPaths[index] = { ...newPath, timestampMethod: value };
      }
      saveConfig({ paths: newPaths });
    },
    [paths, saveConfig],
  );

  const { toggleToHideLegend, toggleToShowLegend } = useMemo(
    () => ({
      toggleToHideLegend: () => saveConfig({ showLegend: false }),
      toggleToShowLegend: () => saveConfig({ showLegend: true }),
    }),
    [saveConfig],
  );

  const downloadCSVTooltip = useTooltip({ contents: "Download plot data as CSV" });

  if (!showLegend) {
    return (
      <div className={classes.root}>
        <Icon className={classes.legendToggle} onClick={toggleToShowLegend}>
          <MenuIcon />
        </Icon>
      </div>
    );
  }

  return (
    <div className={classes.root}>
      <IconButton
        className={classes.download}
        elementRef={downloadCSVTooltip.ref}
        iconProps={{ iconName: "Download" }}
        onClick={onDownload}
        ariaLabel="Download plot data as CSV"
        styles={{ icon: { height: 20 } }}
      >
        {downloadCSVTooltip.tooltip}
      </IconButton>
      <Icon className={classes.legendToggle} onClick={toggleToHideLegend}>
        <MenuIcon />
      </Icon>
      <div className={classes.item}>
        x:
        <div
          className={classes.itemIconContainer}
          style={{ width: "auto", lineHeight: "normal", zIndex: 2 }}
        >
          <Dropdown
            value={xAxisVal}
            text={shortXAxisLabel(xAxisVal)}
            btnClassname={classes.dropdown}
            onChange={(newXAxisVal) => saveConfig({ xAxisVal: newXAxisVal })}
            noPortal
          >
            <DropdownItem value="timestamp">
              <span>timestamp</span>
            </DropdownItem>
            <DropdownItem value="index">
              <span>index</span>
            </DropdownItem>
            <DropdownItem value="currentCustom">
              <span>msg path (current)</span>
            </DropdownItem>
            <DropdownItem value="custom">
              <span>msg path (accumulated)</span>
            </DropdownItem>
          </Dropdown>
        </div>
        <div
          className={cx(classes.itemInput, {
            [classes.itemInputDisabled]: xAxisPath?.enabled !== true,
          })}
        >
          {(xAxisVal === "custom" || xAxisVal === "currentCustom") && (
            <MessagePathInput
              path={xAxisPath?.value ? xAxisPath.value : "/"}
              onChange={(newXAxisPath) =>
                saveConfig({
                  xAxisPath: { value: newXAxisPath, enabled: xAxisPath ? xAxisPath.enabled : true },
                })
              }
              validTypes={plotableRosTypes}
              placeholder="Enter a topic name or a number"
              disableAutocomplete={xAxisPath && isReferenceLinePlotPathType(xAxisPath)}
              autoSize
            />
          )}
        </div>
      </div>
      {paths.map((path: PlotPath, index: number) => {
        const isReferenceLinePlotPath = isReferenceLinePlotPathType(path);
        let timestampMethod;
        // Only allow chosing the timestamp method if it is applicable (not a reference line) and there is at least
        // one character typed.
        if (!isReferenceLinePlotPath && path.value.length > 0) {
          timestampMethod = path.timestampMethod;
        }
        const hasMismatchedDataLength = pathsWithMismatchedDataLengths.includes(path.value);

        return (
          <Fragment key={index}>
            <div className={classes.item}>
              y:
              <div
                className={classes.itemIconContainer}
                style={{ zIndex: 1 }}
                onClick={() => {
                  const newPaths = paths.slice();
                  const newPath = newPaths[index];
                  if (newPath) {
                    newPaths[index] = { ...newPath, enabled: !newPath.enabled };
                  }
                  saveConfig({ paths: newPaths });
                }}
              >
                <div
                  className={classes.itemIcon}
                  style={{ color: path.enabled ? lineColors[index % lineColors.length] : "#777" }}
                />
              </div>
              <div
                className={cx(classes.itemInput, {
                  [classes.itemInputDisabled]: !path.enabled,
                })}
              >
                <MessagePathInput
                  supportsMathModifiers
                  path={path.value}
                  onChange={onInputChange}
                  onTimestampMethodChange={onInputTimestampMethodChange}
                  validTypes={plotableRosTypes}
                  placeholder="Enter a topic name or a number"
                  index={index}
                  autoSize
                  disableAutocomplete={isReferenceLinePlotPath}
                  {...(xAxisVal === "timestamp" ? { timestampMethod } : undefined)}
                />
                {hasMismatchedDataLength && (
                  <Icon
                    style={{ color: colors.RED }}
                    clickable={false}
                    size="small"
                    tooltipProps={{ placement: "top" }}
                    tooltip="Mismatch in the number of elements in x-axis and y-axis messages"
                  >
                    <AlertCircleIcon />
                  </Icon>
                )}
              </div>
              <div
                data-item-remove
                className={classes.itemRemove}
                onClick={() => {
                  const newPaths = paths.slice();
                  newPaths.splice(index, 1);
                  saveConfig({ paths: newPaths });
                }}
              >
                ✕
              </div>
            </div>
          </Fragment>
        );
      })}
      <div
        className={classes.addLine}
        onClick={() =>
          saveConfig({
            paths: [
              ...paths,
              {
                value: "",
                enabled: true,
                // For convenience, default to the `timestampMethod` of the last path.
                timestampMethod: lastPath ? lastPath.timestampMethod : "receiveTime",
              },
            ],
          })
        }
      >
        + add line
      </div>
    </div>
  );
}
