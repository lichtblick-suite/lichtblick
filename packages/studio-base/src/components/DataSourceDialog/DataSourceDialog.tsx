// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import CloseIcon from "@mui/icons-material/Close";
import { Dialog, IconButton } from "@mui/material";
import { useCallback, useLayoutEffect, useMemo } from "react";
import { useMountedState } from "react-use";
import { makeStyles } from "tss-react/mui";

import Snow from "@foxglove/studio-base/components/DataSourceDialog/Snow";
import Stack from "@foxglove/studio-base/components/Stack";
import { useAnalytics } from "@foxglove/studio-base/context/AnalyticsContext";
import { usePlayerSelection } from "@foxglove/studio-base/context/PlayerSelectionContext";
import {
  WorkspaceContextStore,
  useWorkspaceStore,
} from "@foxglove/studio-base/context/Workspace/WorkspaceContext";
import { useWorkspaceActions } from "@foxglove/studio-base/context/Workspace/useWorkspaceActions";
import { AppEvent } from "@foxglove/studio-base/services/IAnalytics";

import Connection from "./Connection";
import Start from "./Start";

const DataSourceDialogItems = ["start", "file", "demo", "remote", "connection"] as const;
export type DataSourceDialogItem = (typeof DataSourceDialogItems)[number];

type DataSourceDialogProps = {
  backdropAnimation?: boolean;
};

const useStyles = makeStyles()((theme) => ({
  paper: {
    maxWidth: `calc(min(${theme.breakpoints.values.md}px, 100% - ${theme.spacing(4)}))`,
  },
  closeButton: {
    position: "absolute",
    right: 0,
    top: 0,
    margin: theme.spacing(3),
  },
}));

const selectDataSourceDialog = (store: WorkspaceContextStore) => store.dialogs.dataSource;

export function DataSourceDialog(props: DataSourceDialogProps): JSX.Element {
  const { backdropAnimation } = props;
  const { classes } = useStyles();
  const { availableSources, selectSource } = usePlayerSelection();
  const { dialogActions } = useWorkspaceActions();
  const { activeDataSource, item: activeView } = useWorkspaceStore(selectDataSourceDialog);

  const isMounted = useMountedState();

  const firstSampleSource = useMemo(() => {
    return availableSources.find((source) => source.type === "sample");
  }, [availableSources]);

  const analytics = useAnalytics();

  const onModalClose = useCallback(() => {
    void analytics.logEvent(AppEvent.DIALOG_CLOSE, { activeDataSource });
    dialogActions.dataSource.close();
  }, [analytics, activeDataSource, dialogActions.dataSource]);

  useLayoutEffect(() => {
    if (activeView === "file") {
      dialogActions.openFile
        .open()
        .catch((err) => {
          console.error(err);
        })
        .finally(() => {
          // set the view back to start so the user can click to open file again
          if (isMounted()) {
            dialogActions.dataSource.open("start");
          }
        });
    } else if (activeView === "demo" && firstSampleSource) {
      selectSource(firstSampleSource.id);
    }
  }, [activeView, dialogActions, firstSampleSource, isMounted, selectSource]);

  const backdrop = useMemo(() => {
    const now = new Date();
    if (backdropAnimation === false) {
      return;
    } else if (now >= new Date(now.getFullYear(), 11, 25)) {
      return <Snow effect="snow" />;
    } else if (now < new Date(now.getFullYear(), 0, 2)) {
      return <Snow effect="confetti" />;
    }
    return;
  }, [backdropAnimation]);

  const view = useMemo(() => {
    switch (activeView) {
      case "demo": {
        return {
          title: "",
          component: <></>,
        };
      }
      case "connection":
        return {
          title: "Open new connection",
          component: <Connection />,
        };
      default:
        return {
          title: "Get started",
          component: <Start />,
        };
    }
  }, [activeView]);

  return (
    <Dialog
      data-testid="DataSourceDialog"
      open
      onClose={onModalClose}
      fullWidth
      maxWidth="lg"
      BackdropProps={{ children: backdrop }}
      PaperProps={{
        square: false,
        elevation: 4,
        className: classes.paper,
      }}
    >
      <IconButton className={classes.closeButton} onClick={onModalClose} edge="end">
        <CloseIcon />
      </IconButton>
      <Stack
        flexGrow={1}
        fullHeight
        justifyContent="space-between"
        overflow={activeView === "connection" ? "hidden" : undefined}
      >
        {view.component}
      </Stack>
    </Dialog>
  );
}
