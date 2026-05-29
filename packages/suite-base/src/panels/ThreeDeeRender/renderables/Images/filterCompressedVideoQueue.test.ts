// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { MessageEvent } from "@lichtblick/suite";
import H265FrameBuilder from "@lichtblick/suite-base/testing/builders/H265FrameBuilder";

import { CompressedVideo } from "./ImageTypes";
import { filterCompressedVideoQueue } from "./filterCompressedVideoQueue";

function videoMessageEvent(
  topic: string,
  message: CompressedVideo,
  receiveSec: number,
): MessageEvent<CompressedVideo> {
  return {
    topic,
    schemaName: "foxglove.CompressedVideo",
    message,
    receiveTime: { sec: receiveSec, nsec: 0 },
    sizeInBytes: message.data.byteLength,
  };
}

// H.264 NAL: the 5th byte is the NAL unit header. 0x41 → type 0x01 (non-IDR slice / delta);
// 0x65 → type 0x05 (IDR slice / keyframe).
function h264Frame(data: number[] = [0x00, 0x00, 0x00, 0x01, 0x41]): CompressedVideo {
  return {
    format: "h264",
    data: new Uint8Array(data),
    frame_id: "camera",
    timestamp: { sec: 0, nsec: 0 },
  };
}

function h264Keyframe(): CompressedVideo {
  return h264Frame([0x00, 0x00, 0x00, 0x01, 0x65]);
}

function h265Keyframe(): CompressedVideo {
  return {
    format: "h265",
    data: H265FrameBuilder.keyframeWithParameterSets(),
    frame_id: "camera",
    timestamp: { sec: 0, nsec: 0 },
  };
}

function h265DeltaFrame(): CompressedVideo {
  return {
    format: "h265",
    data: H265FrameBuilder.deltaFrame(),
    frame_id: "camera",
    timestamp: { sec: 0, nsec: 0 },
  };
}

describe("filterCompressedVideoQueue", () => {
  it("returns the input unchanged when there is at most one message", () => {
    const empty: MessageEvent<CompressedVideo>[] = [];
    expect(filterCompressedVideoQueue(empty)).toEqual([]);

    const single = [videoMessageEvent("/h264", h264Frame(), 1)];
    expect(filterCompressedVideoQueue(single)).toEqual(single);
  });

  it("keeps the H.264 GOP starting from the most recent keyframe", () => {
    // H.264 delta frames depend on the preceding GOP; dropping older queued frames here would
    // leave the decoder unable to produce a picture for the latest delta until the next keyframe,
    // which is exactly the post-seek black-screen symptom we want to avoid.
    const olderDelta = videoMessageEvent("/h264", h264Frame(), 1);
    const key = videoMessageEvent("/h264", h264Keyframe(), 2);
    const deltaA = videoMessageEvent("/h264", h264Frame(), 3);
    const deltaB = videoMessageEvent("/h264", h264Frame(), 4);

    const result = filterCompressedVideoQueue([olderDelta, key, deltaA, deltaB]);

    expect(result).toEqual([key, deltaA, deltaB]);
  });

  it("keeps the full H.264 queue when no keyframe is present yet", () => {
    const deltaA = videoMessageEvent("/h264", h264Frame(), 1);
    const deltaB = videoMessageEvent("/h264", h264Frame(), 2);
    const deltaC = videoMessageEvent("/h264", h264Frame(), 3);

    const result = filterCompressedVideoQueue([deltaA, deltaB, deltaC]);

    expect(result).toEqual([deltaA, deltaB, deltaC]);
  });

  it("falls back to keep-latest for unrecognized codecs", () => {
    const unknown = (recv: number): MessageEvent<CompressedVideo> =>
      videoMessageEvent("/exotic", { ...h264Frame(), format: "vp9" }, recv);
    const result = filterCompressedVideoQueue([unknown(1), unknown(2), unknown(3)]);

    expect(result).toHaveLength(1);
    expect(result[0]!.receiveTime.sec).toBe(3);
  });

  it("keeps the H.265 GOP starting from the most recent keyframe", () => {
    const olderDelta = videoMessageEvent("/h265", h265DeltaFrame(), 1);
    const olderKey = videoMessageEvent("/h265", h265Keyframe(), 2);
    const deltaA = videoMessageEvent("/h265", h265DeltaFrame(), 3);
    const newerKey = videoMessageEvent("/h265", h265Keyframe(), 4);
    const deltaB = videoMessageEvent("/h265", h265DeltaFrame(), 5);
    const deltaC = videoMessageEvent("/h265", h265DeltaFrame(), 6);

    const result = filterCompressedVideoQueue([
      olderDelta,
      olderKey,
      deltaA,
      newerKey,
      deltaB,
      deltaC,
    ]);

    // Latest keyframe + all frames following it are kept; older frames are dropped because
    // their dependency chain has been superseded.
    expect(result).toEqual([newerKey, deltaB, deltaC]);
  });

  it("keeps the full H.265 queue when no keyframe is present yet", () => {
    const deltaA = videoMessageEvent("/h265", h265DeltaFrame(), 1);
    const deltaB = videoMessageEvent("/h265", h265DeltaFrame(), 2);
    const deltaC = videoMessageEvent("/h265", h265DeltaFrame(), 3);

    const result = filterCompressedVideoQueue([deltaA, deltaB, deltaC]);

    expect(result).toEqual([deltaA, deltaB, deltaC]);
  });

  it("normalizes 'hevc' format alias as H.265 (keeps from latest keyframe)", () => {
    const hevcKey: CompressedVideo = { ...h265Keyframe(), format: "hevc" };
    const hevcDelta: CompressedVideo = { ...h265DeltaFrame(), format: "hevc" };
    const oldKey = videoMessageEvent("/hevc", hevcKey, 1);
    const oldDelta = videoMessageEvent("/hevc", hevcDelta, 2);
    const newKey = videoMessageEvent("/hevc", hevcKey, 3);
    const newDelta = videoMessageEvent("/hevc", hevcDelta, 4);

    const result = filterCompressedVideoQueue([oldKey, oldDelta, newKey, newDelta]);

    expect(result).toEqual([newKey, newDelta]);
  });

  it("preserves arrival order across interleaved H.264 and H.265 topics", () => {
    // Interleaved queue: H264 and H265 alternate, simulating multi-topic delivery.
    const h264Delta1 = videoMessageEvent("/h264", h264Frame(), 1);
    const h265Key = videoMessageEvent("/h265", h265Keyframe(), 2);
    const h264Key = videoMessageEvent("/h264", h264Keyframe(), 3);
    const h265Delta1 = videoMessageEvent("/h265", h265DeltaFrame(), 4);
    const h264Delta2 = videoMessageEvent("/h264", h264Frame(), 5);
    const h265Delta2 = videoMessageEvent("/h265", h265DeltaFrame(), 6);

    const result = filterCompressedVideoQueue([
      h264Delta1,
      h265Key,
      h264Key,
      h265Delta1,
      h264Delta2,
      h265Delta2,
    ]);

    // Both /h264 and /h265 keep from their latest keyframe onward. The pre-keyframe h264Delta1
    // is dropped; everything else survives. Output stays sorted by original arrival order.
    expect(result).toEqual([h265Key, h264Key, h265Delta1, h264Delta2, h265Delta2]);
  });

  it("does not mutate the input array", () => {
    const messages = [
      videoMessageEvent("/h264", h264Frame(), 1),
      videoMessageEvent("/h264", h264Frame(), 2),
    ];
    const snapshot = messages.slice();

    filterCompressedVideoQueue(messages);

    expect(messages).toEqual(snapshot);
  });
});
