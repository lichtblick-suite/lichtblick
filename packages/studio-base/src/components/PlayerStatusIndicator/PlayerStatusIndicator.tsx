// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { IconButton, IContextualMenuItem, useTheme } from "@fluentui/react";
import { PropsWithChildren, useCallback, useContext, useMemo } from "react";

import { useShallowMemo } from "@foxglove/hooks";
import {
  MessagePipelineContext,
  useMessagePipeline,
} from "@foxglove/studio-base/components/MessagePipeline";
import NotificationModal from "@foxglove/studio-base/components/NotificationModal";
import { PlayerPrecenceIcon } from "@foxglove/studio-base/components/PlayerStatusIndicator/PlayerPresenceIcon";
import ModalContext from "@foxglove/studio-base/context/ModalContext";
import { PlayerPresence, PlayerProblem } from "@foxglove/studio-base/players/types";

import { Badge } from "./Badge";
import { PresenceToString } from "./PresenceToString";

function selectPlayerPresence(ctx: MessagePipelineContext) {
  return ctx.playerState.presence;
}

function selectPlayerProblems(ctx: MessagePipelineContext) {
  return ctx.playerState.problems;
}

/**
 * PlayerStatusIndicator shows the player presence via an icon button. If there are player problems
 * a badge or icon will appear indicating there are additional items for review.
 *
 * When a user clicks the button, a callout with all player problems appears with details.
 */
export function PlayerStatusIndicator(): JSX.Element {
  const playerPresence = useMessagePipeline(selectPlayerPresence);
  const presenceTitle = PresenceToString(playerPresence);
  const originalPlayerProblems = useMessagePipeline(selectPlayerProblems) ?? [];

  // The playerProblems value from the selector may not change its reference identity when the set
  // of problems changes (problems could be added or removed from the array).
  // Since react hooks check only the top-level object reference identity, we useShallowMemo
  // on a new array of player problems to detect if the content of the player problems has changed.
  const playerProblems = useShallowMemo([...originalPlayerProblems]);

  const theme = useTheme();
  const modalHost = useContext(ModalContext);

  const BadgeContainer = useCallback(
    ({ children }: PropsWithChildren<unknown>) => {
      // if we have problems but are not indicating an error icon, indicate with a badge
      if (
        (playerProblems?.length ?? 0) === 0 ||
        playerPresence === PlayerPresence.ERROR ||
        playerPresence === PlayerPresence.NOT_PRESENT ||
        playerPresence === PlayerPresence.PRESENT
      ) {
        return <>{children}</>;
      }

      return <Badge>{children}</Badge>;
    },
    [playerPresence, playerProblems?.length],
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

  const menuItems = useMemo<IContextualMenuItem[]>(() => {
    return (
      playerProblems?.map((problem, idx) => {
        const iconName = problem.severity === "error" ? "Error" : "Warning";

        const iconColor =
          problem.severity === "error"
            ? theme.semanticColors.errorBackground
            : theme.semanticColors.warningBackground;

        return {
          key: String(idx),
          text: problem.message,
          secondaryText: problem.tip != undefined || problem.error ? "details" : undefined,
          iconProps: { iconName, styles: { root: { color: iconColor } } },
          submenuIconProps: { iconName },
          onClick: () => showProblemModal(problem),
        };
      }) ?? []
    );
  }, [playerProblems, showProblemModal, theme]);

  return (
    <IconButton
      title={presenceTitle}
      onRenderIcon={() => (
        <BadgeContainer>
          <PlayerPrecenceIcon
            presence={playerPresence}
            hasProblems={(playerProblems?.length ?? 0) > 0}
          />
        </BadgeContainer>
      )}
      menuProps={{ items: menuItems }}
      onRenderMenuIcon={() => ReactNull}
    />
  );
}
