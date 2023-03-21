// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ErrorCircle16Filled, Square24Filled, Square24Regular } from "@fluentui/react-icons";
import { Checkbox, Tooltip, Typography } from "@mui/material";
import { ComponentProps, useMemo, useState } from "react";
import { makeStyles } from "tss-react/mui";
import { v4 as uuidv4 } from "uuid";

import { usePanelContext } from "@foxglove/studio-base/components/PanelContext";
import TimeBasedChart from "@foxglove/studio-base/components/TimeBasedChart";
import { useSelectedPanels } from "@foxglove/studio-base/context/CurrentLayoutContext";
import { useHoverValue } from "@foxglove/studio-base/context/TimelineInteractionStateContext";
import { useWorkspaceActions } from "@foxglove/studio-base/context/WorkspaceContext";
import { plotPathDisplayName } from "@foxglove/studio-base/panels/Plot/types";
import { getLineColor } from "@foxglove/studio-base/util/plotColors";
import { fonts } from "@foxglove/studio-base/util/sharedStyleConstants";

import { PlotPath } from "./internalTypes";

type PlotLegendRowProps = {
  currentTime?: number;
  datasets: ComponentProps<typeof TimeBasedChart>["data"]["datasets"];
  hasMismatchedDataLength: boolean;
  index: number;
  onClickPath: () => void;
  path: PlotPath;
  paths: PlotPath[];
  savePaths: (paths: PlotPath[]) => void;
  showPlotValuesInLegend: boolean;
};

const ROW_HEIGHT = 28;

const useStyles = makeStyles<void, "plotName">()((theme, _params, classes) => ({
  root: {
    display: "contents",
    cursor: "pointer",

    "&:hover": {
      "& > *:last-child": {
        opacity: 1,
      },
      "& > *": {
        backgroundColor: theme.palette.background.paper,
        backgroundImage: `linear-gradient(${[
          "0deg",
          theme.palette.action.focus,
          theme.palette.action.focus,
        ].join(" ,")})`,
      },
    },
  },
  showPlotValue: {
    [`.${classes.plotName}`]: {
      gridColumn: "span 1",
    },
  },
  listIcon: {
    display: "flex",
    alignItems: "center",
    position: "sticky",
    height: ROW_HEIGHT,
    left: 0,
  },
  checkbox: {
    fontSize: "1em",
    padding: theme.spacing(0.975),
    borderRadius: 0,

    "svg:not(.MuiSvgIcon-root)": {
      fontSize: "1em",
    },
  },
  disabledPathLabel: {
    opacity: 0.5,
  },
  plotName: {
    display: "flex",
    alignItems: "center",
    height: ROW_HEIGHT,
    padding: theme.spacing(0, 1.5, 0, 0.5),
    gridColumn: "span 2",
    fontFeatureSettings: `${fonts.SANS_SERIF_FEATURE_SETTINGS}, "zero"`,

    ".MuiTypography-root": {
      whiteSpace: "nowrap",
    },
  },
  plotValue: {
    display: "flex",
    alignItems: "center",
    height: ROW_HEIGHT,
    padding: theme.spacing(0.25, 1, 0.25, 0.25),
  },
  errorIcon: {
    color: theme.palette.error.main,
  },
}));

export function PlotLegendRow({
  currentTime,
  datasets,
  hasMismatchedDataLength,
  index,
  onClickPath,
  path,
  paths,
  savePaths,
  showPlotValuesInLegend,
}: PlotLegendRowProps): JSX.Element {
  const { openPanelSettings } = useWorkspaceActions();
  const { id: panelId } = usePanelContext();
  const { setSelectedPanelIds } = useSelectedPanels();
  const { classes, cx } = useStyles();

  const correspondingData = useMemo(() => {
    if (!showPlotValuesInLegend) {
      return [];
    }
    return datasets.find((set) => set.label === path.value)?.data ?? [];
  }, [datasets, path.value, showPlotValuesInLegend]);

  const [hoverComponentId] = useState<string>(() => uuidv4());
  const hoverValue = useHoverValue({
    componentId: hoverComponentId,
    isTimestampScale: true,
  });

  const currentValue = useMemo(() => {
    if (!showPlotValuesInLegend) {
      return undefined;
    }
    const timeToCompare = hoverValue?.value ?? currentTime;

    let value;
    for (const pt of correspondingData) {
      if (timeToCompare == undefined || pt == undefined || pt.x > timeToCompare) {
        break;
      }
      value = pt.y;
    }
    return value;
  }, [showPlotValuesInLegend, hoverValue?.value, currentTime, correspondingData]);

  return (
    <div
      className={cx(classes.root, {
        [classes.showPlotValue]: showPlotValuesInLegend,
      })}
      onClick={() => {
        setSelectedPanelIds([panelId]);
        openPanelSettings();
        onClickPath();
      }}
    >
      <div className={classes.listIcon}>
        <Checkbox
          className={classes.checkbox}
          checked={path.enabled}
          size="small"
          title="Toggle visibility"
          style={{ color: getLineColor(path.color, index) }}
          icon={<Square24Regular />}
          checkedIcon={<Square24Filled />}
          onChange={(event) => {
            event.stopPropagation();

            const newPaths = paths.slice();
            const newPath = newPaths[index];

            if (newPath) {
              newPaths[index] = { ...newPath, enabled: !newPath.enabled };
            }
            savePaths(newPaths);
          }}
        />
      </div>
      <div
        className={classes.plotName}
        style={{ gridColumn: !showPlotValuesInLegend ? "span 2" : undefined }}
      >
        <Typography
          noWrap={showPlotValuesInLegend}
          flex="auto"
          variant="body2"
          className={cx({ [classes.disabledPathLabel]: !path.enabled })}
        >
          {plotPathDisplayName(path, index)}
        </Typography>
        {hasMismatchedDataLength && (
          <Tooltip
            placement="top"
            title="Mismatch in the number of elements in x-axis and y-axis messages"
          >
            <ErrorCircle16Filled className={classes.errorIcon} />
          </Tooltip>
        )}
      </div>
      {showPlotValuesInLegend && (
        <div className={classes.plotValue}>
          <Typography
            variant="body2"
            align="right"
            color={hoverValue?.value != undefined ? "warning.main" : "text.secondary"}
          >
            {currentValue ?? ""}
          </Typography>
        </div>
      )}
    </div>
  );
}
