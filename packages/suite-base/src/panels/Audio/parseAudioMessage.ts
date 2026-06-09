// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { AudioConfig, AudioEncoding, ResolvedAudioEncoding } from "./types";

export type AudioPlaybackParams = {
  bytes: Uint8Array;
  encoding: ResolvedAudioEncoding;
  sampleRate: number;
  numChannels: number;
};

export type ParseAudioMessageResult =
  | { status: "empty" }
  | { status: "error"; message: string }
  | { status: "ok"; params: AudioPlaybackParams };

const MESSAGE_FORMAT_TO_ENCODING: Record<string, ResolvedAudioEncoding> = {
  "pcm-s16": "pcm-int16le",
  "pcm-f32": "pcm-float32le",
  "pcm-f32le": "pcm-float32le",
  webm: "webm",
  wav: "wav",
  mp3: "mp3",
  ogg: "ogg",
  aac: "aac",
  flac: "flac",
};

export const ENCODING_LABELS: Record<ResolvedAudioEncoding, string> = {
  wav: "WAV",
  mp3: "MP3",
  ogg: "OGG",
  aac: "AAC",
  flac: "FLAC",
  webm: "WebM",
  "pcm-float32le": "PCM Float32 LE",
  "pcm-int16le": "PCM Int16 LE",
};

const PCM_ENCODINGS = new Set<ResolvedAudioEncoding>(["pcm-float32le", "pcm-int16le"]);

function toUint8Array(raw: unknown): Uint8Array | undefined {
  if (raw instanceof Uint8Array) {
    return raw;
  }
  if (ArrayBuffer.isView(raw)) {
    return new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);
  }
  return undefined;
}

function toPositiveInt(raw: unknown): number | undefined {
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    return Math.trunc(raw);
  }
  return undefined;
}

function resolveEncoding(
  configEncoding: AudioEncoding,
  messageFormat: string | undefined,
): ResolvedAudioEncoding | undefined {
  if (configEncoding !== "auto") {
    return configEncoding;
  }

  if (messageFormat == undefined) {
    return undefined;
  }

  return MESSAGE_FORMAT_TO_ENCODING[messageFormat];
}

export function describePlaybackParams(params: AudioPlaybackParams): string {
  const label = ENCODING_LABELS[params.encoding];
  if (PCM_ENCODINGS.has(params.encoding)) {
    return `${label} @ ${params.sampleRate.toLocaleString()} Hz, ${params.numChannels} ch`;
  }
  return label;
}

/**
 * Extract audio bytes and playback parameters from a message.
 *
 * When encoding is "auto", message metadata (e.g. foxglove.RawAudio `format`,
 * `sample_rate`, `number_of_channels`) determines playback settings.
 */
export function parseAudioMessage(
  message: Record<string, unknown>,
  config: AudioConfig,
): ParseAudioMessageResult {
  const bytes = toUint8Array(message["data"]);
  if (bytes == undefined || bytes.byteLength === 0) {
    return { status: "empty" };
  }

  const format = typeof message["format"] === "string" ? message["format"].toLowerCase() : undefined;
  const encoding = resolveEncoding(config.encoding, format);

  if (encoding == undefined) {
    return {
      status: "error",
      message:
        'Auto-detect could not determine encoding. Choose an encoding manually or use a topic that provides a "format" field.',
    };
  }

  return {
    status: "ok",
    params: {
      bytes,
      encoding,
      sampleRate: toPositiveInt(message["sample_rate"]) ?? config.sampleRate,
      numChannels: toPositiveInt(message["number_of_channels"]) ?? config.numChannels,
    },
  };
}
