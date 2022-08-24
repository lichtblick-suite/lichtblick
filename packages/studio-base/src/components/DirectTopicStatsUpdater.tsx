// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { useLatest } from "react-use";

import { areEqual, Time, toSec } from "@foxglove/rostime";
import {
  MessagePipelineContext,
  useMessagePipeline,
} from "@foxglove/studio-base/components/MessagePipeline";
import { subtractTimes } from "@foxglove/studio-base/players/UserNodePlayer/nodeTransformerWorker/typescript/userUtils/time";
import { TopicStats } from "@foxglove/studio-base/players/types";

const EM_DASH = "\u2014";
const EMPTY_TOPIC_STATS = new Map<string, TopicStats>();

function formatItemFrequency(
  numMessages: number,
  firstMessageTime: undefined | Time,
  lastMessageTime: undefined | Time,
  duration: Time,
) {
  if (firstMessageTime == undefined || lastMessageTime == undefined) {
    // Message count but no timestamps, use the full connection duration
    return `${(numMessages / toSec(duration)).toFixed(2)} Hz`;
  }
  if (numMessages < 2 || areEqual(firstMessageTime, lastMessageTime)) {
    // Not enough messages or time span to calculate a frequency
    return EM_DASH;
  }
  const topicDurationSec = toSec(subtractTimes(lastMessageTime, firstMessageTime));
  return `${((numMessages - 1) / topicDurationSec).toFixed(2)} Hz`;
}

const selectStartTime = ({ playerState }: MessagePipelineContext) =>
  playerState.activeData?.startTime;
const selectEndTime = ({ playerState }: MessagePipelineContext) => playerState.activeData?.endTime;

const selectTopicStats = (ctx: MessagePipelineContext) =>
  ctx.playerState.activeData?.topicStats ?? EMPTY_TOPIC_STATS;

/**
 * Encapsulates logic for directly updating topic stats DOM elements, bypassing
 * react for performance. To use this component mount it directly under your component
 * containing topics you want to update. Tag each topic stat field with data-topic
 * and data-topic-stat attributes.
 *
 * @property interval - the interval, in frames, between updates.
 */
export function DirectTopicStatsUpdater({ interval = 1 }: { interval?: number }): JSX.Element {
  const startTime = useMessagePipeline(selectStartTime);
  const endTime = useMessagePipeline(selectEndTime);
  const topicStats = useMessagePipeline(selectTopicStats);
  const duration = endTime && startTime ? subtractTimes(endTime, startTime) : { sec: 0, nsec: 0 };

  const latestDuration = useLatest(duration);
  const latestStats = useLatest(topicStats);
  const updateCount = useRef(0);
  const rootRef = useRef<HTMLDivElement>(ReactNull);

  const updateStats = useCallback(() => {
    if (!rootRef.current) {
      return;
    }

    rootRef.current.parentElement?.querySelectorAll("[data-topic]").forEach((field) => {
      if (field instanceof HTMLElement && field.dataset.topic) {
        const topic = field.dataset.topic;
        const stat = latestStats.current.get(topic);
        if (field.dataset.topicStat === "count") {
          if (stat) {
            field.innerText = stat.numMessages.toLocaleString();
          } else {
            field.innerText = EM_DASH;
          }
        }
        if (field.dataset.topicStat === "frequency") {
          if (stat) {
            field.innerText = formatItemFrequency(
              stat.numMessages,
              stat.firstMessageTime,
              stat.lastMessageTime,
              latestDuration.current,
            );
          } else {
            field.innerText = EM_DASH;
          }
        }
      }
    });
  }, [latestDuration, latestStats]);

  useEffect(() => {
    if (updateCount.current++ % interval === 0) {
      updateStats();
    }
  }, [updateStats, interval, topicStats]);

  useLayoutEffect(() => {
    updateStats();
  }, [updateStats]);

  return <div ref={rootRef} style={{ display: "none" }} />;
}
