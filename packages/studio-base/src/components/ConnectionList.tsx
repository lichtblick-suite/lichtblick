// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ActionButton, Icon, Text, useTheme } from "@fluentui/react";
import { useCallback, useContext } from "react";

import {
  MessagePipelineContext,
  useMessagePipeline,
} from "@foxglove/studio-base/components/MessagePipeline";
import NotificationModal from "@foxglove/studio-base/components/NotificationModal";
import ModalContext from "@foxglove/studio-base/context/ModalContext";
import {
  PlayerSourceDefinition,
  usePlayerSelection,
} from "@foxglove/studio-base/context/PlayerSelectionContext";
import { useConfirm } from "@foxglove/studio-base/hooks/useConfirm";
import { PlayerPresence, PlayerProblem } from "@foxglove/studio-base/players/types";
import { colors } from "@foxglove/studio-base/util/sharedStyleConstants";

const selectPlayerPresence = ({ playerState }: MessagePipelineContext) => playerState.presence;
const selectPlayerProblems = (ctx: MessagePipelineContext) => ctx.playerState.problems;
const selectPlayerName = (ctx: MessagePipelineContext) => ctx.playerState.name;

const emptyArray: PlayerProblem[] = [];

export default function ConnectionList(): JSX.Element {
  const { selectSource, availableSources } = usePlayerSelection();
  const confirm = useConfirm();
  const modalHost = useContext(ModalContext);

  const playerProblems = useMessagePipeline(selectPlayerProblems) ?? emptyArray;
  const playerPresence = useMessagePipeline(selectPlayerPresence);
  const playerName = useMessagePipeline(selectPlayerName);

  const theme = useTheme();

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

  const showProblemModal = useCallback(
    (problem: PlayerProblem) => {
      const remove = modalHost.addModalElement(
        <NotificationModal
          notification={{
            message: problem.message,
            subText: problem.tip,
            details: problem.error,
            severity: problem.severity,
          }}
          onRequestClose={() => remove()}
        />,
      );
    },
    [modalHost],
  );

  return (
    <>
      <Text
        block
        styles={{ root: { color: theme.palette.neutralTertiary, marginBottom: theme.spacing.l1 } }}
      >
        {playerPresence === PlayerPresence.NOT_PRESENT
          ? "Not connected. Choose a data source below to get started."
          : playerName}
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
          case "ros2-socket":
            iconName = "studio.ROS";
            break;
          case "rosbridge-websocket":
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

      {playerProblems.length > 0 && (
        <hr style={{ width: "100%", height: "1px", border: 0, backgroundColor: colors.DIVIDER }} />
      )}
      {playerProblems.map((problem, idx) => {
        const iconName = problem.severity === "error" ? "Error" : "Warning";
        const color =
          problem.severity === "error"
            ? theme.semanticColors.errorBackground
            : theme.semanticColors.warningBackground;
        return (
          <div
            key={idx}
            style={{ color, padding: theme.spacing.s1, cursor: "pointer" }}
            onClick={() => showProblemModal(problem)}
          >
            <Icon iconName={iconName} />
            &nbsp;
            {problem.message}
          </div>
        );
      })}
    </>
  );
}
