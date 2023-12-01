// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  Dismiss12Regular,
  Add12Regular,
  ErrorCircle16Filled,
  Square12Filled,
  Square12Regular,
} from "@fluentui/react-icons";
import { ButtonBase, Checkbox, Tooltip, Typography, buttonBaseClasses } from "@mui/material";
import { MouseEventHandler, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { makeStyles } from "tss-react/mui";
import { v4 as uuidv4 } from "uuid";

import { Immutable } from "@foxglove/studio";
import { iterateTyped } from "@foxglove/studio-base/components/Chart/datasets";
import { usePanelContext } from "@foxglove/studio-base/components/PanelContext";
import { useSelectedPanels } from "@foxglove/studio-base/context/CurrentLayoutContext";
import { useHoverValue } from "@foxglove/studio-base/context/TimelineInteractionStateContext";
import { useWorkspaceActions } from "@foxglove/studio-base/context/Workspace/useWorkspaceActions";
import { plotPathDisplayName } from "@foxglove/studio-base/panels/Plot/types";
import { getLineColor } from "@foxglove/studio-base/util/plotColors";

import { PlotPath, TypedDataSet, TypedData } from "./internalTypes";

type PlotLegendRowProps = Immutable<{
  currentTime?: number;
  datasets: TypedDataSet[];
  hasMismatchedDataLength: boolean;
  index: number;
  onClickPath: () => void;
  path: PlotPath;
  paths: PlotPath[];
  savePaths: (paths: PlotPath[]) => void;
  showPlotValuesInLegend: boolean;
}>;

export const ROW_HEIGHT = 30;

const useStyles = makeStyles<void, "plotName" | "actionButton">()((theme, _params, classes) => ({
  root: {
    display: "contents",
    cursor: "pointer",

    "&:hover": {
      "& > *": {
        backgroundColor: theme.palette.background.paper,
        backgroundImage: `linear-gradient(${[
          "0deg",
          theme.palette.action.hover,
          theme.palette.action.hover,
        ].join(" ,")})`,
      },
    },
    ":not(:hover)": {
      [`& .${classes.actionButton}`]: {
        opacity: 0,
      },
    },
  },
  showPlotValue: {
    [`.${classes.plotName}`]: {
      gridColumn: "span 1",
      padding: theme.spacing(0, 1.5, 0, 0.5),
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
    height: ROW_HEIGHT,
    width: ROW_HEIGHT,
    borderRadius: 0,

    ":hover": {
      backgroundColor: theme.palette.action.hover,
    },
  },
  disabledPathLabel: {
    opacity: 0.5,
  },
  plotName: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    justifySelf: "stretch",
    gap: theme.spacing(0.5),
    height: ROW_HEIGHT,
    paddingInline: theme.spacing(0.75, 2.5),
    gridColumn: "span 2",
    fontFeatureSettings: `${theme.typography.fontFeatureSettings}, "zero"`,

    ".MuiTypography-root": {
      whiteSpace: "nowrap",
    },
  },
  plotValue: {
    display: "flex",
    alignItems: "center",
    justifySelf: "stretch",
    height: ROW_HEIGHT,
    padding: theme.spacing(0.25, 1, 0.25, 0.25),
    whiteSpace: "pre-wrap",
  },
  errorIcon: {
    color: theme.palette.error.main,
  },
  actionButton: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    position: "sticky",
    right: 0,

    [`.${buttonBaseClasses.root}`]: {
      height: ROW_HEIGHT,
      width: ROW_HEIGHT,

      ":hover": {
        backgroundColor: theme.palette.action.hover,
      },
    },
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
  const { t } = useTranslation("plot");

  const correspondingData = useMemo(() => {
    if (!showPlotValuesInLegend) {
      return [];
    }
    return datasets[index]?.data ?? [];
  }, [datasets, index, showPlotValuesInLegend]);

  const [hoverComponentId] = useState<string>(() => uuidv4());
  const hoverValue = useHoverValue({
    componentId: hoverComponentId,
    disableUpdates: !showPlotValuesInLegend,
    isPlaybackSeconds: true,
  });

  const currentValue = useMemo(() => {
    if (!showPlotValuesInLegend) {
      return undefined;
    }
    const timeToCompare = hoverValue?.value ?? currentTime;

    let value;
    for (const pt of iterateTyped(correspondingData as TypedData[])) {
      if (timeToCompare == undefined || pt.x > timeToCompare) {
        break;
      }
      value = pt.value;
    }
    return value?.toString();
  }, [showPlotValuesInLegend, hoverValue?.value, currentTime, correspondingData]);

  // When there are no series configured we render an extra row to show an "add series" button.
  const isAddSeriesRow = paths.length === 0;

  const handleDeletePath: MouseEventHandler<HTMLButtonElement> = (ev) => {
    // Deleting a path is a "quick action" and we want to avoid opening the settings sidebar
    // so whatever sidebar the user is already viewing says active.
    //
    // This prevents the click event from going up to the entire row and showing the sidebar.
    ev.stopPropagation();

    const newPaths = paths.slice();
    if (newPaths.length > 0) {
      newPaths.splice(index, 1);
    }
    savePaths(newPaths);
  };

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
          icon={<Square12Regular />}
          checkedIcon={<Square12Filled />}
          onClick={(event) => {
            event.stopPropagation();
          }} // prevent toggling from opening settings
          onChange={() => {
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
          {isAddSeriesRow ? t("clickToAddASeries") : plotPathDisplayName(path, index)}
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
            {currentValue && !(+currentValue < 0) && " "}
            {currentValue ?? ""}
          </Typography>
        </div>
      )}
      <div className={classes.actionButton}>
        {index === paths.length ? (
          <ButtonBase title="Add series" aria-label="Add series" onClick={onClickPath}>
            <Add12Regular />
          </ButtonBase>
        ) : (
          <ButtonBase title="Delete series" aria-label="Delete series" onClick={handleDeletePath}>
            <Dismiss12Regular />
          </ButtonBase>
        )}
      </div>
    </div>
  );
}
