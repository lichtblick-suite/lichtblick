// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useEffect, useRef } from "react";

import Logger from "@lichtblick/log";
import {
  MessagePipelineContext,
  useMessagePipeline,
} from "@lichtblick/suite-base/components/MessagePipeline";
import {
  AgentChatState,
  useAgentChat,
} from "@lichtblick/suite-base/context/AgentChatContext";
import {
  PlayerPresence,
  PlayerURLState,
} from "@lichtblick/suite-base/players/types";

const log = Logger.getLogger(__filename);

const selectPlayerId = ({ playerState }: MessagePipelineContext) =>
  playerState.playerId;
const selectPlayerPresence = ({ playerState }: MessagePipelineContext) =>
  playerState.presence;
const selectActiveData = ({ playerState }: MessagePipelineContext) =>
  playerState.activeData;
const selectPlayerUrlState = ({ playerState }: MessagePipelineContext) =>
  playerState.urlState;
const selectSessionId = (state: AgentChatState) => state.sessionId;

type WaitingRequest = NonNullable<AgentChatState["waitingRequest"]>;
type NotifyCatalogReady = (requestId: string) => void;
type WaitingObservation = {
  baselinePlayerId: string | undefined;
  notified: boolean;
  request: WaitingRequest;
};

const selectWaitingRequest = (state: AgentChatState) => state.waitingRequest;
const selectNotifyCatalogReady = (state: AgentChatState): NotifyCatalogReady =>
  state.actions.notifyCatalogReady;

function stringArraysEqual(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function playerMatchesWaitingRequest(
  urlState: PlayerURLState | undefined,
  waitingRequest: WaitingRequest,
): boolean {
  if (urlState?.sourceId !== "remote-file") {
    return false;
  }

  const playerUrls = urlState.parameters?.urls;
  if (Array.isArray(playerUrls)) {
    return stringArraysEqual(playerUrls, waitingRequest.urls);
  }

  // Keep this fallback for Player implementations which preserve the original selectSource params
  // instead of RemoteDataSourceFactory's normalized `urls` array.
  const playerUrl = urlState.parameters?.url;
  return (
    typeof playerUrl === "string" && playerUrl === waitingRequest.urls.join(",")
  );
}

export function AgentCatalogWatcher(): null {
  const playerId = useMessagePipeline(selectPlayerId);
  const playerPresence = useMessagePipeline(selectPlayerPresence);
  const activeData = useMessagePipeline(selectActiveData);
  const playerUrlState = useMessagePipeline(selectPlayerUrlState);
  const sessionId = useAgentChat(selectSessionId);
  const waitingRequest = useAgentChat(selectWaitingRequest);
  const notifyCatalogReady = useAgentChat(selectNotifyCatalogReady);

  const lastObservedPlayerId = useRef(playerId);
  const observedSessionId = useRef(sessionId);
  const waitingObservations = useRef(new Map<string, WaitingObservation>());

  useEffect(() => {
    const previousPlayerId = lastObservedPlayerId.current;
    lastObservedPlayerId.current = playerId;

    if (observedSessionId.current !== sessionId) {
      observedSessionId.current = sessionId;
      waitingObservations.current.clear();
    }

    if (waitingRequest != undefined) {
      const existing = waitingObservations.current.get(
        waitingRequest.requestId,
      );
      if (existing == undefined) {
        // The baseline must be the player from before this waiting intent became observable. The
        // Provider publishes waitingRequest before selectSource, so this remains correct even when
        // the waiting intent and target player are committed in one React batch.
        waitingObservations.current.set(waitingRequest.requestId, {
          baselinePlayerId: previousPlayerId,
          notified: false,
          request: waitingRequest,
        });
      } else {
        existing.request = waitingRequest;
      }
    }

    for (const [requestId, observation] of waitingObservations.current) {
      const playerChanged = playerId !== observation.baselinePlayerId;
      // URL matching rules out unrelated manual source changes and late completion of another
      // request. A manual open of the exact same URL remains indistinguishable until PlayerSelection
      // exposes an operation/player correlation id.
      const playerMatchesRequest = playerMatchesWaitingRequest(
        playerUrlState,
        observation.request,
      );
      if (
        !observation.notified &&
        playerChanged &&
        playerPresence === PlayerPresence.PRESENT &&
        activeData != undefined &&
        playerMatchesRequest
      ) {
        try {
          notifyCatalogReady(requestId);
          observation.notified = true;
        } catch (error) {
          // enabled may be disabled in the same commit that makes the player ready. The Provider
          // rejects that stale action; keep the passive effect from escaping into the React tree.
          log.warn(
            `Ignoring catalog-ready notification after Agent Chat was disabled: ${String(error)}`,
          );
        }
      }
    }
  }, [
    activeData,
    notifyCatalogReady,
    playerId,
    playerPresence,
    playerUrlState,
    sessionId,
    waitingRequest,
  ]);

  return null;
}
