// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import CloseIcon from "@mui/icons-material/Close";
import { Dialog, DialogTitle, IconButton, styled as muiStyled } from "@mui/material";
import { useCallback, useLayoutEffect, useMemo, useState } from "react";
import { useMountedState } from "react-use";

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

type OpenDialogProps = {
  activeView?: OpenDialogViews;
  activeDataSource?: IDataSourceFactory;
  onDismiss?: () => void;
};

const StyledDialogTitle = muiStyled(DialogTitle)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: theme.spacing(4, 5, 0, 5),
}));

export default function OpenDialog(props: OpenDialogProps): JSX.Element {
  const { activeView: defaultActiveView, onDismiss, activeDataSource } = props;
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
    onSelectView,
    onModalClose,
  ]);

  return (
    <Dialog
      open
      onClose={onModalClose}
      fullWidth
      maxWidth="md"
      PaperProps={{
        elevation: 4,
        style: { maxWidth: "calc(min(768px, 100% - 32px))" },
      }}
    >
      <StyledDialogTitle>
        {view.title}
        <IconButton onClick={onModalClose} edge="end">
          <CloseIcon />
        </IconButton>
      </StyledDialogTitle>
      <Stack
        flexGrow={1}
        flexBasis={450}
        fullHeight
        justifyContent="space-between"
        gap={2}
        paddingX={5}
        paddingY={3}
      >
        {view.component}
      </Stack>
    </Dialog>
  );
}
