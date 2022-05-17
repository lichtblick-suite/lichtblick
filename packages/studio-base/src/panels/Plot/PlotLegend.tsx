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

import {
  Add as AddIcon,
  Menu as MenuIcon,
  KeyboardArrowLeft as KeyboardArrowLeftIcon,
  KeyboardArrowRight as KeyboardArrowRightIcon,
  KeyboardArrowUp as KeyboardArrowUpIcon,
  KeyboardArrowDown as KeyboardArrowDownIcon,
} from "@mui/icons-material";
import { Button, IconButton, Theme, alpha } from "@mui/material";
import { makeStyles } from "@mui/styles";
import cx from "classnames";
import { last } from "lodash";
import { ComponentProps, useCallback, useMemo, useRef } from "react";

import Dropdown from "@foxglove/studio-base/components/Dropdown";
import DropdownItem from "@foxglove/studio-base/components/Dropdown/DropdownItem";
import MessagePathInput from "@foxglove/studio-base/components/MessagePathSyntax/MessagePathInput";
import { PANEL_TOOLBAR_MIN_HEIGHT } from "@foxglove/studio-base/components/PanelToolbar";
import TimeBasedChart from "@foxglove/studio-base/components/TimeBasedChart";
import PlotLegendRow from "@foxglove/studio-base/panels/Plot/PlotLegendRow";

import { PlotPath, BasePlotPath, isReferenceLinePlotPathType } from "./internalTypes";
import { plotableRosTypes, PlotConfig, PlotXAxisVal } from "./types";

const minLegendWidth = 25;
const maxLegendWidth = 800;

