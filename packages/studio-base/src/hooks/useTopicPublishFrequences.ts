// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useMemo, useRef } from "react";

import { areEqual, fromMillis, Time, toSec } from "@foxglove/rostime";
import { Immutable } from "@foxglove/studio";
import {
  MessagePipelineContext,
  useMessagePipeline,
} from "@foxglove/studio-base/components/MessagePipeline";
import { subtractTimes } from "@foxglove/studio-base/players/UserScriptPlayer/transformerWorker/typescript/userUtils/time";
import { PlayerCapabilities, TopicStats } from "@foxglove/studio-base/players/types";

const EMPTY_TOPIC_STATS = new Map<string, TopicStats>();

// Empirically this seems to strike a good balance between stable values
// and reasonably quick reactions to change.
function smoothValues(oldValue: undefined | number, newValue: number): number {
  return 0.7 * (oldValue ?? newValue) + 0.3 * newValue;
}

function calculateStaticItemFrequency(
  numMessages: number,
  firstMessageTime: undefined | Time,
  lastMessageTime: undefined | Time,
  duration: Time,
): undefined | number {
  // Message count but no timestamps, use the full connection duration
  if (firstMessageTime == undefined || lastMessageTime == undefined) {
    const durationSec = toSec(duration);
    if (durationSec > 0) {
      return numMessages / durationSec;
    } else {
      return undefined;
    }
  }

  // Not enough messages or time span to calculate a frequency
  if (numMessages < 2 || areEqual(firstMessageTime, lastMessageTime)) {
    return undefined;
  }

  const topicDurationSec = toSec(subtractTimes(lastMessageTime, firstMessageTime));
  if (topicDurationSec > 0) {
    return (numMessages - 1) / topicDurationSec;
  } else {
    return undefined;
  }
}

function calculateLiveItemFrequency(numMessages: number, duration: Time) {
  const durationSec = toSec(duration);

  return durationSec > 0 ? numMessages / durationSec : undefined;
}

const selectCurrentTime = ({ playerState }: MessagePipelineContext) =>
  playerState.activeData?.currentTime;
const selectStartTime = ({ playerState }: MessagePipelineContext) =>
  playerState.activeData?.startTime;
const selectEndTime = ({ playerState }: MessagePipelineContext) => playerState.activeData?.endTime;
const selectTopicStats = (ctx: MessagePipelineContext) =>
  ctx.playerState.activeData?.topicStats ?? EMPTY_TOPIC_STATS;
const selectPlayerCapabilities = (ctx: MessagePipelineContext) => ctx.playerState.capabilities;

type StatSample = {
  time: Time;
  count: number;
  frequency: undefined | number;
};

type FrequenciesByTopic = Record<string, undefined | number>;
const EMPTY_FREQUENCIES: FrequenciesByTopic = {};

/**
 * Encapsulates logic for directly updating topic stats DOM elements, bypassing
 * react for performance. To use this component mount it directly under your component
 * containing topics you want to update. Tag each topic stat field with data-topic
 * and data-topic-stat attributes.
 *
 * @property interval - the interval, in frames, between updates.
 */
export function useTopicPublishFrequencies(): Immutable<FrequenciesByTopic> {
  const playerCurrentTime = useMessagePipeline(selectCurrentTime);
  const startTime = useMessagePipeline(selectStartTime);
  const endTime = useMessagePipeline(selectEndTime);
  const topicStats = useMessagePipeline(selectTopicStats);
  const playerCapabilities = useMessagePipeline(selectPlayerCapabilities);
  const duration = useMemo(
    () => (endTime && startTime ? subtractTimes(endTime, startTime) : { sec: 0, nsec: 0 }),
    [endTime, startTime],
  );

  const samplesByTopic = useRef<Record<string, StatSample>>({});

  const playerIsStaticSource = useMemo(
    () => playerCapabilities.includes(PlayerCapabilities.playbackControl),
    [playerCapabilities],
  );

  const frequencies = useMemo(() => {
    if (!playerCurrentTime) {
      return EMPTY_FREQUENCIES;
    }
    const currentTime = fromMillis(Date.now());

    const result: FrequenciesByTopic = {};
    for (const [topic, stat] of topicStats) {
      if (playerIsStaticSource) {
        // For a static source we calculate frequency across all messages.
        const frequency = calculateStaticItemFrequency(
          stat.numMessages,
          stat.firstMessageTime,
          stat.lastMessageTime,
          duration,
        );
        result[topic] = frequency;
      } else {
        // For a live source we calculate a running average of frequency.
        const sample = samplesByTopic.current[topic];
        if (sample == undefined) {
          samplesByTopic.current[topic] = {
            time: currentTime,
            count: stat.numMessages,
            frequency: undefined,
          };
        } else {
          const messageDelta = stat.numMessages - sample.count;
          if (messageDelta > 0) {
            const timeDelta = subtractTimes(currentTime, sample.time);
            const newFrequency = calculateLiveItemFrequency(messageDelta, timeDelta);
            if (newFrequency != undefined) {
              const smoothedFrequency = smoothValues(sample.frequency, newFrequency);
              sample.frequency = smoothedFrequency;
              sample.count = stat.numMessages;
              sample.time = currentTime;
            }
          }
          result[topic] = sample.frequency;
        }
      }
    }

    return result;
  }, [playerCurrentTime, duration, playerIsStaticSource, topicStats]);

  return frequencies;
}
