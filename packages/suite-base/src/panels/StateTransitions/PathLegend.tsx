// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Add16Regular, Dismiss12Regular } from "@fluentui/react-icons";
import { Button, ButtonGroup, Stack } from "@mui/material";
import { MouseEvent, useCallback } from "react";
import { useTranslation } from "react-i18next";

import { usePanelContext } from "@lichtblick/suite-base/components/PanelContext";
import { useSelectedPanels } from "@lichtblick/suite-base/context/CurrentLayoutContext";
import { useWorkspaceActions } from "@lichtblick/suite-base/context/Workspace/useWorkspaceActions";
import useStyles from "@lichtblick/suite-base/panels/StateTransitions/PathLegend.style";
import { DEFAULT_STATE_TRANSITION_PATH } from "@lichtblick/suite-base/panels/StateTransitions/constants";
import { stateTransitionPathDisplayName } from "@lichtblick/suite-base/panels/StateTransitions/shared";
import {
  PathLegendProps,
  StateTransitionPath,
} from "@lichtblick/suite-base/panels/StateTransitions/types";

export const PathLegend = React.memo(function PathLegend(props: PathLegendProps) {
  const { t } = useTranslation("stateTransitions");
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

  const handleEditTopic = useCallback(
    (index: number) => {
      setSelectedPanelIds([panelId]);
      openPanelSettings();
      setFocusedPath(["paths", String(index)]);
    },
    [openPanelSettings, panelId, setFocusedPath, setSelectedPanelIds],
  );

  return (
    <Stack className={classes.chartOverlay} position="absolute" paddingTop={0.5}>
      {(paths.length === 0 ? [DEFAULT_STATE_TRANSITION_PATH] : paths).map(
        (path: StateTransitionPath, index: number) => (
          <div
            data-testid={`row-${index}`}
            className={classes.row}
            key={index}
            style={{ height: heightPerTopic }}
          >
            <ButtonGroup
              size="small"
              color="inherit"
              variant="contained"
              className={classes.buttonGroup}
            >
              <Button
                data-testid={`edit-topic-button-${index}`}
                endIcon={paths.length === 0 && <Add16Regular />}
                onClick={() => {
                  handleEditTopic(index);
                }}
              >
                {paths.length === 0
                  ? t("addSeriesButton")
                  : stateTransitionPathDisplayName(path, index)}
              </Button>
              {paths.length > 0 && (
                <Button
                  data-testid={`delete-topic-button-${index}`}
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
        ),
      )}
    </Stack>
  );
});
