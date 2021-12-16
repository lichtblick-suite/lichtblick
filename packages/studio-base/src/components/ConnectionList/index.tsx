// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ActionButton, Icon, makeStyles, Text, useTheme } from "@fluentui/react";
import { useCallback, useContext, useMemo } from "react";

import { AppSetting } from "@foxglove/studio-base/AppSetting";
import {
  MessagePipelineContext,
  useMessagePipeline,
} from "@foxglove/studio-base/components/MessagePipeline";
import NotificationModal from "@foxglove/studio-base/components/NotificationModal";
import ModalContext from "@foxglove/studio-base/context/ModalContext";
import {
  IDataSourceFactory,
  usePlayerSelection,
} from "@foxglove/studio-base/context/PlayerSelectionContext";
import { useAppConfigurationValue } from "@foxglove/studio-base/hooks/useAppConfigurationValue";
import { useConfirm } from "@foxglove/studio-base/hooks/useConfirm";
import { PlayerPresence, PlayerProblem } from "@foxglove/studio-base/players/types";

import { DataSourceInfo } from "./DataSourceInfo";

const selectPlayerPresence = ({ playerState }: MessagePipelineContext) => playerState.presence;
const selectPlayerProblems = (ctx: MessagePipelineContext) => ctx.playerState.problems;
const selectPlayerName = (ctx: MessagePipelineContext) => ctx.playerState.name;

const emptyArray: PlayerProblem[] = [];

const useStyles = makeStyles((theme) => ({
  badge: {
    textTransform: "uppercase",
    fontSize: theme.fonts.small.fontSize,
    fontWeight: 600,
    backgroundColor: theme.palette.themePrimary,
    color: theme.palette.neutralLighterAlt,
    padding: `1px 8px`,
    marginLeft: "10px",
    borderRadius: 100,
  },
  divider: {
    width: "100%",
    height: 1,
    border: 0,
    backgroundColor: theme.semanticColors.bodyDivider,
  },
}));

export default function ConnectionList(): JSX.Element {
  const [enableOpenDialog] = useAppConfigurationValue(AppSetting.OPEN_DIALOG);
  const { selectSource, availableSources } = usePlayerSelection();
  const confirm = useConfirm();
  const modalHost = useContext(ModalContext);
  const theme = useTheme();
  const classes = useStyles();

  const playerProblems = useMessagePipeline(selectPlayerProblems) ?? emptyArray;
  const playerPresence = useMessagePipeline(selectPlayerPresence);
  const playerName = useMessagePipeline(selectPlayerName);

  const onSourceClick = useCallback(
    (source: IDataSourceFactory) => {
      if (source.disabledReason != undefined) {
        void confirm({
          title: "Unsupported data source",
          prompt: source.disabledReason,
          variant: "primary",
          cancel: false,
        });
        return;
      }

      selectSource(source.id);
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

  // When using the open dialog we don't display the available sources items and instead display
  // and open button to open the dialog.
  const sourcesListElements = useMemo(() => {
    if (enableOpenDialog === true) {
      return ReactNull;
    }

    return (
      <>
        <Text
          block
          styles={{
            root: { color: theme.palette.neutralTertiary, marginBottom: theme.spacing.l1 },
          }}
        >
          {playerPresence === PlayerPresence.NOT_PRESENT
            ? "Not connected. Choose a data source below to get started."
            : playerName}
        </Text>
        {availableSources.map((source) => {
          if (source.hidden === true) {
            return ReactNull;
          }

          const iconName: RegisteredIconNames = source.iconName as RegisteredIconNames;
          return (
            <div key={source.id}>
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
                {source.displayName}
                {source.badgeText && <span className={classes.badge}>{source.badgeText}</span>}
              </ActionButton>
            </div>
          );
        })}
      </>
    );
  }, [
    availableSources,
    classes.badge,
    enableOpenDialog,
    onSourceClick,
    playerName,
    playerPresence,
    theme.palette.neutralTertiary,
    theme.spacing.l1,
  ]);

  return (
    <>
      {sourcesListElements}
      {enableOpenDialog === true && <DataSourceInfo />}
      {playerProblems.length > 0 && <hr className={classes.divider} />}
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
