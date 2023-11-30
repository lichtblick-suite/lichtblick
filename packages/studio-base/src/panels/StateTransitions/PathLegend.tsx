// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Add16Filled, Edit16Filled } from "@fluentui/react-icons";
import { Button, Stack, Typography } from "@mui/material";
import tinycolor from "tinycolor2";
import { makeStyles } from "tss-react/mui";

import { usePanelContext } from "@foxglove/studio-base/components/PanelContext";
import { useSelectedPanels } from "@foxglove/studio-base/context/CurrentLayoutContext";
import { useWorkspaceActions } from "@foxglove/studio-base/context/Workspace/useWorkspaceActions";
import { DEFAULT_PATH } from "@foxglove/studio-base/panels/Plot/settings";
import { stateTransitionPathDisplayName } from "@foxglove/studio-base/panels/StateTransitions/shared";
import { StateTransitionPath } from "@foxglove/studio-base/panels/StateTransitions/types";

const useStyles = makeStyles()((theme) => ({
  chartOverlay: {
    top: 0,
    left: 0,
    right: 0,
    pointerEvents: "none",
  },
  row: {
    paddingInline: theme.spacing(0.5),
    pointerEvents: "none",
  },
  button: {
    minWidth: "auto",
    textAlign: "left",
    pointerEvents: "auto",
    fontWeight: "normal",
    padding: theme.spacing(0, 1),
    maxWidth: "100%",

    "&:hover": {
      backgroundColor: tinycolor(theme.palette.background.paper).setAlpha(0.67).toString(),
      backgroundImage: `linear-gradient(to right, ${theme.palette.action.focus}, ${theme.palette.action.focus})`,
    },
    ".MuiButton-endIcon": {
      opacity: 0.8,
      fontSize: 14,
      marginLeft: theme.spacing(0.5),

      svg: {
        fontSize: "1em",
        height: "1em",
        width: "1em",
      },
    },
    ":not(:hover) .MuiButton-endIcon": {
      display: "none",
    },
  },
}));

export const PathLegend = React.memo(function PathLegend(props: {
  paths: StateTransitionPath[];
  heightPerTopic: number;
  setFocusedPath: (value: string[] | undefined) => void;
}) {
  const { paths, heightPerTopic, setFocusedPath } = props;
  const { setSelectedPanelIds } = useSelectedPanels();
  const { id: panelId } = usePanelContext();
  const { openPanelSettings } = useWorkspaceActions();
  const { classes } = useStyles();

  return (
    <Stack className={classes.chartOverlay} position="absolute" paddingTop={0.5}>
      {(paths.length === 0 ? [DEFAULT_PATH] : paths).map((path, index) => (
        <div className={classes.row} key={index} style={{ height: heightPerTopic }}>
          <Button
            size="small"
            color="inherit"
            data-testid="edit-topic-button"
            className={classes.button}
            endIcon={paths.length === 0 ? <Add16Filled /> : <Edit16Filled />}
            onClick={() => {
              setSelectedPanelIds([panelId]);
              openPanelSettings();
              setFocusedPath(["paths", String(index)]);
            }}
          >
            <Typography variant="inherit" noWrap>
              {paths.length === 0
                ? "Click to add a series"
                : stateTransitionPathDisplayName(path, index)}
            </Typography>
          </Button>
        </div>
      ))}
    </Stack>
  );
});
