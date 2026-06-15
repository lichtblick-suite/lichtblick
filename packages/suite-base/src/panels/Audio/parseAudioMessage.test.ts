/** @jest-environment jsdom */
// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import AudioBuilder from "@lichtblick/suite-base/testing/builders/AudioBuilder";

import { describePlaybackParams, parseAudioMessage } from "./parseAudioMessage";

describe("parseAudioMessage", () => {
  it("maps foxglove RawAudio pcm-s16 metadata when auto-detect is enabled", () => {
    // given... a RawAudio-style message with pcm-s16 metadata
    const message = AudioBuilder.rawAudioMessage();

    // when... parsing the message with auto-detect enabled
    const result = parseAudioMessage(message, AudioBuilder.config({ encoding: "auto" }));

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
    const message = AudioBuilder.rawBytesMessage();

    // when... parsing the message with auto-detect enabled
    const result = parseAudioMessage(message, AudioBuilder.config({ encoding: "auto" }));

    // then... the caller is prompted to choose a manual encoding
    expect(result).toEqual({
      status: "error",
      message:
        'Auto-detect could not determine encoding. Choose an encoding manually or use a topic that provides a "format" field.',
    });
  });

  it("uses the manual panel encoding when auto-detect is disabled", () => {
    // given... a message with only raw bytes and manual WebM selected
    const message = AudioBuilder.rawBytesMessage();

    // when... parsing the message
    const result = parseAudioMessage(message, AudioBuilder.config({ encoding: "webm" }));

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

  it("returns the encoding label for compressed formats", () => {
    // given... WebM playback parameters
    const params = {
      bytes: new Uint8Array(),
      encoding: "webm" as const,
      sampleRate: 44100,
      numChannels: 1,
    };

    // when... describing the playback parameters
    const description = describePlaybackParams(params);

    // then... only the encoding label is shown
    expect(description).toBe("WebM");
  });
});

describe("parseAudioMessage edge cases", () => {
  it("accepts typed array views as audio data", () => {
    // given... a message with an Int16Array payload
    const data = new Int16Array([1, 2, 3, 4]);
    const message = { data, format: "pcm-s16", sample_rate: 16000, number_of_channels: 1 };

    // when... parsing the message
    const result = parseAudioMessage(message, AudioBuilder.config({ encoding: "auto" }));

    // then... bytes are normalized from the typed array view
    expect(result).toEqual({
      status: "ok",
      params: {
        bytes: new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
        encoding: "pcm-int16le",
        sampleRate: 16000,
        numChannels: 1,
      },
    });
  });

  it("returns empty when audio data has zero length", () => {
    // given... a message with an empty payload
    const message = { data: new Uint8Array() };

    // when... parsing the message
    const result = parseAudioMessage(message, AudioBuilder.config({ encoding: "webm" }));

    // then... the message is ignored
    expect(result).toEqual({ status: "empty" });
  });
});
