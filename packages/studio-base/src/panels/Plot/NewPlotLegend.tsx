// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import ArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import ArrowLeftIcon from "@mui/icons-material/KeyboardArrowLeft";
import ArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import ArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import ListIcon from "@mui/icons-material/List";
import { SvgIconProps, ToggleButton } from "@mui/material";
import { clamp } from "lodash";
import { ComponentProps, useCallback, useMemo, useRef } from "react";
import tinycolor from "tinycolor2";
import { makeStyles } from "tss-react/mui";

import { PANEL_TOOLBAR_MIN_HEIGHT } from "@foxglove/studio-base/components/PanelToolbar";
import Stack from "@foxglove/studio-base/components/Stack";
import TimeBasedChart from "@foxglove/studio-base/components/TimeBasedChart";
import { NewPlotLegendRow } from "@foxglove/studio-base/panels/Plot/NewPlotLegendRow";
import { PlotPath } from "@foxglove/studio-base/panels/Plot/internalTypes";
import { PlotConfig } from "@foxglove/studio-base/panels/Plot/types";
import { SaveConfig } from "@foxglove/studio-base/types/panels";

const minLegendWidth = 25;
const maxLegendWidth = 800;

type Props = {
  paths: PlotPath[];
  datasets: ComponentProps<typeof TimeBasedChart>["data"]["datasets"];
  currentTime?: number;
  saveConfig: SaveConfig<PlotConfig>;
  showLegend: boolean;
  pathsWithMismatchedDataLengths: string[];
  legendDisplay: "floating" | "top" | "left";
  showPlotValuesInLegend: boolean;
  sidebarDimension: number;
};

type StyleProps = {
  legendDisplay: Props["legendDisplay"];
  sidebarDimension: Props["sidebarDimension"];
};

const useStyles = makeStyles<StyleProps, "container" | "toggleButton">()(
  ({ palette, shape, spacing, typography }, _params, classes) => ({
    root: {
      display: "flex",
      overflow: "hidden",
    },
    rootFloating: {
      pointerEvents: "none",
      gap: spacing(0.5),
      borderRadius: shape.borderRadius,
      position: "absolute",
      top: spacing(5.25),
      left: spacing(4),
      zIndex: 1000,
      backgroundColor: "transparent",
      alignItems: "flex-start",
      height: `calc(100% - ${PANEL_TOOLBAR_MIN_HEIGHT}px - ${spacing(5.25)})`,
      overflow: "hidden",

      [`.${classes.container}`]: {
        pointerEvents: "auto",
        backgroundImage: `linear-gradient(${[
          "0deg",
          tinycolor(palette.background.default).setAlpha(0.2).toHex8String(),
          tinycolor(palette.background.default).setAlpha(0.2).toHex8String(),
        ].join(" ,")})`,
        backgroundColor: tinycolor(palette.background.paper).setAlpha(0.8).toHex8String(),
      },

      [`.${classes.toggleButton}`]: {
        pointerEvents: "auto",
        backgroundColor: tinycolor(palette.background.paper).setAlpha(0.8).toHex8String(),
        backgroundImage: `linear-gradient(${[
          "0deg",
          tinycolor(palette.background.default).setAlpha(0.2).toHex8String(),
          tinycolor(palette.background.default).setAlpha(0.2).toHex8String(),
        ].join(" ,")})`,

        "&:hover":
          palette.mode === "dark"
            ? {
                backgroundImage: `linear-gradient(0deg, ${[
                  tinycolor(palette.background.default).setAlpha(0.2).toHex8String(),
                  tinycolor(palette.background.default).setAlpha(0.2).toHex8String(),
                ].join(",")}),
                linear-gradient(0deg, ${[palette.action.hover, palette.action.hover].join(",")})`,
                backgroundColor: tinycolor(palette.background.paper).setAlpha(0.8).toHex8String(),
              }
            : {
                backgroundColor: palette.background.paper,
              },
      },
    },
    rootLeft: {
      alignItems: "flex-start",

      [`.${classes.toggleButton}`]: {
        height: "100%",
      },
    },
    rootTop: {
      flexDirection: "column",
    },
    container: {
      alignItems: "center",
      overflow: "auto",
      display: "grid",
      gridTemplateColumns: "auto minmax(max-content, 1fr) 1fr auto",
    },
    dragHandle: {
      userSelect: "none",
      border: `0px solid ${palette.action.hover}`,

      "&:hover": {
        borderColor: palette.action.selected,
      },
    },
    toggleButton: {
      fontSize: typography.pxToRem(20),
      padding: spacing(0.5),
      border: "none",
    },
  }),
);

