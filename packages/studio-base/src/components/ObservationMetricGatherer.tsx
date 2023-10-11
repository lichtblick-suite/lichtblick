// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useImmer } from "use-immer";

import { toSec } from "@foxglove/rostime";
import {
  MessagePipelineContext,
  useMessagePipeline,
} from "@foxglove/studio-base/components/MessagePipeline";
import { useAnalytics } from "@foxglove/studio-base/context/AnalyticsContext";
import { AppEvent } from "@foxglove/studio-base/services/IAnalytics";

const selectHasNoPlayerErrors = (ctx: MessagePipelineContext) =>
  ctx.playerState.problems?.find((prob) => prob.severity === "error") == undefined;

const selectHasAtLeastOneSubscription = (ctx: MessagePipelineContext) =>
  ctx.subscriptions.length > 0;

const selectIsSampleData = (ctx: MessagePipelineContext) =>
  ctx.playerState.urlState?.sourceId === "sample-nuscenes";

const selectCurrentTime = (ctx: MessagePipelineContext) => ctx.playerState.activeData?.currentTime;

const selectSeekTime = (ctx: MessagePipelineContext) => ctx.playerState.activeData?.lastSeekTime;

type State = {
  currentTime: undefined | number;
  hasReportedObservationOrActivation: boolean;
  seekTime: undefined | number;
};

/**
 * Gathers and reports observation metrics.
 */
export function ObservationMetricGatherer(): ReactNull {
  const [state, setState] = useImmer<State>({
    currentTime: undefined,
    hasReportedObservationOrActivation: false,
    seekTime: undefined,
  });

  const analytics = useAnalytics();
  const isSampleData = useMessagePipeline(selectIsSampleData);
  const hasAtLeastOneSubscription = useMessagePipeline(selectHasAtLeastOneSubscription);
  const hasNoPlayerErrors = useMessagePipeline(selectHasNoPlayerErrors);
  const currentTime = useMessagePipeline(selectCurrentTime);
  const seekTime = useMessagePipeline(selectSeekTime);

  if (seekTime == undefined || currentTime == undefined) {
    return ReactNull;
  }

  if (state.hasReportedObservationOrActivation) {
    return ReactNull;
  }

  // If seek time changes reset our time calculation.
  if (seekTime !== state.seekTime) {
    setState((draft) => {
      draft.currentTime = toSec(currentTime);
      draft.seekTime = seekTime;
    });
    return ReactNull;
  }

  const played5SecOrMore =
    state.currentTime != undefined && toSec(currentTime) - state.currentTime > 5;

  if (played5SecOrMore && hasAtLeastOneSubscription && hasNoPlayerErrors) {
    void analytics.logEvent(AppEvent.USER_OBSERVATION, { isSampleData });
    void analytics.logEvent(AppEvent.USER_ACTIVATION, { isSampleData });
    setState((draft) => {
      draft.hasReportedObservationOrActivation = true;
    });
  }

  return ReactNull;
}
