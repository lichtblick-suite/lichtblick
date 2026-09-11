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
import { useDraggedMessagePath } from "@lichtblick/suite-base/panels/shared/useDraggedMessagePath";
import { useMessagePathDrag } from "@lichtblick/suite-base/services/messagePathDragging";

type PathLegendRowProps = Readonly<{
  path: StateTransitionPath;
  index: number;
  isPlaceholder: boolean;
  heightPerTopic: number;
  onEditTopic: (index: number) => void;
  onDeletePath: (event: MouseEvent<HTMLButtonElement>, index: number) => void;
}>;

function PathLegendRow({
  path,
  index,
  isPlaceholder,
  heightPerTopic,
  onEditTopic,
  onDeletePath,
}: PathLegendRowProps): React.JSX.Element {
  const { t } = useTranslation("stateTransitions");
  const { classes } = useStyles();
  const { id: panelId } = usePanelContext();

  const draggedItem = useDraggedMessagePath(isPlaceholder ? undefined : path.value);
  const { connectDragSource, connectDragPreview, cursor, isDragging } = useMessagePathDrag({
    item: draggedItem ?? {
      path: "",
      rootSchemaName: undefined,
      isTopic: false,
      isLeaf: true,
      topicName: "",
    },
    selected: false,
    sourcePanelId: panelId,
  });

  const dragRef = useCallback(
    (el: HTMLButtonElement | ReactNull) => {
      if (draggedItem == undefined) {
        return;
      }
      connectDragSource(el);
      connectDragPreview(el);
    },
    [connectDragSource, connectDragPreview, draggedItem],
  );

  return (
    <div data-testid={`row-${index}`} className={classes.row} style={{ height: heightPerTopic }}>
      <ButtonGroup size="small" color="inherit" variant="contained" className={classes.buttonGroup}>
        <Button
          ref={dragRef}
          data-testid={`edit-topic-button-${index}`}
          endIcon={isPlaceholder && <Add16Regular />}
          style={{
            opacity: isDragging ? 0.5 : undefined,
            cursor: draggedItem != undefined ? (cursor ?? "grab") : undefined,
          }}
          onClick={() => {
            onEditTopic(index);
          }}
        >
          {isPlaceholder ? t("addSeriesButton") : stateTransitionPathDisplayName(path, index)}
        </Button>
        {!isPlaceholder && (
          <Button
            data-testid={`delete-topic-button-${index}`}
            className={classes.dismissIcon}
            size="small"
            onClick={(event) => {
              onDeletePath(event, index);
            }}
          >
            <Dismiss12Regular />
          </Button>
        )}
      </ButtonGroup>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-shadow
export const PathLegend = React.memo(function PathLegend(props: PathLegendProps) {
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

  const isPlaceholder = paths.length === 0;

  return (
    <Stack className={classes.chartOverlay} position="absolute" paddingTop={0.5}>
      {(isPlaceholder ? [DEFAULT_STATE_TRANSITION_PATH] : paths).map(
        (path: StateTransitionPath, index: number) => (
          <PathLegendRow
            key={index}
            path={path}
            index={index}
            isPlaceholder={isPlaceholder}
            heightPerTopic={heightPerTopic}
            onEditTopic={handleEditTopic}
            onDeletePath={handleDeletePath}
          />
        ),
      )}
    </Stack>
  );
});
