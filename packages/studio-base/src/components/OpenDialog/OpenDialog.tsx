// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Dialog, useTheme } from "@fluentui/react";
import { Stack } from "@mui/material";
import { useCallback, useLayoutEffect, useMemo, useState } from "react";
import { useMountedState } from "react-use";

import { useDialogHostId } from "@foxglove/studio-base/context/DialogHostIdContext";
import {
  IDataSourceFactory,
  usePlayerSelection,
} from "@foxglove/studio-base/context/PlayerSelectionContext";

import Connection from "./Connection";
import Remote from "./Remote";
import Start from "./Start";
import { OpenDialogViews } from "./types";
import { useOpenFile } from "./useOpenFile";

type OpenDialogProps = {
  activeView?: OpenDialogViews;
  activeDataSource?: IDataSourceFactory;
  onDismiss?: () => void;
};

export default function OpenDialog(props: OpenDialogProps): JSX.Element {
  const { activeView: defaultActiveView, onDismiss, activeDataSource } = props;
  const { availableSources, selectSource } = usePlayerSelection();

  const isMounted = useMountedState();
  const [activeView, setActiveView] = useState<OpenDialogViews>(defaultActiveView ?? "start");
  const theme = useTheme();

  const openFile = useOpenFile(availableSources);
  const hostId = useDialogHostId();

  const firstSampleSource = useMemo(() => {
    return availableSources.find((source) => source.type === "sample");
  }, [availableSources]);

  useLayoutEffect(() => {
    setActiveView(defaultActiveView ?? "start");
  }, [defaultActiveView]);

  const onSelectView = useCallback((view: OpenDialogViews) => {
    setActiveView(view);
  }, []);

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

  const remoteFileSources = useMemo(() => {
    return availableSources.filter((source) => source.type === "remote-file");
  }, [availableSources]);

  const view = useMemo(() => {
    const supportedLocalFileTypes = localFileSources.flatMap(
      (source) => source.supportedFileTypes ?? [],
    );
    const supportedRemoteFileTypes = remoteFileSources.flatMap(
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
              onCancel={onDismiss}
              availableSources={connectionSources}
              activeSource={activeDataSource}
            />
          ),
        };
      case "remote":
        return {
          title: "Open a file from a remote location",
          component: (
            <Remote
              onBack={() => onSelectView("start")}
              onCancel={onDismiss}
              availableSources={remoteFileSources}
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
              supportedRemoteFileExtensions={supportedRemoteFileTypes}
            />
          ),
        };
    }
  }, [
    activeDataSource,
    activeView,
    connectionSources,
    localFileSources,
    onDismiss,
    onSelectView,
    remoteFileSources,
  ]);

  return (
    <Dialog
      hidden={false}
      maxWidth="calc(min(800px, 100% - 32px))"
      modalProps={{
        layerProps: {
          // We enable event bubbling so a user can drag&drop files or folders onto the app even when
          // the dialog is shown.
          eventBubblingEnabled: true,
          hostId,
        },
        styles: {
          main: {
            display: "flex",
            flexDirection: "column",
          },
          scrollableContent: {
            display: "flex",
            flexDirection: "column",
          },
        },
      }}
      onDismiss={onDismiss}
      dialogContentProps={{
        showCloseButton: true,
        title: view.title,
        styles: {
          content: {
            overflow: "visible",
            display: "flex",
            flexDirection: "column",
            // Keep a consistent height for the dialog so changing views does not change the height
            flexBasis: 520,
            maxHeight: 520,
            padding: theme.spacing.l1,
          },
          inner: {
            flex: 1,
            display: "flex",
            flexDirection: "column",
          },
          innerContent: {
            height: "100%",
            display: "flex",
            flexDirection: "column",
            flex: 1,
          },
        },
      }}
    >
      <Stack flexGrow={1} height="100%" justifyContent="space-between" spacing={2}>
        {view.component}
      </Stack>
    </Dialog>
  );
}
