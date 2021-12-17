// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Dialog, Stack, useTheme } from "@fluentui/react";
import { useCallback, useMemo, useState } from "react";

import { usePlayerSelection } from "@foxglove/studio-base/context/PlayerSelectionContext";

import Connection from "./Connection";
import Remote from "./Remote";
import Start from "./Start";
import { OpenDialogViews } from "./types";
import { useOpenFile } from "./useOpenFile";

type OpenDialogProps = {
  activeView?: OpenDialogViews;
  onDismiss?: () => void;
};

export default function OpenDialog(props: OpenDialogProps): JSX.Element {
  const { activeView: defaultActiveView, onDismiss } = props;
  const { availableSources, selectSource } = usePlayerSelection();

  const [activeView, setActiveView] = useState<OpenDialogViews>(defaultActiveView ?? "start");
  const theme = useTheme();

  const openFile = useOpenFile(availableSources);

  const firstSampleSource = useMemo(() => {
    return availableSources.find((source) => source.type === "sample");
  }, [availableSources]);

  const onSelectView = useCallback(
    (view: OpenDialogViews) => {
      if (view === "file") {
        openFile().catch((err) => {
          console.error(err);
        });
        return;
      }

      if (view === "demo" && firstSampleSource) {
        selectSource(firstSampleSource.id);
      }

      setActiveView(view);
    },
    [firstSampleSource, openFile, selectSource],
  );

  const allExtensions = useMemo(() => {
    return availableSources.reduce((all, source) => {
      if (!source.supportedFileTypes) {
        return all;
      }

      return [...all, ...source.supportedFileTypes];
    }, [] as string[]);
  }, [availableSources]);

  // connectionSources is the list of availableSources supporting "connections"
  const connectionSources = useMemo(() => {
    return availableSources.filter((source) => {
      return source.type === "connection" && source.hidden !== true;
    });
  }, [availableSources]);

  const remoteFileSources = useMemo(() => {
    return availableSources.filter((source) => source.type === "remote-file");
  }, [availableSources]);

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
          component: (
            <Connection
              onBack={() => onSelectView("start")}
              onCancel={onDismiss}
              availableSources={connectionSources}
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
          component: <Start onSelectView={onSelectView} supportedFileExtensions={allExtensions} />,
        };
    }
  }, [activeView, allExtensions, connectionSources, onDismiss, onSelectView, remoteFileSources]);

  return (
    <Dialog
      hidden={false}
      maxWidth={800}
      minWidth={800}
      modalProps={{
        layerProps: {
          eventBubblingEnabled: true,
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
            overflow: "hidden",
            height: 480,
            display: "flex",
            flexDirection: "column",
            padding: theme.spacing.l1,

            "@media (max-height: 512px)": { overflowY: "auto" },
          },
          inner: {
            flex: 1,
            display: "flex",
            flexDirection: "column",

            "@media (min-height: 512px)": { overflow: "hidden" },
          },
          innerContent: {
            height: "100%",
            display: "flex",
            flexDirection: "column",
            flex: 1,

            "@media (min-height: 512px)": { overflow: "hidden" },
          },
        },
      }}
    >
      <Stack
        grow
        verticalFill
        verticalAlign="space-between"
        tokens={{ childrenGap: theme.spacing.m }}
      >
        {view.component}
      </Stack>
    </Dialog>
  );
}
