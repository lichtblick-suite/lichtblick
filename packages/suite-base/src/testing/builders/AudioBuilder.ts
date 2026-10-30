// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { AudioConfig } from "@lichtblick/suite-base/panels/Audio/types";
import { defaults } from "@lichtblick/test-builders";

export type RawAudioMessage = {
  data: Uint8Array;
  format?: string;
  sample_rate?: number;
  number_of_channels?: number;
};

export default class AudioBuilder {
  public static config(props: Partial<AudioConfig> = {}): AudioConfig {
    return defaults<AudioConfig>(props, {
      topic: "/audio/raw",
      encoding: "auto",
      sampleRate: 44100,
      numChannels: 1,
      volume: 1,
    });
  }

  public static rawAudioMessage(props: Partial<RawAudioMessage> = {}): Record<string, unknown> {
    return defaults<RawAudioMessage>(props, {
      data: new Uint8Array([0, 1, 2, 3]),
      format: "pcm-s16",
      sample_rate: 48000,
      number_of_channels: 2,
    });
  }

  public static rawBytesMessage(
    data: Uint8Array = new Uint8Array([0xff, 0x00]),
  ): Record<string, unknown> {
    return { data };
  }
}
