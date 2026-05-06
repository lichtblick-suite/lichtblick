/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { H265 } from "@lichtblick/den/video";
import { MessageEvent } from "@lichtblick/suite";

import { GetBackfillMessagesArgs } from "./IIterableSource";
import {
  FOXGLOVE_COMPRESSED_VIDEO_SCHEMA,
  MAX_SEEK_BACKFILL_VIDEO_GOP_MESSAGES,
  expandH265SeekBackfill,
  isH265CompressedVideoMessage,
  messageKey,
  readH265GopForSeekTarget,
} from "./h265SeekBackfill";

function makeMessage(
  override: Partial<MessageEvent> & { topic?: string; sec?: number; nsec?: number } = {},
): MessageEvent {
  const { sec = 0, nsec = 0, topic = "video", ...rest } = override;
  return {
    topic,
    schemaName: FOXGLOVE_COMPRESSED_VIDEO_SCHEMA,
    receiveTime: { sec, nsec },
    message: { format: "h265", data: new Uint8Array([0x01]) },
    sizeInBytes: 1,
    ...rest,
  } as MessageEvent;
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe("isH265CompressedVideoMessage", () => {
  it("rejects messages with the wrong schema name", () => {
    expect(isH265CompressedVideoMessage(makeMessage({ schemaName: "something.else" }))).toBe(false);
  });

  it("accepts H.265 messages tagged as either 'h265' or 'hevc'", () => {
    expect(
      isH265CompressedVideoMessage(
        makeMessage({ message: { format: "h265", data: new Uint8Array([0x01]) } }),
      ),
    ).toBe(true);
    expect(
      isH265CompressedVideoMessage(
        makeMessage({ message: { format: "hevc", data: new Uint8Array([0x02]) } }),
      ),
    ).toBe(true);
  });

  it("rejects non-H.265 formats and non-Uint8Array payloads", () => {
    expect(
      isH265CompressedVideoMessage(
        makeMessage({ message: { format: "h264", data: new Uint8Array([0x01]) } }),
      ),
    ).toBe(false);
    expect(
      isH265CompressedVideoMessage(makeMessage({ message: { format: "h265", data: "nope" } })),
    ).toBe(false);
  });
});

describe("messageKey", () => {
  it("encodes topic and receive time", () => {
    expect(messageKey(makeMessage({ topic: "/cam", sec: 5, nsec: 123 }))).toBe("/cam:5:123");
  });
});

describe("readH265GopForSeekTarget", () => {
  it("returns the GOP from the closest preceding keyframe to the target, in order", async () => {
    const target = makeMessage({ sec: 0, nsec: 30 });
    const delta1 = makeMessage({ sec: 0, nsec: 20 });
    const keyframe = makeMessage({ sec: 0, nsec: 10 });

    const sequence = [target, delta1, keyframe];
    const getBackfillMessages = jest.fn(
      async () => [sequence.shift()].filter((m) => m) as MessageEvent[],
    );
    jest
      .spyOn(H265, "IsKeyframe")
      .mockImplementation(
        (data: Uint8Array) => data === (keyframe.message as { data: Uint8Array }).data,
      );

    const result = await readH265GopForSeekTarget(target, getBackfillMessages, () => undefined);

    expect(result.map((m) => m.receiveTime.nsec)).toEqual([10, 20, 30]);
    expect(getBackfillMessages).toHaveBeenCalledTimes(3);
  });

  it("returns empty when the source returns no candidate", async () => {
    const target = makeMessage();
    const getBackfillMessages = jest.fn(async () => []);
    jest.spyOn(H265, "IsKeyframe").mockReturnValue(false);

    const result = await readH265GopForSeekTarget(target, getBackfillMessages, () => undefined);

    expect(result).toEqual([]);
  });

  it("returns empty when the source returns a non-H.265 candidate", async () => {
    const target = makeMessage();
    const getBackfillMessages = jest.fn(async () => [makeMessage({ schemaName: "other" })]);
    jest.spyOn(H265, "IsKeyframe").mockReturnValue(false);

    const result = await readH265GopForSeekTarget(target, getBackfillMessages, () => undefined);

    expect(result).toEqual([]);
  });

  it("returns empty if the same candidate is seen twice (would loop)", async () => {
    const target = makeMessage({ sec: 5, nsec: 100 });
    const getBackfillMessages = jest.fn(async () => [makeMessage({ sec: 5, nsec: 100 })]);
    jest.spyOn(H265, "IsKeyframe").mockReturnValue(false);

    const result = await readH265GopForSeekTarget(target, getBackfillMessages, () => undefined);

    expect(result).toEqual([]);
  });

  it("returns empty when stepping back below time zero", async () => {
    const target = makeMessage({ sec: 0, nsec: 0 });
    const getBackfillMessages = jest.fn(async () => [makeMessage({ sec: 0, nsec: 0 })]);
    jest.spyOn(H265, "IsKeyframe").mockReturnValue(false);

    const result = await readH265GopForSeekTarget(target, getBackfillMessages, () => undefined);

    expect(result).toEqual([]);
  });

  it("aborts after MAX_SEEK_BACKFILL_VIDEO_GOP_MESSAGES iterations", async () => {
    let counter = 0;
    const getBackfillMessages = jest.fn(async () => [
      makeMessage({ sec: 1, nsec: ++counter * 1000 }),
    ]);
    jest.spyOn(H265, "IsKeyframe").mockReturnValue(false);

    const target = makeMessage({ sec: 1, nsec: (MAX_SEEK_BACKFILL_VIDEO_GOP_MESSAGES + 5) * 1000 });
    const result = await readH265GopForSeekTarget(target, getBackfillMessages, () => undefined);

    expect(result).toEqual([]);
    expect(getBackfillMessages).toHaveBeenCalledTimes(MAX_SEEK_BACKFILL_VIDEO_GOP_MESSAGES);
  });

  it("forwards the abort signal from the getter on each call", async () => {
    const target = makeMessage();
    const keyframe = makeMessage({ sec: 0, nsec: 10 });
    const getBackfillMessages = jest.fn(async (_args: GetBackfillMessagesArgs) => [keyframe]);
    jest.spyOn(H265, "IsKeyframe").mockReturnValue(true);
    const controller = new AbortController();

    await readH265GopForSeekTarget(target, getBackfillMessages, () => controller.signal);

    expect(getBackfillMessages.mock.calls[0]?.[0].abortSignal).toBe(controller.signal);
  });
});

describe("expandH265SeekBackfill", () => {
  it("passes through non-H.265 messages and keyframes unchanged", async () => {
    const otherFormat = makeMessage({
      sec: 0,
      nsec: 1,
      message: { format: "h264", data: new Uint8Array([0x01]) },
    });
    const keyframe = makeMessage({ sec: 0, nsec: 2 });
    jest.spyOn(H265, "IsKeyframe").mockReturnValue(true);
    const getBackfillMessages = jest.fn(async () => []);

    const result = await expandH265SeekBackfill(
      [otherFormat, keyframe],
      getBackfillMessages,
      () => undefined,
    );

    expect(result.map((m) => m.receiveTime.nsec)).toEqual([1, 2]);
    expect(getBackfillMessages).not.toHaveBeenCalled();
  });

  it("expands a P frame with its preceding GOP and dedupes by message key", async () => {
    const keyframe = makeMessage({ sec: 0, nsec: 10 });
    const delta1 = makeMessage({ sec: 0, nsec: 20 });
    const target = makeMessage({ sec: 0, nsec: 30 });
    const sequence = [target, delta1, keyframe];

    const getBackfillMessages = jest.fn(
      async () => [sequence.shift()].filter((m) => m) as MessageEvent[],
    );
    jest
      .spyOn(H265, "IsKeyframe")
      .mockImplementation(
        (data: Uint8Array) => data === (keyframe.message as { data: Uint8Array }).data,
      );

    const result = await expandH265SeekBackfill([target], getBackfillMessages, () => undefined);

    expect(result.map((m) => m.receiveTime.nsec)).toEqual([10, 20, 30]);
  });

  it("returns sorted output when expansion mixes new and original messages", async () => {
    const keyframe = makeMessage({ sec: 0, nsec: 5 });
    const target = makeMessage({ sec: 0, nsec: 30 });

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

    const result = await expandH265SeekBackfill([target], getBackfillMessages, () => undefined);

    expect(result.map((m) => m.receiveTime.nsec)).toEqual([5, 30]);
  });
});
