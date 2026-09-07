/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { H265 } from "@lichtblick/den/video";
import { MessageEvent } from "@lichtblick/suite";
import MessageEventBuilder from "@lichtblick/suite-base/testing/builders/MessageEventBuilder";

import { GetBackfillMessagesArgs } from "./IIterableSource";
import {
  MAX_SEEK_BACKFILL_VIDEO_GOP_MESSAGES,
  expandVideoSeekBackfill,
  needsGopBackfill,
  messageKey,
  readVideoGopForSeekTarget,
} from "./videoSeekBackfill";

afterEach(() => {
  jest.restoreAllMocks();
});

describe("needsGopBackfill", () => {
  it("rejects messages with the wrong schema name", () => {
    // Given
    const message = MessageEventBuilder.messageEvent({
      topic: "video",
      schemaName: "something.else",
      receiveTime: { sec: 0, nsec: 0 },
      message: { format: "h265", data: new Uint8Array([0x01]) },
      sizeInBytes: 1,
    });

    // When
    const result = needsGopBackfill(message);

    // Then
    expect(result).toBe(false);
  });

  it("accepts inter-frame-dependent video codecs (H.264 and H.265, including the 'hevc' alias)", () => {
    // H.264 belongs here too: a seek that lands on a P-frame is not decodable without the
    // preceding GOP, so backfill is required at the player/source boundary even though the
    // renderable doesn't serialize its decoder submissions for H.264 during normal playback.
    // Given
    const h264 = MessageEventBuilder.messageEvent({
      topic: "video",
      schemaName: "foxglove.CompressedVideo",
      receiveTime: { sec: 0, nsec: 0 },
      message: { format: "h264", data: new Uint8Array([0x01]) },
      sizeInBytes: 1,
    });
    const h265 = MessageEventBuilder.messageEvent({
      topic: "video",
      schemaName: "foxglove.CompressedVideo",
      receiveTime: { sec: 0, nsec: 0 },
      message: { format: "h265", data: new Uint8Array([0x01]) },
      sizeInBytes: 1,
    });
    const hevc = MessageEventBuilder.messageEvent({
      topic: "video",
      schemaName: "foxglove.CompressedVideo",
      receiveTime: { sec: 0, nsec: 0 },
      message: { format: "hevc", data: new Uint8Array([0x02]) },
      sizeInBytes: 1,
    });

    // When
    const h264Result = needsGopBackfill(h264);
    const h265Result = needsGopBackfill(h265);
    const hevcResult = needsGopBackfill(hevc);

    // Then
    expect(h264Result).toBe(true);
    expect(h265Result).toBe(true);
    expect(hevcResult).toBe(true);
  });

  it("rejects unrecognized codecs and non-Uint8Array payloads", () => {
    // Given
    const vp9 = MessageEventBuilder.messageEvent({
      topic: "video",
      schemaName: "foxglove.CompressedVideo",
      receiveTime: { sec: 0, nsec: 0 },
      message: { format: "vp9", data: new Uint8Array() },
      sizeInBytes: 1,
    });
    const invalidData = MessageEventBuilder.messageEvent({
      topic: "video",
      schemaName: "foxglove.CompressedVideo",
      receiveTime: { sec: 0, nsec: 0 },
      message: { format: "h265", data: "nope" },
      sizeInBytes: 1,
    });

    // When
    const vp9Result = needsGopBackfill(vp9);
    const invalidDataResult = needsGopBackfill(invalidData);

    // Then
    expect(vp9Result).toBe(false);
    expect(invalidDataResult).toBe(false);
  });
});

describe("messageKey", () => {
  it("encodes topic and receive time", () => {
    // Given
    const message = MessageEventBuilder.messageEvent({
      topic: "/cam",
      schemaName: "foxglove.CompressedVideo",
      receiveTime: { sec: 5, nsec: 123 },
      message: { format: "h265", data: new Uint8Array([0x01]) },
      sizeInBytes: 1,
    });

    // When
    const key = messageKey(message);

    // Then
    expect(key).toBe("/cam:5:123");
  });
});

