// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as _ from "lodash-es";

import { MessageEvent } from "@lichtblick/suite";

import { CompressedVideo } from "./ImageTypes";
import { VideoCodec, canonicalVideoCodec, isVideoKeyframe } from "./decodeImage";

/**
 * Filters the per-frame queue for the `CompressedVideo` subscription.
 *
 * H.264-style streams can be decoded from the latest frame alone, so for those topics we keep
 * only the newest message — matching the long-standing `onlyLastByTopicMessage` behavior. Naively
 * applying the same rule to H.265 breaks playback: HEVC P-frames depend on the keyframe and the
 * P-frames between it and themselves, so dropping older queued frames leaves the decoder unable
 * to produce a picture until the next keyframe (which can be several seconds later for typical
 * recordings). For HEVC topics we therefore preserve the full GOP — the most recent keyframe and
 * every frame after it — and discard only the frames that precede that keyframe, since their
 * dependency chain has already been superseded.
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
  if (topicMsgs.length === 0) {
    return [];
  }
  const latest = topicMsgs[topicMsgs.length - 1]!;
  const codec = canonicalVideoCodec(latest.message.format);
  if (codec === VideoCodec.H265) {
    return keepFromLatestKeyframe(topicMsgs);
  }
  // H.264 (or unrecognized) — only the most recent message is needed downstream.
  return [latest];
}

/**
 * Walk backward for the most recent keyframe; everything from there on must survive so the GOP
 * can be replayed. If we never find one in the queue, keep the entire topic queue — the next
 * keyframe will arrive eventually and we want the intervening frames available.
 */
function keepFromLatestKeyframe(
  topicMsgs: MessageEvent<CompressedVideo>[],
): MessageEvent<CompressedVideo>[] {
  let keyIndex = -1;
  for (let i = topicMsgs.length - 1; i >= 0; i--) {
    if (isVideoKeyframe(topicMsgs[i]!.message)) {
      keyIndex = i;
      break;
    }
  }
  return topicMsgs.slice(Math.max(keyIndex, 0));
}
