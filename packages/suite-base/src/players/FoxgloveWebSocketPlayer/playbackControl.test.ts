// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import {
  decodePlaybackState,
  encodePlaybackControlRequest,
  isPlaybackStateMessage,
  PlaybackStatus,
} from "./playbackControl";

describe("encodePlaybackControlRequest", () => {
  it("encodes a play request with a seek", () => {
    const bytes = new Uint8Array(
      encodePlaybackControlRequest({
        play: true,
        speed: 2,
        seekTimeNs: 0x0102030405060708n,
        requestId: "ab",
      }),
    );
    expect(Array.from(bytes)).toEqual([
      0x03, // opcode
      0x00, // play
      ...[0x00, 0x00, 0x00, 0x40], // 2.0 as little-endian f32
      0x01, // has seek
      ...[0x08, 0x07, 0x06, 0x05, 0x04, 0x03, 0x02, 0x01], // seek time
      ...[0x02, 0x00, 0x00, 0x00], // request id length
      0x61,
      0x62, // "ab"
    ]);
  });

  it("encodes a pause request without a seek", () => {
    const bytes = new Uint8Array(
      encodePlaybackControlRequest({ play: false, speed: 1, requestId: "" }),
    );
    expect(bytes[1]).toBe(1);
    expect(bytes[6]).toBe(0);
    expect(bytes.byteLength).toBe(19);
  });
});

describe("decodePlaybackState", () => {
  it("decodes a playback state message", () => {
    const bytes = new Uint8Array([
      0x05, // opcode
      0x01, // paused
      ...[0x08, 0x07, 0x06, 0x05, 0x04, 0x03, 0x02, 0x01], // current time
      ...[0x00, 0x00, 0x00, 0x3f], // 0.5 as little-endian f32
      0x01, // did seek
      ...[0x03, 0x00, 0x00, 0x00], // request id length
      0x61,
      0x62,
      0x63, // "abc"
    ]);
    expect(isPlaybackStateMessage(bytes.buffer)).toBe(true);
    expect(decodePlaybackState(bytes.buffer)).toEqual({
      status: PlaybackStatus.Paused,
      currentTimeNs: 0x0102030405060708n,
      speed: 0.5,
      didSeek: true,
      requestId: "abc",
    });
  });

  it("does not match other binary or text messages", () => {
    expect(isPlaybackStateMessage(new Uint8Array([0x01, 0x00]).buffer)).toBe(false);
    expect(isPlaybackStateMessage(new ArrayBuffer(0))).toBe(false);
    expect(isPlaybackStateMessage(new Uint8Array([0x05, 0x00]).buffer)).toBe(false);
    const badLength = new Uint8Array(19);
    badLength[0] = 0x05;
    new DataView(badLength.buffer).setUint32(15, 4, true);
    expect(isPlaybackStateMessage(badLength.buffer)).toBe(false);
    expect(isPlaybackStateMessage('{"op":"serverInfo"}')).toBe(false);
  });
});
