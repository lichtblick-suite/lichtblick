// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import CloseIcon from "@mui/icons-material/Close";
import { Dialog, IconButton } from "@mui/material";
import { useCallback, useLayoutEffect, useMemo, useState } from "react";
import { useMountedState } from "react-use";
import { makeStyles } from "tss-react/mui";

import Snow from "@foxglove/studio-base/components/OpenDialog/Snow";
import Stack from "@foxglove/studio-base/components/Stack";
import { useAnalytics } from "@foxglove/studio-base/context/AnalyticsContext";
import {
  IDataSourceFactory,
  usePlayerSelection,
} from "@foxglove/studio-base/context/PlayerSelectionContext";
import { AppEvent } from "@foxglove/studio-base/services/IAnalytics";

import Connection from "./Connection";
import Start from "./Start";
import { OpenDialogViews } from "./types";
import { useOpenFile } from "./useOpenFile";

export type OpenDialogProps = {
  activeDataSource?: IDataSourceFactory;
  activeView?: OpenDialogViews;
  backdropAnimation?: boolean;
  onDismiss?: () => void;
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

export default function OpenDialog(props: OpenDialogProps): JSX.Element {
  const { activeView: defaultActiveView, onDismiss, activeDataSource, backdropAnimation } = props;
  const { classes } = useStyles();
  const { availableSources, selectSource } = usePlayerSelection();

  const isMounted = useMountedState();
  const [activeView, setActiveView] = useState<OpenDialogViews>(defaultActiveView ?? "start");

  const openFile = useOpenFile(availableSources);

  const firstSampleSource = useMemo(() => {
    return availableSources.find((source) => source.type === "sample");
  }, [availableSources]);

  useLayoutEffect(() => {
    setActiveView(defaultActiveView ?? "start");
  }, [defaultActiveView]);

  const onSelectView = useCallback((view: OpenDialogViews) => {
    setActiveView(view);
  }, []);

  const analytics = useAnalytics();

  const onModalClose = useCallback(() => {
    if (onDismiss) {
      onDismiss();
      void analytics.logEvent(AppEvent.DIALOG_CLOSE, { activeView });
    }
  }, [analytics, activeView, onDismiss]);

  useLayoutEffect(() => {
    if (activeView === "file") {
      openFile()
        .catch((err) => {
          console.error(err);
        })
        .finally(() => {
          // set the view back to start so the user can click to open file again
          if (isMounted()) {
            setActiveView("start");
          }
        });
    } else if (activeView === "demo" && firstSampleSource) {
      selectSource(firstSampleSource.id);
    }
  }, [activeView, firstSampleSource, isMounted, openFile, selectSource]);

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

  // connectionSources is the list of availableSources supporting "connections"
  const connectionSources = useMemo(() => {
    return availableSources.filter((source) => {
      return source.type === "connection" && source.hidden !== true;
    });
  }, [availableSources]);

  const localFileSources = useMemo(() => {
    return availableSources.filter((source) => source.type === "file");
  }, [availableSources]);

  const view = useMemo(() => {
    const supportedLocalFileTypes = localFileSources.flatMap(
      (source) => source.supportedFileTypes ?? [],
    );
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
          component: (
            <Connection
              onBack={() => onSelectView("start")}
              onCancel={onModalClose}
              availableSources={connectionSources}
              activeSource={activeDataSource}
            />
          ),
        };
      default:
        return {
          title: "Get started",
          component: (
            <Start
              onSelectView={onSelectView}
              supportedLocalFileExtensions={supportedLocalFileTypes}
            />
          ),
        };
    }
  }, [
    activeDataSource,
    activeView,
    connectionSources,
    localFileSources,
    onModalClose,
    onSelectView,
  ]);

  return (
    <Dialog
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
