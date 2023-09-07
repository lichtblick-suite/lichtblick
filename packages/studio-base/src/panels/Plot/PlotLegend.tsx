// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  ChevronDown20Regular,
  ChevronUp20Regular,
  ChevronLeft20Regular,
  ChevronRight20Regular,
  TextBulletListLtr20Filled,
  ArrowMinimize24Filled,
} from "@fluentui/react-icons";
import { IconButton } from "@mui/material";
import * as _ from "lodash-es";
import { useCallback, useMemo, useRef } from "react";
import tinycolor from "tinycolor2";
import { makeStyles } from "tss-react/mui";

import { Immutable } from "@foxglove/studio";
import { PANEL_TOOLBAR_MIN_HEIGHT } from "@foxglove/studio-base/components/PanelToolbar";
import Stack from "@foxglove/studio-base/components/Stack";
import { PlotLegendRow } from "@foxglove/studio-base/panels/Plot/PlotLegendRow";
import { PlotPath } from "@foxglove/studio-base/panels/Plot/internalTypes";
import { PlotConfig } from "@foxglove/studio-base/panels/Plot/types";
import { SaveConfig } from "@foxglove/studio-base/types/panels";

import { TypedDataSet } from "./internalTypes";

const minLegendWidth = 25;
const maxLegendWidth = 800;

type Props = Immutable<{
  currentTime?: number;
  datasets: TypedDataSet[];
  legendDisplay: "floating" | "top" | "left";
  onClickPath: (index: number) => void;
  paths: PlotPath[];
  pathsWithMismatchedDataLengths: string[];
  saveConfig: SaveConfig<PlotConfig>;
  showLegend: boolean;
  showPlotValuesInLegend: boolean;
  sidebarDimension: number;
}>;

const useStyles = makeStyles<void, "container" | "toggleButton" | "toggleButtonFloating">()(
  ({ palette, shadows, shape, spacing }, _params, classes) => ({
    root: {
      display: "flex",
      overflow: "hidden",
    },
    rootFloating: {
      padding: spacing(0.75), // pad the container to prevent shadow from being clipped
      pointerEvents: "none",
      gap: spacing(0.75),
      position: "absolute",
      top: spacing(4.5),
      left: spacing(4),
      zIndex: 1000,
      backgroundColor: "transparent",
      alignItems: "flex-start",
      height: `calc(100% - ${PANEL_TOOLBAR_MIN_HEIGHT}px - ${spacing(5.25)})`,
      overflow: "hidden",

      [`.${classes.container}`]: {
        pointerEvents: "auto",
        borderRadius: shape.borderRadius,
        backgroundImage: `linear-gradient(${[
          "0deg",
          tinycolor(palette.background.default).setAlpha(0.2).toHex8String(),
          tinycolor(palette.background.default).setAlpha(0.2).toHex8String(),
        ].join(" ,")})`,
        backgroundColor: tinycolor(palette.background.paper).setAlpha(0.8).toHex8String(),
        backdropFilter: "blur(3px)",
        maxWidth: `calc(100% - ${spacing(1)})`,
        boxShadow: shadows[3],
      },
    },
    rootLeft: {
      alignItems: "flex-start",
      maxWidth: "80%",

      [`.${classes.toggleButton}`]: {
        padding: spacing(0.25),
        height: "100%",
        borderRadius: 0,
        borderTop: "none",
        borderBottom: "none",
      },
      [`.${classes.container}`]: {
        overflow: "auto",
        height: "100%",
        alignContent: "flex-start",
      },
    },
    rootTop: {
      flexDirection: "column",
      maxHeight: "80%",

      [`.${classes.toggleButton}`]: {
        padding: spacing(0.25),
        borderRadius: 0,
        borderRight: "none",
        borderLeft: "none",
      },
    },
    container: {
      alignItems: "center",
      overflow: "auto",
      display: "grid",
      gridTemplateColumns: "auto minmax(0, 1fr) auto",
    },
    dragHandle: {
      userSelect: "none",
      border: `0px solid ${palette.action.hover}`,

      "&:hover": {
        borderColor: palette.action.selected,
      },
    },
    toggleButton: {
      fontSize: "1rem",
      padding: spacing(0.75),

      "svg:not(.MuiSvgIcon-root)": {
        fontSize: "1em",
      },
    },
    toggleButtonFloating: {
      backdropFilter: "blur(3px)",
      pointerEvents: "auto",
      backgroundImage: `linear-gradient(${[
        "0deg",
        tinycolor(palette.background.default).setAlpha(0.2).toHex8String(),
        tinycolor(palette.background.default).setAlpha(0.2).toHex8String(),
      ].join(" ,")})`,
      backgroundColor: tinycolor(palette.background.paper).setAlpha(0.8).toHex8String(),
      boxShadow: shadows[3],

      "&:hover": {
        backgroundColor: palette.background.paper,
        backgroundImage: `linear-gradient(0deg, ${palette.action.hover}, ${palette.action.hover})`,
      },
    },
  }),
);

function PlotLegendComponent(props: Props): JSX.Element {
  const {
    currentTime,
    datasets,
    legendDisplay,
    onClickPath,
    paths,
    pathsWithMismatchedDataLengths,
    saveConfig,
    showLegend,
    showPlotValuesInLegend,
    sidebarDimension,
  } = props;
  const { classes, cx } = useStyles();

  const dragStart = useRef({ x: 0, y: 0, sidebarDimension: 0 });

  const toggleLegend = useCallback(() => {
    saveConfig({ showLegend: !showLegend });
  }, [showLegend, saveConfig]);

  const legendIcon = useMemo(() => {
    switch (legendDisplay) {
      case "floating":
        return showLegend ? <ArrowMinimize24Filled /> : <TextBulletListLtr20Filled />;
      case "left":
        return showLegend ? <ChevronLeft20Regular /> : <ChevronRight20Regular />;
      case "top":
        return showLegend ? <ChevronUp20Regular /> : <ChevronDown20Regular />;
    }
  }, [showLegend, legendDisplay]);

  const handlePointerMove = useCallback(
    (event: React.PointerEvent) => {
      if (legendDisplay === "floating" || event.buttons !== 1) {
        return;
      }
      const delta =
        legendDisplay === "left"
          ? event.clientX - dragStart.current.x
          : event.clientY - dragStart.current.y;
      const newDimension = _.clamp(
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
      <IconButton
        onClick={toggleLegend}
        className={cx(classes.toggleButton, {
          [classes.toggleButtonFloating]: legendDisplay === "floating",
        })}
      >
        {legendIcon}
      </IconButton>
      {showLegend && (
        <Stack
          flexGrow={1}
          gap={0.5}
          overflow="auto"
          fullHeight={legendDisplay !== "top"}
          style={{
            height: legendDisplay === "top" ? Math.round(sidebarDimension) : undefined,
            width: legendDisplay === "left" ? Math.round(sidebarDimension) : undefined,
          }}
        >
          <Stack
            flex="auto"
            fullWidth
            fullHeight={legendDisplay !== "top"}
            overflow={legendDisplay === "floating" ? "auto" : undefined}
          >
            <div className={classes.container}>
              {paths.map((path, index) => (
                <PlotLegendRow
                  currentTime={currentTime}
                  datasets={datasets}
                  hasMismatchedDataLength={pathsWithMismatchedDataLengths.includes(path.value)}
                  index={index}
                  key={index}
                  onClickPath={() => {
                    onClickPath(index);
                  }}
                  path={path}
                  paths={paths}
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
    </div>
  );
}

export const PlotLegend = React.memo(PlotLegendComponent);