describe("readVideoGopForSeekTarget", () => {
  it("returns the GOP from the closest preceding keyframe to the target, in order", async () => {
    // Given
    const target = MessageEventBuilder.messageEvent({
      topic: "video",
      schemaName: "foxglove.CompressedVideo",
      receiveTime: { sec: 0, nsec: 30 },
      message: { format: "h265", data: new Uint8Array([0x01]) },
      sizeInBytes: 1,
    });
    const delta1 = MessageEventBuilder.messageEvent({
      topic: "video",
      schemaName: "foxglove.CompressedVideo",
      receiveTime: { sec: 0, nsec: 20 },
      message: { format: "h265", data: new Uint8Array([0x02]) },
      sizeInBytes: 1,
    });
    const keyframe = MessageEventBuilder.messageEvent({
      topic: "video",
      schemaName: "foxglove.CompressedVideo",
      receiveTime: { sec: 0, nsec: 10 },
      message: { format: "h265", data: new Uint8Array([0x03]) },
      sizeInBytes: 1,
    });

    const sequence = [target, delta1, keyframe];
    const getBackfillMessages = jest.fn(
      async () => [sequence.shift()].filter((m) => m) as MessageEvent[],
    );
    jest
      .spyOn(H265, "IsKeyframe")
      .mockImplementation(
        (data: Uint8Array) => data === (keyframe.message as { data: Uint8Array }).data,
      );

    // When
    const result = await readVideoGopForSeekTarget(target, getBackfillMessages, () => undefined);

    // Then
    expect(result.map((m) => m.receiveTime.nsec)).toEqual([10, 20, 30]);
    expect(getBackfillMessages).toHaveBeenCalledTimes(3);
  });

  it("returns empty when the source returns no candidate", async () => {
    // Given
    const target = MessageEventBuilder.messageEvent({
      topic: "video",
      schemaName: "foxglove.CompressedVideo",
      receiveTime: { sec: 0, nsec: 0 },
      message: { format: "h265", data: new Uint8Array([0x01]) },
      sizeInBytes: 1,
    });
    const getBackfillMessages = jest.fn(async () => []);
    jest.spyOn(H265, "IsKeyframe").mockReturnValue(false);

    // When
    const result = await readVideoGopForSeekTarget(target, getBackfillMessages, () => undefined);

    // Then
    expect(result).toEqual([]);
  });

  it("returns empty when the source returns a non-H.265 candidate", async () => {
    // Given
    const target = MessageEventBuilder.messageEvent({
      topic: "video",
      schemaName: "foxglove.CompressedVideo",
      receiveTime: { sec: 0, nsec: 0 },
      message: { format: "h265", data: new Uint8Array([0x01]) },
      sizeInBytes: 1,
    });
    const getBackfillMessages = jest.fn(async () => [
      MessageEventBuilder.messageEvent({
        topic: "video",
        schemaName: "other",
        receiveTime: { sec: 0, nsec: 0 },
        message: { format: "h265", data: new Uint8Array([0x01]) },
        sizeInBytes: 1,
      }),
    ]);
    jest.spyOn(H265, "IsKeyframe").mockReturnValue(false);

    // When
    const result = await readVideoGopForSeekTarget(target, getBackfillMessages, () => undefined);

    // Then
    expect(result).toEqual([]);
  });

  it("returns empty if the same candidate is seen twice (would loop)", async () => {
    // Given
    const target = MessageEventBuilder.messageEvent({
      topic: "video",
      schemaName: "foxglove.CompressedVideo",
      receiveTime: { sec: 5, nsec: 100 },
      message: { format: "h265", data: new Uint8Array([0x01]) },
      sizeInBytes: 1,
    });
    const getBackfillMessages = jest.fn(async () => [
      MessageEventBuilder.messageEvent({
        topic: "video",
        schemaName: "foxglove.CompressedVideo",
        receiveTime: { sec: 5, nsec: 100 },
        message: { format: "h265", data: new Uint8Array([0x02]) },
        sizeInBytes: 1,
      }),
    ]);
    jest.spyOn(H265, "IsKeyframe").mockReturnValue(false);

    // When
    const result = await readVideoGopForSeekTarget(target, getBackfillMessages, () => undefined);

    // Then
    expect(result).toEqual([]);
  });

  it("returns empty when stepping back below time zero", async () => {
    // Given
    const target = MessageEventBuilder.messageEvent({
      topic: "video",
      schemaName: "foxglove.CompressedVideo",
      receiveTime: { sec: 0, nsec: 0 },
      message: { format: "h265", data: new Uint8Array([0x01]) },
      sizeInBytes: 1,
    });
    const getBackfillMessages = jest.fn(async () => [
      MessageEventBuilder.messageEvent({
        topic: "video",
        schemaName: "foxglove.CompressedVideo",
        receiveTime: { sec: 0, nsec: 0 },
        message: { format: "h265", data: new Uint8Array([0x02]) },
        sizeInBytes: 1,
      }),
    ]);
    jest.spyOn(H265, "IsKeyframe").mockReturnValue(false);

    // When
    const result = await readVideoGopForSeekTarget(target, getBackfillMessages, () => undefined);

    // Then
    expect(result).toEqual([]);
  });

  it("aborts after MAX_SEEK_BACKFILL_VIDEO_GOP_MESSAGES iterations", async () => {
    // Given
    let counter = 0;
    const getBackfillMessages = jest.fn(async () => [
      MessageEventBuilder.messageEvent({
        topic: "video",
        schemaName: "foxglove.CompressedVideo",
        receiveTime: { sec: 1, nsec: ++counter * 1000 },
        message: { format: "h265", data: new Uint8Array([0x01]) },
        sizeInBytes: 1,
      }),
    ]);
    jest.spyOn(H265, "IsKeyframe").mockReturnValue(false);

    const target = MessageEventBuilder.messageEvent({
      topic: "video",
      schemaName: "foxglove.CompressedVideo",
      receiveTime: { sec: 1, nsec: (MAX_SEEK_BACKFILL_VIDEO_GOP_MESSAGES + 5) * 1000 },
      message: { format: "h265", data: new Uint8Array([0x01]) },
      sizeInBytes: 1,
    });

    // When
    const result = await readVideoGopForSeekTarget(target, getBackfillMessages, () => undefined);

    // Then
    expect(result).toEqual([]);
    expect(getBackfillMessages).toHaveBeenCalledTimes(MAX_SEEK_BACKFILL_VIDEO_GOP_MESSAGES);
  });

  it("forwards the abort signal from the getter on each call", async () => {
    // Given
    const target = MessageEventBuilder.messageEvent({
      topic: "video",
      schemaName: "foxglove.CompressedVideo",
      receiveTime: { sec: 0, nsec: 0 },
      message: { format: "h265", data: new Uint8Array([0x01]) },
      sizeInBytes: 1,
    });
    const keyframe = MessageEventBuilder.messageEvent({
      topic: "video",
      schemaName: "foxglove.CompressedVideo",
      receiveTime: { sec: 0, nsec: 10 },
      message: { format: "h265", data: new Uint8Array([0x02]) },
      sizeInBytes: 1,
    });
    const getBackfillMessages = jest.fn(async (_args: GetBackfillMessagesArgs) => [keyframe]);
    jest.spyOn(H265, "IsKeyframe").mockReturnValue(true);
    const controller = new AbortController();

    // When
    await readVideoGopForSeekTarget(target, getBackfillMessages, () => controller.signal);

    // Then
    expect(getBackfillMessages.mock.calls[0]?.[0].abortSignal).toBe(controller.signal);
  });
});

