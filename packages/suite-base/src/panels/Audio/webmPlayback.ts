// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

const WEBM_MIME_TYPES = [
  'audio/webm; codecs="opus"',
  'audio/webm; codecs="vorbis"',
  "audio/webm",
] as const;

export function getSupportedWebmMimeType(): string | undefined {
  if (typeof MediaSource === "undefined") {
    return undefined;
  }
  return WEBM_MIME_TYPES.find((type) => MediaSource.isTypeSupported(type));
}

/**
 * Streams WebM audio chunks via Media Source Extensions.
 *
 * decodeAudioData() only accepts complete audio files, but WebM data from
 * recorders and live pipelines is usually emitted as incremental fragments.
 * This player appends each chunk to a SourceBuffer in sequence mode.
 */
export class WebMStreamPlayer {
  #audioContext: AudioContext;
  #gainNode: GainNode;
  #audio: HTMLAudioElement;
  #mediaSource?: MediaSource;
  #sourceBuffer?: SourceBuffer;
  #mediaElementSource?: MediaElementAudioSourceNode;
  #objectUrl?: string;
  #pendingChunks: Uint8Array[] = [];
  #initialized = false;

  public constructor(audioContext: AudioContext, gainNode: GainNode) {
    this.#audioContext = audioContext;
    this.#gainNode = gainNode;
    this.#audio = document.createElement("audio");
  }

  public append(data: Uint8Array): void {
    this.#pendingChunks.push(new Uint8Array(data));
    this.#ensureInitialized();
    this.#drainPending();
  }

  public reset(): void {
    this.#cleanup();
  }

  public get isPlaying(): boolean {
    return !this.#audio.paused;
  }

  #ensureInitialized(): void {
    if (this.#initialized) {
      return;
    }

    const mimeType = getSupportedWebmMimeType();
    if (mimeType == undefined) {
      throw new Error("WebM playback is not supported in this browser");
    }

    this.#mediaSource = new MediaSource();
    this.#objectUrl = URL.createObjectURL(this.#mediaSource);
    this.#audio.src = this.#objectUrl;

    this.#mediaElementSource = this.#audioContext.createMediaElementSource(this.#audio);
    this.#mediaElementSource.connect(this.#gainNode);

    this.#mediaSource.addEventListener(
      "sourceopen",
      () => {
        if (!this.#mediaSource || this.#initialized) {
          return;
        }

        this.#sourceBuffer = this.#mediaSource.addSourceBuffer(mimeType);
        this.#sourceBuffer.mode = "sequence";
        this.#sourceBuffer.addEventListener("updateend", () => {
          void this.#startPlaybackIfNeeded();
          this.#drainPending();
        });
        this.#initialized = true;
        this.#drainPending();
      },
      { once: true },
    );
  }

  async #startPlaybackIfNeeded(): Promise<void> {
    if (this.#audioContext.state === "suspended") {
      await this.#audioContext.resume();
    }

    if (this.#audio.paused && this.#sourceBuffer != undefined && this.#sourceBuffer.buffered.length > 0) {
      try {
        await this.#audio.play();
      } catch {
        // Autoplay may be blocked until the user interacts with the page.
      }
    }
  }

  #drainPending(): void {
    if (!this.#sourceBuffer || this.#sourceBuffer.updating || this.#pendingChunks.length === 0) {
      return;
    }

    const chunk = this.#pendingChunks.shift();
    if (chunk == undefined) {
      return;
    }

    try {
      const buffer = new ArrayBuffer(chunk.byteLength);
      new Uint8Array(buffer).set(chunk);
      this.#sourceBuffer.appendBuffer(buffer);
    } catch (err: unknown) {
      throw new Error(`Failed to append WebM audio chunk: ${String(err)}`);
    }
  }

  #cleanup(): void {
    this.#pendingChunks = [];

    try {
      if (this.#mediaSource?.readyState === "open") {
        this.#mediaSource.endOfStream();
      }
    } catch {
      // Ignore errors while closing an in-progress stream.
    }

    this.#mediaElementSource?.disconnect();
    this.#mediaElementSource = undefined;
    this.#sourceBuffer = undefined;
    this.#mediaSource = undefined;

    this.#audio.pause();
    this.#audio.removeAttribute("src");
    this.#audio.load();

    if (this.#objectUrl != undefined) {
      URL.revokeObjectURL(this.#objectUrl);
      this.#objectUrl = undefined;
    }

    this.#initialized = false;
    this.#audio = document.createElement("audio");
  }
}
