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
 * frame that legitimately appears in both. Keyed on topic + receive time: within a single video
 * topic, compressed-video frames are emitted at strictly increasing, distinct receive times, so two
 * entries sharing this key are necessarily the same logical frame. (A genuine topic + exact-time
 * collision with differing content would imply a malformed stream and is not a case we support.)
 */
export function messageKey(message: MessageEvent): string {
  return `${message.topic}:${message.receiveTime.sec}:${message.receiveTime.nsec}`;
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
  const topicSelection = new Map([[targetMessage.topic, { topic: targetMessage.topic }]]);
  const reversedGop: MessageEvent[] = [];
  const seenKeys = new Set<string>();
  let searchTime = targetMessage.receiveTime;

  for (let step = 0; step < MAX_SEEK_BACKFILL_VIDEO_GOP_MESSAGES; step++) {
    const [candidate] = await getBackfillMessages({
      topics: topicSelection,
      time: searchTime,
      abortSignal: getAbortSignal(),
    });
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
  const expandedMessages = new Map(messages.map((message) => [messageKey(message), message]));

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
      expandedMessages.set(messageKey(gopMessage), gopMessage);
    }
  }

  return Array.from(expandedMessages.values()).sort((a, b) =>
    compare(a.receiveTime, b.receiveTime),
  );
}