describe("expandVideoSeekBackfill", () => {
  it("passes through unrecognized formats and keyframes unchanged", async () => {
    // Given
    const otherFormat = MessageEventBuilder.messageEvent({
      topic: "video",
      schemaName: "foxglove.CompressedVideo",
      receiveTime: { sec: 0, nsec: 1 },
      message: { format: "vp9", data: new Uint8Array([0x01]) },
      sizeInBytes: 1,
    });
    const keyframe = MessageEventBuilder.messageEvent({
      topic: "video",
      schemaName: "foxglove.CompressedVideo",
      receiveTime: { sec: 0, nsec: 2 },
      message: { format: "h265", data: new Uint8Array([0x02]) },
      sizeInBytes: 1,
    });
    jest.spyOn(H265, "IsKeyframe").mockReturnValue(true);
    const getBackfillMessages = jest.fn(async () => []);

    // When
    const result = await expandVideoSeekBackfill(
      [otherFormat, keyframe],
      getBackfillMessages,
      () => undefined,
    );

    // Then
    expect(result.map((m) => m.receiveTime.nsec)).toEqual([1, 2]);
    expect(getBackfillMessages).not.toHaveBeenCalled();
  });

  it("expands a P frame with its preceding GOP and dedupes by message key", async () => {
    // Given
    const keyframe = MessageEventBuilder.messageEvent({
      topic: "video",
      schemaName: "foxglove.CompressedVideo",
      receiveTime: { sec: 0, nsec: 10 },
      message: { format: "h265", data: new Uint8Array([0x03]) },
      sizeInBytes: 1,
    });
    const delta1 = MessageEventBuilder.messageEvent({
      topic: "video",
      schemaName: "foxglove.CompressedVideo",
      receiveTime: { sec: 0, nsec: 20 },
      message: { format: "h265", data: new Uint8Array([0x02]) },
      sizeInBytes: 1,
    });
    const target = MessageEventBuilder.messageEvent({
      topic: "video",
      schemaName: "foxglove.CompressedVideo",
      receiveTime: { sec: 0, nsec: 30 },
      message: { format: "h265", data: new Uint8Array([0x01]) },
      sizeInBytes: 1,
    });
    const sequence = [target, delta1, keyframe];

    const getBackfillMessages = jest.fn(
      async () => [sequence.shift()].filter((m) => m) as MessageEvent[],
    );
    jest
      .spyOn(H265, "IsKeyframe")
      .mockImplementation(
        (data: Uint8Array) => data === (keyframe.message as { data: Uint8Array }).data,
      );

    // When
    const result = await expandVideoSeekBackfill([target], getBackfillMessages, () => undefined);

    // Then
    expect(result.map((m) => m.receiveTime.nsec)).toEqual([10, 20, 30]);
  });

  it("returns sorted output when expansion mixes new and original messages", async () => {
    // Given
    const keyframe = MessageEventBuilder.messageEvent({
      topic: "video",
      schemaName: "foxglove.CompressedVideo",
      receiveTime: { sec: 0, nsec: 5 },
      message: { format: "h265", data: new Uint8Array([0x02]) },
      sizeInBytes: 1,
    });
    const target = MessageEventBuilder.messageEvent({
      topic: "video",
      schemaName: "foxglove.CompressedVideo",
      receiveTime: { sec: 0, nsec: 30 },
      message: { format: "h265", data: new Uint8Array([0x01]) },
      sizeInBytes: 1,
    });

    let firstCall = true;
    const getBackfillMessages = jest.fn(async () => {
      if (firstCall) {
        firstCall = false;
        return [keyframe];
      }
      return [];
    });
    jest
      .spyOn(H265, "IsKeyframe")
      .mockImplementation(
        (data: Uint8Array) => data === (keyframe.message as { data: Uint8Array }).data,
      );

    // When
    const result = await expandVideoSeekBackfill([target], getBackfillMessages, () => undefined);

    // Then
    expect(result.map((m) => m.receiveTime.nsec)).toEqual([5, 30]);
  });
});
