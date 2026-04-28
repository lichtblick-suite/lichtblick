// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { H265 } from "@lichtblick/den/video";
import { compare, fromNanoSec, toNanoSec } from "@lichtblick/rostime";
import { MessageEvent } from "@lichtblick/suite";

import { GetBackfillMessagesArgs } from "./IIterableSource";

export const FOXGLOVE_COMPRESSED_VIDEO_SCHEMA = "foxglove.CompressedVideo";
export const MAX_SEEK_BACKFILL_VIDEO_GOP_MESSAGES = 2000;

type CompressedVideoLike = {
  data?: Uint8Array;
  format?: string;
};

export type GetBackfillMessages = (args: GetBackfillMessagesArgs) => Promise<MessageEvent[]>;

export function isHevcCompressedVideoMessage(message: MessageEvent): boolean {
  if (message.schemaName !== FOXGLOVE_COMPRESSED_VIDEO_SCHEMA) {
    return false;
  }
  const video = message.message as CompressedVideoLike;
  return (video.format === "h265" || video.format === "hevc") && video.data instanceof Uint8Array;
}

export function messageKey(message: MessageEvent): string {
  return `${message.topic}:${message.receiveTime.sec}:${message.receiveTime.nsec}`;
}

/**
 * Walk backwards from `targetMessage` until the closest preceding H.265 keyframe
 * is found. Returns the GOP slice in receive-time order (keyframe first).
 *
 * Returns an empty array if no keyframe is found within
 * MAX_SEEK_BACKFILL_VIDEO_GOP_MESSAGES, if the source returns a non-HEVC message,
 * or if a duplicate is encountered (which would otherwise cause an infinite loop).
 */
export async function readHevcGopForSeekTarget(
  targetMessage: MessageEvent,
  getBackfillMessages: GetBackfillMessages,
  getAbortSignal: () => AbortSignal | undefined,
): Promise<MessageEvent[]> {
  const topicSelection = new Map([[targetMessage.topic, { topic: targetMessage.topic }]]);
  const reversedGop: MessageEvent[] = [];
  let searchTime = targetMessage.receiveTime;

  for (;;) {
    if (reversedGop.length >= MAX_SEEK_BACKFILL_VIDEO_GOP_MESSAGES) {
      return [];
    }

    const [candidate] = await getBackfillMessages({
      topics: topicSelection,
      time: searchTime,
      abortSignal: getAbortSignal(),
    });
    if (candidate == undefined || !isHevcCompressedVideoMessage(candidate)) {
      return [];
    }
    if (reversedGop.some((message) => messageKey(message) === messageKey(candidate))) {
      return [];
    }

    reversedGop.push(candidate);
    const video = candidate.message as CompressedVideoLike;
    if (H265.IsKeyframe(video.data!)) {
      return reversedGop.reverse();
    }

    const previousTimeNs = toNanoSec(candidate.receiveTime) - 1n;
    if (previousTimeNs < 0n) {
      return [];
    }
    searchTime = fromNanoSec(previousTimeNs);
  }
}

/**
 * For each H.265 P/B-frame in `messages`, fetch the preceding GOP from the source
 * so the decoder can replay from the most recent keyframe. Non-HEVC messages and
 * keyframes are passed through unchanged. Output is sorted by receive time.
 */
export async function expandHevcSeekBackfill(
  messages: MessageEvent[],
  getBackfillMessages: GetBackfillMessages,
  getAbortSignal: () => AbortSignal | undefined,
): Promise<MessageEvent[]> {
  const expandedMessages = new Map(messages.map((message) => [messageKey(message), message]));

  for (const message of messages) {
    if (!isHevcCompressedVideoMessage(message)) {
      continue;
    }
    const video = message.message as CompressedVideoLike;
    if (H265.IsKeyframe(video.data!)) {
      continue;
    }

    const gopMessages = await readHevcGopForSeekTarget(
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
