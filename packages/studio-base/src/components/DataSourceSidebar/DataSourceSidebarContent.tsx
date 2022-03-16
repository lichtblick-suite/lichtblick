// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Icon, makeStyles, useTheme } from "@fluentui/react";
import { useCallback, useContext } from "react";

import {
  MessagePipelineContext,
  useMessagePipeline,
} from "@foxglove/studio-base/components/MessagePipeline";
import NotificationModal from "@foxglove/studio-base/components/NotificationModal";
import ModalContext from "@foxglove/studio-base/context/ModalContext";
import { PlayerProblem } from "@foxglove/studio-base/players/types";

import { DataSourceInfo } from "./DataSourceInfo";

const selectPlayerProblems = (ctx: MessagePipelineContext) => ctx.playerState.problems;

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

export default function DataSourceSidebarContent(): JSX.Element {
  const modalHost = useContext(ModalContext);
  const theme = useTheme();
  const classes = useStyles();

  const playerProblems = useMessagePipeline(selectPlayerProblems) ?? emptyArray;

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
      <DataSourceInfo />
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
