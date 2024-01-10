// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Add16Regular, Dismiss12Regular } from "@fluentui/react-icons";
import { Button, ButtonGroup, Stack, buttonClasses } from "@mui/material";
import { MouseEvent, useCallback } from "react";
import tinycolor from "tinycolor2";
import { makeStyles } from "tss-react/mui";

import { usePanelContext } from "@foxglove/studio-base/components/PanelContext";
import { useSelectedPanels } from "@foxglove/studio-base/context/CurrentLayoutContext";
import { useWorkspaceActions } from "@foxglove/studio-base/context/Workspace/useWorkspaceActions";
import { DEFAULT_PATH } from "@foxglove/studio-base/panels/Plot/settings";
import { stateTransitionPathDisplayName } from "@foxglove/studio-base/panels/StateTransitions/shared";
import {
  StateTransitionConfig,
  StateTransitionPath,
} from "@foxglove/studio-base/panels/StateTransitions/types";
import { SaveConfig } from "@foxglove/studio-base/types/panels";

const useStyles = makeStyles()((theme) => ({
  chartOverlay: {
    top: 0,
    left: 0,
    right: 0,
    pointerEvents: "none",
  },
  row: {
    paddingInline: theme.spacing(1, 0.5),
    pointerEvents: "none",
  },
  dismissIcon: {
    paddingInline: theme.spacing(0.5),
    minWidth: "auto !important",
  },
  buttonGroup: {
    minWidth: "auto",
    textAlign: "left",
    pointerEvents: "auto",
    fontWeight: "normal",
    maxWidth: "100%",

    [`.${buttonClasses.root}`]: {
      backgroundColor: tinycolor(theme.palette.background.paper).setAlpha(0.67).toString(),
      paddingBlock: theme.spacing(0.25),
      borderColor: theme.palette.background.paper,

      "&:hover": {
        backgroundImage: `linear-gradient(to right, ${theme.palette.action.hover}, ${theme.palette.action.hover})`,
      },
    },
    [`.${buttonClasses.endIcon}`]: {
      opacity: 0.8,
      marginLeft: theme.spacing(0.5),
      marginRight: theme.spacing(-0.75),
    },
  },
}));

export const PathLegend = React.memo(function PathLegend(props: {
  paths: StateTransitionPath[];
  heightPerTopic: number;
  setFocusedPath: (value: string[] | undefined) => void;
  saveConfig: SaveConfig<StateTransitionConfig>;
}) {
  const { paths, heightPerTopic, setFocusedPath, saveConfig } = props;
  const { setSelectedPanelIds } = useSelectedPanels();
  const { id: panelId } = usePanelContext();
  const { openPanelSettings } = useWorkspaceActions();
  const { classes } = useStyles();

  const handleDeletePath = useCallback(
    (event: MouseEvent<HTMLButtonElement>, index: number) => {
      // Deleting a path is a "quick action" and we want to avoid opening the settings sidebar
      // so whatever sidebar the user is already viewing says active.
      //
      // This prevents the click event from going up to the entire row and showing the sidebar.
      event.stopPropagation();

      const newPaths = paths.slice();
      if (newPaths.length > 0) {
        newPaths.splice(index, 1);
      }
      saveConfig({ paths: newPaths });
    },
    [paths, saveConfig],
  );

  return (
    <Stack className={classes.chartOverlay} position="absolute" paddingTop={0.5}>
      {(paths.length === 0 ? [DEFAULT_PATH] : paths).map((path, index) => (
        <div className={classes.row} key={index} style={{ height: heightPerTopic }}>
          <ButtonGroup
            size="small"
            color="inherit"
            variant="contained"
            className={classes.buttonGroup}
          >
            <Button
              data-testid="edit-topic-button"
              endIcon={paths.length === 0 && <Add16Regular />}
              onClick={() => {
                setSelectedPanelIds([panelId]);
                openPanelSettings();
                setFocusedPath(["paths", String(index)]);
              }}
            >
              {paths.length === 0
                ? "Click to add a series"
                : stateTransitionPathDisplayName(path, index)}
            </Button>
            {paths.length > 0 && (
              <Button
                className={classes.dismissIcon}
                size="small"
                onClick={(event) => {
                  handleDeletePath(event, index);
                }}
              >
                <Dismiss12Regular />
              </Button>
            )}
          </ButtonGroup>
        </div>
      ))}
    </Stack>
  );
});