type PlotLegendProps = {
  paths: PlotPath[];
  datasets: ComponentProps<typeof TimeBasedChart>["data"]["datasets"];
  currentTime?: number;
  saveConfig: (arg0: Partial<PlotConfig>) => void;
  showLegend: boolean;
  xAxisVal: PlotXAxisVal;
  xAxisPath?: BasePlotPath;
  pathsWithMismatchedDataLengths: string[];
  sidebarDimension: number;
  legendDisplay: "floating" | "top" | "left";
  showPlotValuesInLegend: boolean;
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

type StyleProps = {
  legendDisplay: PlotLegendProps["legendDisplay"];
  showLegend: PlotLegendProps["showLegend"];
  showPlotValuesInLegend?: PlotLegendProps["showPlotValuesInLegend"];
  sidebarDimension: PlotLegendProps["sidebarDimension"];
};

const useStyles = makeStyles((theme: Theme) => ({
  addButton: {
    minWidth: 100,
    backgroundColor: `${theme.palette.action.hover} !important`,
  },
  dragHandle: ({ legendDisplay }: StyleProps) => ({
    userSelect: "none",
    border: `0px solid ${theme.palette.action.hover}`,
    ...(legendDisplay === "left"
      ? {
          cursor: "ew-resize",
          borderRightWidth: 2,
          height: "100%",
          width: theme.spacing(0.5),
        }
      : {
          cursor: "ns-resize",
          borderBottomWidth: 2,
          height: theme.spacing(0.5),
          width: "100%",
        }),

    "&:hover": {
      borderColor: theme.palette.action.selected,
    },
  }),
  dropdownWrapper: {
    zIndex: 4,
    height: 20,

    "&:hover": {
      backgroundColor: theme.palette.action.hover,
    },
  },
  dropdown: {
    backgroundColor: "transparent !important",
    padding: "4px !important",
  },
  footer: ({ legendDisplay }: StyleProps) => ({
    padding: theme.spacing(0.5),
    gridColumn: "span 4",
    ...(legendDisplay !== "floating" && {
      position: "sticky",
      right: 0,
      left: 0,
    }),
  }),
  floatingWrapper: {
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    height: "100%",
  },
  grid: {
    alignItems: "stretch",
    position: "relative",
    display: "grid",
    gridTemplateColumns: ({ showPlotValuesInLegend = false }: StyleProps) =>
      [
        "auto",
        "minmax(max-content, 1fr)",
        showPlotValuesInLegend && "minmax(max-content, 1fr)",
        "auto",
      ]
        .filter(Boolean)
        .join(" "),
  },
  header: {
    display: "flex",
    alignItems: "center",
    padding: theme.spacing(0.25),
    height: 26,
    position: "sticky",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.palette.background.paper,
    zIndex: theme.zIndex.mobileStepper + 1,
  },
  legendContent: ({ legendDisplay }: StyleProps) => ({
    display: "flex",
    flexDirection: "column",
    backgroundColor: alpha(theme.palette.background.paper, 0.8),
    overflow: "auto",
    pointerEvents: "auto",
    [legendDisplay !== "floating" ? "height" : "maxHeight"]: "100%",
    position: "relative",
  }),
  toggleButton: ({ legendDisplay }: StyleProps) => ({
    cursor: "pointer",
    userSelect: "none",
    pointerEvents: "auto",
    ...{
      left: { height: "100%", padding: "0px !important" },
      top: { width: "100%", padding: "0px !important" },
      floating: undefined,
    }[legendDisplay],

    "&:hover": {
      backgroundColor: theme.palette.action.focus,
    },
  }),
  toggleButtonFloating: {
    marginRight: theme.spacing(0.25),
    borderRadius: theme.shape.borderRadius,
    backgroundColor: `${theme.palette.action.focus} !important`,
    visibility: ({ showLegend }: StyleProps) => (showLegend ? "visible" : "hidden"),

    "&:hover": {
      backgroundColor: theme.palette.background.paper,
    },
    ".mosaic-window:hover &": {
      visibility: "initial",
    },
  },
  root: {
    display: "flex",
    alignItems: "flex-start",
    position: "relative",
    color: theme.palette.text.secondary,
    backgroundColor: theme.palette.background.paper,
    borderTop: `${theme.palette.background.default} solid 1px`,
    flexDirection: ({ legendDisplay }: StyleProps) => (legendDisplay === "top" ? "column" : "row"),
  },
  rootFloating: {
    cursor: "pointer",
    position: "absolute",
    left: theme.spacing(4),
    top: `calc(${theme.spacing(1)} + ${PANEL_TOOLBAR_MIN_HEIGHT}px)`,
    bottom: theme.spacing(3),
    maxWidth: `calc(100% - ${theme.spacing(8)})`,
    backgroundColor: "transparent",
    borderTop: "none",
    pointerEvents: "none",
    zIndex: theme.zIndex.mobileStepper,
    gap: theme.spacing(0.5),
  },
  wrapper: ({ legendDisplay }: StyleProps) => ({
    display: "flex",
    flexDirection: legendDisplay === "left" ? "row" : "column",
    width: legendDisplay === "top" ? "100%" : undefined,
    height: legendDisplay === "left" ? "100%" : undefined,
  }),
  wrapperContent: ({ legendDisplay, sidebarDimension }: StyleProps) => ({
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
    gap: theme.spacing(0.5),
    overflow: "auto",
    [legendDisplay === "left" ? "width" : "height"]: sidebarDimension,
  }),
}));

export default function PlotLegend(props: PlotLegendProps): JSX.Element {
  const {
    paths,
    datasets,
    currentTime,
    saveConfig,
    showLegend,
    xAxisVal,
    xAxisPath,
    pathsWithMismatchedDataLengths,
    sidebarDimension,
    legendDisplay,
    showPlotValuesInLegend,
  } = props;
  const lastPath = last(paths);
  const classes = useStyles({
    legendDisplay,
    sidebarDimension,
    showLegend,
    showPlotValuesInLegend,
  });

  const toggleLegend = useCallback(
    () => saveConfig({ showLegend: !showLegend }),
    [showLegend, saveConfig],
  );

  const legendIcon = useMemo(() => {
    if (legendDisplay !== "floating") {
      const iconMap = showLegend
        ? { left: KeyboardArrowLeftIcon, top: KeyboardArrowUpIcon }
        : { left: KeyboardArrowRightIcon, top: KeyboardArrowDownIcon };
      const ArrowIcon = iconMap[legendDisplay];
      return <ArrowIcon fontSize="inherit" />;
    }
    return <MenuIcon fontSize="inherit" />;
  }, [showLegend, legendDisplay]);

  const originalWrapper = useRef<DOMRect | undefined>(undefined);
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      const offset = originalWrapper.current?.[legendDisplay as "top" | "left"] ?? 0;
      const newDimension = e[legendDisplay === "left" ? "clientX" : "clientY"] - offset;
      if (newDimension > minLegendWidth && newDimension < maxLegendWidth) {
        saveConfig({ sidebarDimension: newDimension });
      }
    },
    [originalWrapper, legendDisplay, saveConfig],
  );

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    originalWrapper.current = (e.target as Node).parentElement?.getBoundingClientRect() as DOMRect;
    document.addEventListener("mouseup", handleMouseUp, true);
    document.addEventListener("mousemove", handleMouseMove, true);
  };

  const handleMouseUp = () => {
    originalWrapper.current = undefined;
    document.removeEventListener("mouseup", handleMouseUp, true);
    document.removeEventListener("mousemove", handleMouseMove, true);
  };

  const legendContent = useMemo(
    () => (
      <div className={classes.legendContent}>
        <header className={classes.header}>
          <div className={classes.dropdownWrapper}>
            <Dropdown
              value={xAxisVal}
              text={`x: ${shortXAxisLabel(xAxisVal)}`}
              btnClassname={classes.dropdown}
              onChange={(newXAxisVal) => saveConfig({ xAxisVal: newXAxisVal })}
              noPortal
            >
              <DropdownItem value="timestamp">timestamp</DropdownItem>
              <DropdownItem value="index">index</DropdownItem>
              <DropdownItem value="currentCustom">msg path (current)</DropdownItem>
              <DropdownItem value="custom">msg path (accumulated)</DropdownItem>
            </Dropdown>
          </div>
          {(xAxisVal === "custom" || xAxisVal === "currentCustom") && (
            <MessagePathInput
              path={xAxisPath?.value ? xAxisPath.value : "/"}
              onChange={(newXAxisPath) =>
                saveConfig({
                  xAxisPath: {
                    value: newXAxisPath,
                    enabled: xAxisPath ? xAxisPath.enabled : true,
                  },
                })
              }
              validTypes={plotableRosTypes}
              placeholder="Enter a topic name or a number"
              disableAutocomplete={xAxisPath && isReferenceLinePlotPathType(xAxisPath)}
              autoSize
            />
          )}
        </header>
        <div className={classes.grid}>
          {paths.map((path: PlotPath, index: number) => (
            <PlotLegendRow
              key={index}
              index={index}
              xAxisVal={xAxisVal}
              path={path}
              paths={paths}
              hasMismatchedDataLength={pathsWithMismatchedDataLengths.includes(path.value)}
              datasets={datasets}
              currentTime={currentTime}
              saveConfig={saveConfig}
              showPlotValuesInLegend={showPlotValuesInLegend}
            />
          ))}
        </div>
        <footer className={classes.footer}>
          <Button
            className={classes.addButton}
            size="small"
            fullWidth
            startIcon={<AddIcon />}
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
            Add line
          </Button>
        </footer>
      </div>
    ),
    [
      classes.legendContent,
      classes.header,
      classes.dropdownWrapper,
      classes.dropdown,
      classes.grid,
      classes.footer,
      classes.addButton,
      xAxisVal,
      xAxisPath,
      paths,
      saveConfig,
      pathsWithMismatchedDataLengths,
      datasets,
      currentTime,
      showPlotValuesInLegend,
      lastPath,
    ],
  );

  return (
    <div className={cx(classes.root, { [classes.rootFloating]: legendDisplay === "floating" })}>
      <IconButton
        size="small"
        onClick={toggleLegend}
        className={cx(classes.toggleButton, {
          [classes.toggleButtonFloating]: legendDisplay === "floating",
        })}
      >
        {legendIcon}
      </IconButton>
      {showLegend &&
        (legendDisplay === "floating" ? (
          <div className={classes.floatingWrapper}>{legendContent}</div>
        ) : (
          <div className={classes.wrapper}>
            <div className={classes.wrapperContent}> {legendContent}</div>
            <div className={classes.dragHandle} onMouseDown={handleMouseDown} />
          </div>
        ))}
    </div>
  );
}
