// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  canonicalVideoCodec,
  isVideoKeyframe,
  videoCodecNeedsSeekBackfill,
} from "@lichtblick/den/video";
import { compare, fromNanoSec, toNanoSec } from "@lichtblick/rostime";
import { MessageEvent } from "@lichtblick/suite";
import { messageChannelId } from "@lichtblick/suite-base/util/channels";
import { COMPRESSED_VIDEO_DATATYPES } from "@lichtblick/suite-base/util/foxgloveSchemas";

import { GetBackfillMessagesArgs } from "./IIterableSource";

export const MAX_SEEK_BACKFILL_VIDEO_GOP_MESSAGES = 2000;

type CompressedVideoLike = {
  data?: Uint8Array;
  format?: string;
};

export type GetBackfillMessages = (args: GetBackfillMessagesArgs) => Promise<MessageEvent[]>;

/**
 * Returns true for a `foxglove.CompressedVideo` message whose codec can only be decoded by
 * replaying the full GOP (the keyframe and every frame after it). H.264 and H.265 both qualify:
 * a seek that lands on a P/B-frame is not decodable without the preceding keyframe and every
 * intervening delta frame, regardless of whether the renderable serializes its decoder
 * submissions at playback time. The codec decision is delegated to
 * {@link videoCodecNeedsSeekBackfill} so this stays codec-agnostic.
 */
export function needsGopBackfill(message: MessageEvent): boolean {
  if (!COMPRESSED_VIDEO_DATATYPES.has(message.schemaName)) {
    return false;
  }
  const video = message.message as CompressedVideoLike;
  return (
    video.data instanceof Uint8Array &&
    videoCodecNeedsSeekBackfill(canonicalVideoCodec(video.format ?? ""))
  );
}

/**
 * Identity used to merge the fetched GOP back into the backfill set, deduplicating the seek-target
 * frame that legitimately appears in both. Video frames have distinct receive times within one
 * channel; different channels can share both a topic and a timestamp. Legacy events without channel
 * IDs use their topic and schema as the stream identity.
 */
export function messageKey(message: MessageEvent): string {
  return JSON.stringify([
    message.topic,
    messageChannelId(message),
    message.receiveTime.sec,
    message.receiveTime.nsec,
  ])!;
}

/**
 * Walk backwards from `targetMessage` until the closest preceding keyframe is found. Returns the
 * GOP slice in receive-time order (keyframe first).
 *
 * Returns an empty array if no keyframe is found within MAX_SEEK_BACKFILL_VIDEO_GOP_MESSAGES, if
 * the source returns a message that does not need GOP backfill, or if a duplicate is encountered
 * (which would otherwise cause an unbounded walk).
 */
export async function readVideoGopForSeekTarget(
  targetMessage: MessageEvent,
  getBackfillMessages: GetBackfillMessages,
  getAbortSignal: () => AbortSignal | undefined,
): Promise<MessageEvent[]> {
  const topicSelection = new Map([
    [
      targetMessage.topic,
      {
        topic: targetMessage.topic,
        channelIds: targetMessage.channelId == undefined ? undefined : [targetMessage.channelId],
      },
    ],
  ]);
  const reversedGop: MessageEvent[] = [];
  const seenKeys = new Set<string>();
  let searchTime = targetMessage.receiveTime;

  for (let step = 0; step < MAX_SEEK_BACKFILL_VIDEO_GOP_MESSAGES; step++) {
    const candidates = await getBackfillMessages({
      topics: topicSelection,
      time: searchTime,
      abortSignal: getAbortSignal(),
    });
    const candidate = candidates.find(
      (message) =>
        message.topic === targetMessage.topic &&
        messageChannelId(message) === messageChannelId(targetMessage),
    );
    if (candidate == undefined || !needsGopBackfill(candidate)) {
      return [];
    }
    const candidateKey = messageKey(candidate);
    if (seenKeys.has(candidateKey)) {
      return [];
    }
    seenKeys.add(candidateKey);

    reversedGop.push(candidate);
    const { data, format } = candidate.message as CompressedVideoLike;
    if (data != undefined && isVideoKeyframe(format ?? "", data)) {
      return reversedGop.reverse();
    }

    const previousTimeNs = toNanoSec(candidate.receiveTime) - 1n;
    if (previousTimeNs < 0n) {
      return [];
    }
    searchTime = fromNanoSec(previousTimeNs);
  }

  // Exhausted the budget without reaching a keyframe; give up rather than expand a partial GOP.
  return [];
}

/**
 * For each non-keyframe in `messages` that belongs to a codec needing GOP replay, fetch the
 * preceding GOP from the source so the decoder can replay from the most recent keyframe. Messages
 * that do not need backfill (other schemas, keyframes, codecs decodable from the latest frame) are
 * passed through unchanged. Output is sorted by receive time.
 */
export async function expandVideoSeekBackfill(
  messages: MessageEvent[],
  getBackfillMessages: GetBackfillMessages,
  getAbortSignal: () => AbortSignal | undefined,
): Promise<MessageEvent[]> {
  // Keep every original event, including non-video events with matching topics and timestamps.
  // Only fetched GOP frames need deduplication against the original backfill and each other.
  const expandedMessages = [...messages];
  const seenKeys = new Set(messages.map(messageKey));

  for (const message of messages) {
    if (!needsGopBackfill(message)) {
      continue;
    }
    const { data, format } = message.message as CompressedVideoLike;
    if (data == undefined || isVideoKeyframe(format ?? "", data)) {
      continue;
    }

    const gopMessages = await readVideoGopForSeekTarget(
      message,
      getBackfillMessages,
      getAbortSignal,
    );
    for (const gopMessage of gopMessages) {
      const key = messageKey(gopMessage);
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        expandedMessages.push(gopMessage);
      }
    }
  }

  return expandedMessages.sort((a, b) => compare(a.receiveTime, b.receiveTime));
}
