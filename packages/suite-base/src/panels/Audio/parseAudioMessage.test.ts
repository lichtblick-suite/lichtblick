/** @jest-environment jsdom */
// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { describePlaybackParams, parseAudioMessage } from "./parseAudioMessage";
import { AudioConfig } from "./types";

const AUTO_CONFIG: AudioConfig = {
  topic: "/audio/raw",
  encoding: "auto",
  sampleRate: 44100,
  numChannels: 1,
  volume: 1,
};

describe("parseAudioMessage", () => {
  it("maps foxglove RawAudio pcm-s16 metadata when auto-detect is enabled", () => {
    // given... a RawAudio-style message with pcm-s16 metadata
    const message = {
      data: new Uint8Array([0, 1, 2, 3]),
      format: "pcm-s16",
      sample_rate: 48000,
      number_of_channels: 2,
    };

    // when... parsing the message with auto-detect enabled
    const result = parseAudioMessage(message, AUTO_CONFIG);

    // then... message metadata determines playback settings
    expect(result).toEqual({
      status: "ok",
      params: {
        bytes: new Uint8Array([0, 1, 2, 3]),
        encoding: "pcm-int16le",
        sampleRate: 48000,
        numChannels: 2,
      },
    });
  });

  it("returns an error when auto-detect cannot determine encoding", () => {
    // given... a message with only raw bytes
    const message = {
      data: new Uint8Array([0xff, 0x00]),
    };

    // when... parsing the message with auto-detect enabled
    const result = parseAudioMessage(message, AUTO_CONFIG);

    // then... the caller is prompted to choose a manual encoding
    expect(result).toEqual({
      status: "error",
      message:
        'Auto-detect could not determine encoding. Choose an encoding manually or use a topic that provides a "format" field.',
    });
  });

  it("uses the manual panel encoding when auto-detect is disabled", () => {
    // given... a message with only raw bytes and manual WebM selected
    const message = {
      data: new Uint8Array([0xff, 0x00]),
    };
    const config: AudioConfig = { ...AUTO_CONFIG, encoding: "webm" };

    // when... parsing the message
    const result = parseAudioMessage(message, config);

    // then... panel encoding settings are used
    expect(result).toEqual({
      status: "ok",
      params: {
        bytes: new Uint8Array([0xff, 0x00]),
        encoding: "webm",
        sampleRate: 44100,
        numChannels: 1,
      },
    });
  });
});

describe("describePlaybackParams", () => {
  it("includes PCM sample rate and channel count in the description", () => {
    // given... PCM playback parameters
    const params = {
      bytes: new Uint8Array(),
      encoding: "pcm-int16le" as const,
      sampleRate: 48000,
      numChannels: 2,
    };

    // when... describing the playback parameters
    const description = describePlaybackParams(params);

    // then... PCM details are included
    expect(description).toBe("PCM Int16 LE @ 48,000 Hz, 2 ch");
  });
});
