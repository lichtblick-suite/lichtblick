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
  ArrowDropDown as ArrowDropDownIcon,
} from "@mui/icons-material";
import { alpha, Button, IconButton, Menu, MenuItem } from "@mui/material";
import { last } from "lodash";
import {
  ComponentProps,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLatest } from "react-use";
import { makeStyles } from "tss-react/mui";
import { useDebouncedCallback } from "use-debounce";

import MessagePathInput from "@foxglove/studio-base/components/MessagePathSyntax/MessagePathInput";
import { PANEL_TOOLBAR_MIN_HEIGHT } from "@foxglove/studio-base/components/PanelToolbar";
import TimeBasedChart from "@foxglove/studio-base/components/TimeBasedChart";
import PlotLegendRow from "@foxglove/studio-base/panels/Plot/PlotLegendRow";
import { SaveConfig } from "@foxglove/studio-base/types/panels";

import { PlotPath, BasePlotPath, isReferenceLinePlotPathType } from "./internalTypes";
import { plotableRosTypes, PlotConfig, PlotXAxisVal } from "./types";

const minLegendWidth = 25;
const maxLegendWidth = 800;

type PlotLegendProps = {
  paths: PlotPath[];
  datasets: ComponentProps<typeof TimeBasedChart>["data"]["datasets"];
  currentTime?: number;
  saveConfig: SaveConfig<PlotConfig>;
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

const useStyles = makeStyles<StyleProps>()(
  (
    theme,
    // prettier-ignore
    {
      legendDisplay,
      sidebarDimension,
      showLegend,
      showPlotValuesInLegend = false,
    },
  ) => ({
    addButton: {
      minWidth: 100,
      backgroundColor: `${theme.palette.action.hover} !important`,
    },
    dragHandle: {
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
    },
    // dropdownWrapper: {
    //   zIndex: 4,
    //   height: 20,

    //   "&:hover": {
    //     backgroundColor: theme.palette.action.hover,
    //   },
    // },
    // dropdown: {
    //   backgroundColor: "transparent !important",
    //   padding: "4px !important",
    // },
    footer: {
      padding: theme.spacing(0.5),
      gridColumn: showPlotValuesInLegend ? "span 4" : "span 3",
      position: "sticky",
      right: 0,
      left: 0,
    },
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
      gridTemplateColumns: [
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
    legendContent: {
      display: "flex",
      flexDirection: "column",
      backgroundColor: alpha(theme.palette.background.paper, 0.8),
      overflow: "auto",
      pointerEvents: "auto",
      [legendDisplay !== "floating" ? "height" : "maxHeight"]: "100%",
      position: "relative",
    },
    toggleButton: {
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
    },
    toggleButtonFloating: {
      marginRight: theme.spacing(0.25),
      borderRadius: theme.shape.borderRadius,
      backgroundColor: `${theme.palette.action.focus} !important`,
      visibility: showLegend ? "visible" : "hidden",

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
      flexDirection: legendDisplay === "top" ? "column" : "row",
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
    wrapper: {
      display: "flex",
      flexDirection: legendDisplay === "left" ? "row" : "column",
      width: legendDisplay === "top" ? "100%" : undefined,
      height: legendDisplay === "left" ? "100%" : undefined,
    },
    wrapperContent: {
      display: "flex",
      flexDirection: "column",
      flexGrow: 1,
      gap: theme.spacing(0.5),
      overflow: "auto",
      [legendDisplay === "left" ? "width" : "height"]: sidebarDimension,
    },
  }),
);

function AxisDropdown({
  xAxisVal,
  onChange,
}: {
  xAxisVal: PlotXAxisVal;
  onChange: (xAxisVal: PlotXAxisVal) => void;
}): JSX.Element {
  const [anchorEl, setAnchorEl] = useState<undefined | HTMLElement>(undefined);
  const open = Boolean(anchorEl);

  const handleButtonClick = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  }, []);

  const handleClose = useCallback(() => {
    setAnchorEl(undefined);
  }, []);

  const handleItemClick = useCallback(
    (value: PlotXAxisVal) => {
      onChange(value);
      handleClose();
    },
    [handleClose, onChange],
  );

  return (
    <>
      <Button
        id="x-axis-button"
        aria-controls={open ? "x-axis-menu" : undefined}
        aria-haspopup="true"
        aria-expanded={open ? "true" : undefined}
        onClick={handleButtonClick}
        color="inherit"
        variant="text"
        size="small"
        endIcon={<ArrowDropDownIcon />}
      >
        &nbsp;
        {`x: ${shortXAxisLabel(xAxisVal)}`}
      </Button>
      <Menu
        id="x-axis-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        MenuListProps={{
          "aria-labelledby": "x-axis-button",
          dense: true,
        }}
      >
        <MenuItem value="timestamp" onClick={() => handleItemClick("timestamp")}>
          timestamp
        </MenuItem>
        <MenuItem value="index" onClick={() => handleItemClick("index")}>
          index
        </MenuItem>
        <MenuItem value="currentCustom" onClick={() => handleItemClick("currentCustom")}>
          msg path (current)
        </MenuItem>
        <MenuItem value="custom" onClick={() => handleItemClick("custom")}>
          msg path (accumulated)
        </MenuItem>
      </Menu>
    </>
  );
}