export function NewPlotLegend(props: Props): JSX.Element {
  const {
    paths,
    saveConfig,
    datasets,
    currentTime,
    legendDisplay,
    pathsWithMismatchedDataLengths,
    sidebarDimension,
    showLegend,
    showPlotValuesInLegend,
  } = props;
  const { classes, cx } = useStyles({ legendDisplay, sidebarDimension });

  const toggleLegend = useCallback(
    () => saveConfig({ showLegend: !showLegend }),
    [showLegend, saveConfig],
  );

  const toggleIcon = useMemo(() => {
    const iconProps = {
      fontSize: "inherit",
    } as Partial<SvgIconProps>;

    switch (legendDisplay) {
      case "floating":
        return <ListIcon {...iconProps} />;
      case "left":
        return showLegend ? <ArrowLeftIcon {...iconProps} /> : <ArrowRightIcon {...iconProps} />;
      case "top":
        return showLegend ? <ArrowUpIcon {...iconProps} /> : <ArrowDownIcon {...iconProps} />;
    }
  }, [legendDisplay, showLegend]);

  const dragStart = useRef({ x: 0, y: 0, sidebarDimension: 0 });

  const handlePointerMove = useCallback(
    (event: React.PointerEvent) => {
      if (legendDisplay === "floating" || event.buttons !== 1) {
        return;
      }
      const delta =
        legendDisplay === "left"
          ? event.clientX - dragStart.current.x
          : event.clientY - dragStart.current.y;
      const newDimension = clamp(
        dragStart.current.sidebarDimension + delta,
        minLegendWidth,
        maxLegendWidth,
      );
      saveConfig({ sidebarDimension: newDimension });
    },
    [legendDisplay, saveConfig],
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent) => {
      event.currentTarget.setPointerCapture(event.pointerId);
      dragStart.current = { x: event.clientX, y: event.clientY, sidebarDimension };
    },
    [sidebarDimension],
  );

  const handlePointerUp = useCallback((event: React.PointerEvent) => {
    event.currentTarget.releasePointerCapture(event.pointerId);
  }, []);

  const savePaths = useCallback(
    (newPaths: PlotPath[]) => {
      saveConfig({ paths: newPaths });
    },
    [saveConfig],
  );

  return (
    <div
      className={cx(classes.root, {
        [classes.rootFloating]: legendDisplay === "floating",
        [classes.rootLeft]: legendDisplay === "left",
        [classes.rootTop]: legendDisplay === "top",
      })}
    >
      <Stack
        direction={legendDisplay === "top" ? "column" : "row"}
        alignItems={legendDisplay === "floating" ? "flex-start" : undefined}
        gap={0.5}
        fullHeight
      >
        <ToggleButton
          className={classes.toggleButton}
          aria-label={showLegend ? "Show legend" : "Hide legend"}
          value={showLegend ? "show" : "hide"}
          onClick={toggleLegend}
          size="small"
        >
          {toggleIcon}
        </ToggleButton>
        {showLegend && (
          <Stack
            flexGrow={1}
            gap={0.5}
            overflow="auto"
            fullHeight={legendDisplay === "floating"}
            style={{
              height: legendDisplay === "top" ? Math.round(sidebarDimension) : undefined,
              width: legendDisplay === "left" ? Math.round(sidebarDimension) : undefined,
            }}
          >
            <Stack
              flex="auto"
              fullWidth
              fullHeight={legendDisplay === "floating"}
              overflow={legendDisplay === "floating" ? "auto" : undefined}
            >
              <div className={classes.container}>
                {paths.map((path, index) => (
                  <NewPlotLegendRow
                    key={index}
                    index={index}
                    path={path}
                    paths={paths}
                    hasMismatchedDataLength={pathsWithMismatchedDataLengths.includes(path.value)}
                    datasets={datasets}
                    currentTime={currentTime}
                    savePaths={savePaths}
                    showPlotValuesInLegend={showPlotValuesInLegend}
                  />
                ))}
              </div>
            </Stack>
          </Stack>
        )}
        {legendDisplay !== "floating" && (
          <div
            className={classes.dragHandle}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            style={
              legendDisplay === "left"
                ? {
                    marginLeft: -6,
                    cursor: "ew-resize",
                    borderRightWidth: 2,
                    height: "100%",
                    width: 4,
                  }
                : {
                    marginTop: -6,
                    cursor: "ns-resize",
                    borderBottomWidth: 2,
                    width: "100%",
                    height: 4,
                  }
            }
          />
        )}
      </Stack>
    </div>
  );
}
