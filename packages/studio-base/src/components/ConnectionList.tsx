// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ActionButton, Text, useTheme } from "@fluentui/react";
import { useCallback } from "react";

import {
  PlayerSourceDefinition,
  usePlayerSelection,
} from "@foxglove/studio-base/context/PlayerSelectionContext";
import { useConfirm } from "@foxglove/studio-base/hooks/useConfirm";

export default function ConnectionList(): JSX.Element {
  const { selectSource, availableSources } = usePlayerSelection();
  const confirm = useConfirm();

  const theme = useTheme();
  const { currentSourceName } = usePlayerSelection();

  const onSourceClick = useCallback(
    (source: PlayerSourceDefinition) => {
      if (source.disabledReason != undefined) {
        void confirm({
          title: "Unsupported Connection",
          prompt: source.disabledReason,
          variant: "primary",
          cancel: false,
        });
        return;
      }

      selectSource(source);
    },
    [confirm, selectSource],
  );

  return (
    <>
      <Text
        block
        styles={{ root: { color: theme.palette.neutralTertiary, marginBottom: theme.spacing.l1 } }}
      >
        {currentSourceName != undefined
          ? currentSourceName
          : "Not connected. Choose a data source below to get started."}
      </Text>
      {availableSources.map((source) => {
        let iconName: RegisteredIconNames;
        switch (source.type) {
          case "ros1-local-bagfile":
            iconName = "OpenFile";
            break;
          case "ros2-local-bagfile":
            iconName = "OpenFolder";
            break;
          case "ros1-socket":
            iconName = "studio.ROS";
            break;
          case "ros1-rosbridge-websocket":
          case "ros2-rosbridge-websocket":
            iconName = "Flow";
            break;
          case "ros1-remote-bagfile":
            iconName = "FileASPX";
            break;
          case "velodyne-device":
            iconName = "GenericScan";
            break;
        }
        return (
          <div key={source.name}>
            <ActionButton
              styles={{
                root: {
                  margin: 0,
                  padding: 0,
                  width: "100%",
                  textAlign: "left",
                  // sources with a disabled reason are clickable to show the reason
                  // a lower opacity makes the option look disabled to avoid drawing attention
                  opacity: source.disabledReason != undefined ? 0.5 : 1,
                },
              }}
              iconProps={{
                iconName,
                styles: { root: { "& span": { verticalAlign: "baseline" } } },
              }}
              onClick={() => onSourceClick(source)}
            >
              {source.name}
            </ActionButton>
          </div>
        );
      })}
    </>
  );
}
