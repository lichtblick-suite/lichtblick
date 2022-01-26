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
} from "@mui/icons-material";
import { Box, Button, IconButton, Stack, Theme, alpha } from "@mui/material";
import { createStyles, makeStyles } from "@mui/styles";
import cx from "classnames";
import { last } from "lodash";
import { ComponentProps, useCallback, useMemo, useRef } from "react";

import Dropdown from "@foxglove/studio-base/components/Dropdown";
import DropdownItem from "@foxglove/studio-base/components/Dropdown/DropdownItem";
import MessagePathInput from "@foxglove/studio-base/components/MessagePathSyntax/MessagePathInput";
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
  sidebarWidth: number;
  showSidebar: boolean;
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

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    dropdown: {
      backgroundColor: "transparent !important",
      padding: "4px !important",
    },
    root: {
      position: "relative",
      color: theme.palette.text.secondary,
      backgroundColor: theme.palette.background.paper,
      borderTop: `${theme.palette.background.default} solid 1px`,
    },
    floatingRoot: {
      cursor: "pointer",
      position: "absolute",
      left: theme.spacing(4),
      top: theme.spacing(1),
      bottom: theme.spacing(3),
      maxWidth: `calc(100% - ${theme.spacing(8)})`,
      backgroundColor: "transparent",
      borderTop: "none",
      pointerEvents: "none",
      zIndex: theme.zIndex.mobileStepper,
    },
    legendToggle: {
      cursor: "pointer",
      userSelect: "none",
      height: "100%",
      backgroundColor: theme.palette.background.paper,
    },
    floatingLegendToggle: {
      marginRight: theme.spacing(0.25),
      visibility: "hidden",
      borderRadius: theme.shape.borderRadius,
      backgroundColor: theme.palette.action.focus,
      height: "inherit",

      "&:hover": {
        backgroundColor: theme.palette.background.paper,
      },
      ".mosaic-window:hover &": { visibility: "initial" },
    },
  }),
);

function SidebarWrapper(props: {
  sidebarWidth: number;
  saveConfig: (arg0: Partial<PlotConfig>) => void;
  children: JSX.Element | undefined;
}): JSX.Element | ReactNull {
  const { sidebarWidth, saveConfig } = props;
  const originalWrapper = useRef<DOMRect | undefined>(undefined);
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      const offsetLeft = originalWrapper.current?.left ?? 0;
      const newWidth = e.clientX - offsetLeft;
      if (newWidth > minLegendWidth && newWidth < maxLegendWidth) {
        saveConfig({ sidebarWidth: newWidth });
      }
    },
    [originalWrapper, saveConfig],
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

  return (
    <Stack direction="row" height="100%">
      <Stack flexGrow={1} spacing={0.5} sx={{ width: sidebarWidth, overflow: "auto" }}>
        {props.children}
      </Stack>
      <Box
        onMouseDown={handleMouseDown}
        sx={(theme) => ({
          cursor: "ew-resize",
          userSelect: "none",
          width: theme.spacing(0.5),
          height: "100%",
          borderRight: `2px solid ${theme.palette.action.hover}`,

          "&:hover": {
            borderRightColor: theme.palette.action.selected,
          },
        })}
      />
    </Stack>
  );
}

export default function PlotLegend(props: PlotLegendProps): JSX.Element | ReactNull {
  const {
    paths,
    datasets,
    currentTime,
    saveConfig,
    showLegend,
    xAxisVal,
    xAxisPath,
    pathsWithMismatchedDataLengths,
    sidebarWidth,
    showSidebar,
    showPlotValuesInLegend,
  } = props;

  const lastPath = last(paths);
  const classes = useStyles();

  const toggleLegend = useCallback(
    () => saveConfig({ showLegend: !showLegend }),
    [showLegend, saveConfig],
  );

  const legendIcon = useMemo(
    () =>
      showSidebar ? (
        showLegend ? (
          <KeyboardArrowLeftIcon fontSize="inherit" />
        ) : (
          <KeyboardArrowRightIcon fontSize="inherit" />
        )
      ) : (
        <MenuIcon fontSize="inherit" />
      ),
    [showLegend, showSidebar],
  );

  const legendContent = useMemo(
    () =>
      showLegend ? (
        <Stack
          sx={(theme) => ({
            bgcolor: alpha(theme.palette.background.paper, 0.8),
            overflow: "auto",
            pointerEvents: "auto",
            [showSidebar ? "height" : "maxHeight"]: "100%",
            position: "relative",
          })}
        >
          <Stack
            direction="row"
            alignItems="center"
            padding={0.25}
            sx={(theme) => ({
              height: 26,
              position: "sticky",
              top: 0,
              left: 0,
              right: 0,
              bgcolor: "background.paper",
              zIndex: theme.zIndex.mobileStepper + 1,
            })}
          >
            <Box
              sx={{
                zIndex: 4,
                height: 20,

                "&:hover": { bgcolor: "action.hover" },
              }}
            >
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
            </Box>
            <Stack direction="row" overflow="hidden">
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
            </Stack>
          </Stack>
          <Box
            sx={{
              position: "relative",
              display: "grid",
              gridTemplateColumns: [
                "auto",
                "minmax(max-content, 1fr)",
                showPlotValuesInLegend && "minmax(max-content, 1fr)",
                "auto",
              ]
                .filter(Boolean)
                .join(" "),
              alignItems: "stretch",
            }}
          >
            {paths.map((path: PlotPath, index: number) => {
              const hasMismatchedDataLength = pathsWithMismatchedDataLengths.includes(path.value);
              return (
                <PlotLegendRow
                  key={index}
                  index={index}
                  xAxisVal={xAxisVal}
                  path={path}
                  paths={paths}
                  hasMismatchedDataLength={hasMismatchedDataLength}
                  datasets={datasets}
                  currentTime={currentTime}
                  saveConfig={saveConfig}
                  showPlotValuesInLegend={showPlotValuesInLegend}
                />
              );
            })}
          </Box>
          <Box
            padding={0.5}
            gridColumn="span 4"
            sx={{
              ...(showSidebar && {
                position: "sticky",
                right: 0,
                left: 0,
              }),
            }}
          >
            <Button
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
              sx={{ minWidth: 100, bgcolor: "action.hover" }}
            >
              Add line
            </Button>
          </Box>
        </Stack>
      ) : undefined,
    [
      classes.dropdown,
      currentTime,
      datasets,
      lastPath,
      paths,
      pathsWithMismatchedDataLengths,
      saveConfig,
      showLegend,
      showSidebar,
      showPlotValuesInLegend,
      xAxisPath,
      xAxisVal,
    ],
  );

  return (
    <Stack
      direction="row"
      alignItems="flex-start"
      className={cx(classes.root, { [classes.floatingRoot]: !showSidebar })}
    >
      <IconButton
        disableRipple={showSidebar}
        size="small"
        onClick={toggleLegend}
        className={cx(classes.legendToggle, { [classes.floatingLegendToggle]: !showSidebar })}
        sx={{
          bgcolor: "action.hover",
          padding: showSidebar ? "0" : undefined,
          pointerEvents: "auto",

          "&:hover": {
            bgcolor: "action.focus",
          },
        }}
      >
        {legendIcon}
      </IconButton>
      {showLegend ? (
        showSidebar ? (
          <SidebarWrapper sidebarWidth={sidebarWidth} saveConfig={saveConfig}>
            {legendContent}
          </SidebarWrapper>
        ) : (
          <Stack overflow="hidden" height="100%">
            {legendContent}
          </Stack>
        )
      ) : undefined}
    </Stack>
  );
}
