// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as _ from "lodash-es";

import { canonicalVideoCodec, VideoCodec } from "@lichtblick/den/video";
import { MessageEvent } from "@lichtblick/suite";

import { CompressedVideo } from "./ImageTypes";
import { isCompressedVideoKeyframe } from "./decodeImage";

/**
 * Filters the per-frame queue for the `CompressedVideo` subscription.
 *
 * Codecs whose delta frames depend on a preceding GOP (H.264 and H.265) need the entire chain
 * from the most recent keyframe through the latest delta preserved — dropping older queued frames
 * leaves the decoder unable to produce a picture for the new latest frame until the next
 * keyframe arrives (which can be several seconds away for typical recordings, and is exactly the
 * post-seek "black screen / garbled image" symptom the GOP backfill in `videoSeekBackfill.ts`
 * also addresses). For codecs without inter-frame dependencies (or unrecognized formats), only
 * the newest message is needed — matching the long-standing `onlyLastByTopicMessage` behavior.
 *
 * The relative order of the kept messages is preserved so downstream handlers see the stream in
 * the same order it arrived.
 */
export function filterCompressedVideoQueue(
  msgs: MessageEvent<CompressedVideo>[],
): MessageEvent<CompressedVideo>[] {
  if (msgs.length <= 1) {
    return msgs;
  }

  const originalIndex = new Map<MessageEvent<CompressedVideo>, number>();
  msgs.forEach((msg, index) => originalIndex.set(msg, index));

  const msgsByTopic = _.groupBy(msgs, (msg) => msg.topic);
  const kept: MessageEvent<CompressedVideo>[] = Object.values(msgsByTopic).flatMap(filterTopic);

  kept.sort((a, b) => (originalIndex.get(a) ?? 0) - (originalIndex.get(b) ?? 0));
  return kept;
}

function filterTopic(topicMsgs: MessageEvent<CompressedVideo>[]): MessageEvent<CompressedVideo>[] {
  const latest = topicMsgs.at(-1);
  if (latest == undefined) {
    return [];
  }
  // Format is constant per topic — resolve once for the whole group
  const codec = canonicalVideoCodec(latest.message.format);
  if (codec == undefined) {
    return [latest];
  }
  return keepFromLatestKeyframe(topicMsgs, codec);
}

/**
 * Walk backward for the most recent keyframe; everything from there on must survive so the GOP
 * can be replayed. If we never find one in the queue, keep the entire topic queue — the next
 * keyframe will arrive eventually and we want the intervening frames available.
 */
function keepFromLatestKeyframe(
  topicMsgs: MessageEvent<CompressedVideo>[],
  codec: VideoCodec,
): MessageEvent<CompressedVideo>[] {
  let keyIndex = -1;
  for (let i = topicMsgs.length - 1; i >= 0; i--) {
    if (isCompressedVideoKeyframe(topicMsgs[i]!.message, codec)) {
      keyIndex = i;
      break;
    }
  }
  return topicMsgs.slice(Math.max(keyIndex, 0));
}
