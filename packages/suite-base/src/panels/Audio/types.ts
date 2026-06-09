// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { PanelExtensionContext } from "@lichtblick/suite";

/**
 * Audio encoding formats supported by the Audio panel.
 *
 * Compressed formats (wav, mp3, ogg, aac, flac) are decoded via the browser's
 * built-in AudioContext.decodeAudioData API, so browser/platform support applies.
 *
 * WebM is streamed via Media Source Extensions because topic data is usually emitted
 * as incremental fragments rather than complete files.
 *
 * Raw PCM formats (pcm-float32le, pcm-int16le) are decoded manually and do not
 * depend on browser codec support.
 *
 * "auto" reads encoding (and PCM sample rate/channels when available) from message
 * metadata such as foxglove.RawAudio `format`, `sample_rate`, and `number_of_channels`.
 */
export type AudioEncoding =
  | "auto"
  | "wav"
  | "mp3"
  | "ogg"
  | "aac"
  | "flac"
  | "webm"
  | "pcm-float32le"
  | "pcm-int16le";

/** Encoding used for playback after resolving "auto" from message metadata. */
export type ResolvedAudioEncoding = Exclude<AudioEncoding, "auto">;

export type AudioConfig = {
  topic: string;
  encoding: AudioEncoding;
  /** Sample rate in Hz — only used for raw PCM encodings. */
  sampleRate: number;
  /** Number of audio channels — only used for raw PCM encodings. */
  numChannels: number;
  /** Playback volume in the range [0, 1]. */
  volume: number;
};

export type AudioProps = {
  context: PanelExtensionContext;
};