export default function PlotLegend(props: PlotLegendProps): JSX.Element {
  const {
    currentTime,
    datasets,
    legendDisplay,
    pathsWithMismatchedDataLengths,
    saveConfig,
    showLegend,
    showPlotValuesInLegend,
    sidebarDimension,
    xAxisPath,
    xAxisVal,
  } = props;
  const { classes, cx } = useStyles({
    legendDisplay,
    sidebarDimension,
    showLegend,
    showPlotValuesInLegend,
  });

  // We keep and update a local copy of paths and periodically flush to config
  // because changing paths forces the whole plot to rerender and results in
  // bad interactive performance on the path input.
  const [localPaths, setLocalPaths] = useState(props.paths);

  const debouncedSavePaths = useDebouncedCallback((paths: PlotPath[]) => {
    props.saveConfig({ paths });
  }, 500);

  const savePaths = useCallback(
    (paths: PlotPath[]) => {
      setLocalPaths(paths);
      debouncedSavePaths(paths);
    },
    [debouncedSavePaths],
  );

  const lastPath = last(localPaths);

  // The set of paths we plot can be changed externally by other panels so
  // we replace our local path state with the config path state when this happens.
  const latestPropsPaths = useLatest(props.paths);
  useEffect(() => {
    setLocalPaths(latestPropsPaths.current);
  }, [latestPropsPaths, props.paths.length]);

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

  const contentRef = useRef<HTMLDivElement>(ReactNull);

  const legendHeader = useMemo(
    () => (
      <header className={classes.header}>
        <AxisDropdown
          xAxisVal={xAxisVal}
          onChange={(value: PlotXAxisVal) => saveConfig({ xAxisVal: value })}
        />
        {(xAxisVal === "custom" || xAxisVal === "currentCustom") && (
          <MessagePathInput
            path={xAxisPath?.value ?? ""}
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
    ),
    [classes.header, saveConfig, xAxisPath, xAxisVal],
  );

  const legendFooter = useMemo(
    () => (
      <footer className={classes.footer}>
        <Button
          className={classes.addButton}
          size="small"
          fullWidth
          startIcon={<AddIcon />}
          onClick={() =>
            savePaths([
              ...localPaths,
              {
                value: "",
                enabled: true,
                // For convenience, default to the `timestampMethod` of the last path.
                timestampMethod: lastPath ? lastPath.timestampMethod : "receiveTime",
              },
            ])
          }
        >
          Add line
        </Button>
      </footer>
    ),
    [classes.addButton, classes.footer, lastPath, localPaths, savePaths],
  );

  const legendContent = useMemo(
    () => (
      <div ref={contentRef} className={classes.legendContent}>
        {legendHeader}
        <div className={classes.grid}>
          {localPaths.map((path: PlotPath, index: number) => (
            <PlotLegendRow
              key={index}
              index={index}
              xAxisVal={xAxisVal}
              path={path}
              paths={localPaths}
              hasMismatchedDataLength={pathsWithMismatchedDataLengths.includes(path.value)}
              datasets={datasets}
              currentTime={currentTime}
              savePaths={savePaths}
              showPlotValuesInLegend={showPlotValuesInLegend}
            />
          ))}
        </div>
        {legendFooter}
      </div>
    ),
    [
      classes.grid,
      classes.legendContent,
      currentTime,
      datasets,
      legendFooter,
      legendHeader,
      localPaths,
      pathsWithMismatchedDataLengths,
      savePaths,
      showPlotValuesInLegend,
      xAxisVal,
    ],
  );

  // Hack to fix nested input scrolling on Linux Chrome. Manually scroll content to the
  // far left or right when the user navigates to the start or end of the
  // message path input.
  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!content) {
      return;
    }

    const listener = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) {
        if (event.target.selectionStart === 0) {
          content.scrollTo(0, 0);
        }
        if (event.target.selectionStart === event.target.value.length) {
          content.scrollTo(content.scrollWidth, 0);
        }
      }
    };

    content.querySelectorAll("input").forEach((input) => {
      input.addEventListener("keydown", listener);
    });

    return () => {
      content.querySelectorAll("input").forEach((input) => {
        input.removeEventListener("keydown", listener);
      });
    };
  }, []);

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
