// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Mutex } from "async-mutex";
import EventEmitter from "eventemitter3";

import Logger from "@lichtblick/log";

// foxglove-depcheck-used: @types/dom-webcodecs

const MAX_DECODE_WAIT_MS = 30;

export type VideoPlayerEventTypes = {
  frame: (frame: VideoFrame) => void;
  debug: (message: string) => void;
  warn: (message: string) => void;
  error: (error: Error) => void;
};

const log = Logger.getLogger(__filename);

/**
 * A wrapper around the WebCodecs VideoDecoder API that is safe to use from
 * multiple asynchronous contexts, is keyframe-aware, exposes a simple decode
 * method that takes a chunk of encoded video bitstream representing a single
 * frame and returns the decoded VideoFrame, and emits events for debugging
 * and error handling.
 */
export class VideoPlayer extends EventEmitter<VideoPlayerEventTypes> {
  #decoderInit: VideoDecoderInit;
  #decoder: VideoDecoder;
  #decoderConfig: VideoDecoderConfig | undefined;
  #mutex = new Mutex();
  #timeoutId: ReturnType<typeof setTimeout> | undefined;
  #pendingFrame: VideoFrame | undefined;
  #codedSize: { width: number; height: number } | undefined;
  // Stores the last decoded frame as an ImageBitmap, should be set after decode()
  lastImageBitmap: ImageBitmap | undefined;

  /** Reports whether video decoding is supported in this browser session */
  public static IsSupported(): boolean {
    return self.isSecureContext && "VideoDecoder" in globalThis;
  }

  public constructor() {
    super();
    this.#decoderInit = {
      output: (videoFrame: VideoFrame) => {
        this.#pendingFrame?.close();
        this.#pendingFrame = videoFrame;
        this.emit("frame", videoFrame);
      },
      error: (error) => this.emit("error", error),
    };
    this.#decoder = new VideoDecoder(this.#decoderInit);
  }

  /**
   * Configures the VideoDecoder with the given VideoDecoderConfig. This must
   * be called before decode() will return a VideoFrame.
   */
  public async init(decoderConfig: VideoDecoderConfig): Promise<void> {
    await this.#mutex.runExclusive(async () => {
      // Optimize for latency means we do not have to call flush() in every decode() call
      // See <https://github.com/w3c/webcodecs/issues/206>
      decoderConfig.optimizeForLatency = true;

      // Try with 'prefer-hardware' first
      let modifiedConfig = { ...decoderConfig };
      modifiedConfig.hardwareAcceleration = "prefer-hardware";

      let support = await VideoDecoder.isConfigSupported(modifiedConfig);
      if (support.supported !== true) {
        log.warn(
          `VideoDecoder does not support configuration ${JSON.stringify(modifiedConfig)}. Trying without 'prefer-hardware'`,
        );
        // If 'prefer-hardware' is not supported, try without it
        modifiedConfig = { ...decoderConfig };
        support = await VideoDecoder.isConfigSupported(modifiedConfig);
      }

      if (support.supported !== true) {
        const err = new Error(
          `VideoDecoder does not support configuration ${JSON.stringify(decoderConfig)}`,
        );
        this.emit("error", err);
        return;
      }

      if (this.#decoder.state === "closed") {
        this.emit("debug", "VideoDecoder is closed, creating a new one");
        this.#decoder = new VideoDecoder(this.#decoderInit);
      }

      this.emit("debug", `Configuring VideoDecoder with ${JSON.stringify(decoderConfig)}`);
      this.#decoder.configure(decoderConfig);
      this.#decoderConfig = decoderConfig;
      this.#codedSize = undefined;
      if (decoderConfig.codedWidth != undefined && decoderConfig.codedHeight != undefined) {
        this.#codedSize = { width: decoderConfig.codedWidth, height: decoderConfig.codedHeight };
      }
    });
  }

  /** Returns true if the VideoDecoder is open and configured, ready for decoding. */
  public isInitialized(): boolean {
    return this.#decoder.state === "configured";
  }

  /** Returns the VideoDecoderConfig given to init(), or undefined if init() has not been called. */
  public decoderConfig(): VideoDecoderConfig | undefined {
    return this.#decoderConfig;
  }

  /** Returns the dimensions of the coded video frames, if known. */
  public codedSize(): { width: number; height: number } | undefined {
    return this.#codedSize;
  }

  /**
   * Takes a chunk of encoded video bitstream, sends it to the VideoDecoder,
   * and returns a Promise that resolves to the decoded VideoFrame. If the
   * VideoDecoder is not yet configured, we are waiting on a keyframe, or we
   * time out waiting for the decoder to return a frame, this will return
   * undefined.
   *
   * @param data A chunk of encoded video bitstream
   * @param timestampMicros The timestamp of the chunk of encoded video
   *   bitstream in microseconds relative to the start of the stream
   * @param type "key" if this chunk contains a keyframe, "delta" otherwise
   * @returns A VideoFrame or undefined if no frame was decoded
   */
  public async decode(
    data: Uint8Array,
    timestampMicros: number,
    type: "key" | "delta",
  ): Promise<VideoFrame | undefined> {
    return await this.#mutex.runExclusive(async () => {
      if (this.#decoder.state === "closed") {
        this.emit("warn", "VideoDecoder is closed, creating a new one");
        this.#decoder = new VideoDecoder(this.#decoderInit);
      }

      if (this.#decoder.state === "unconfigured") {
        this.emit("debug", "Waiting for initialization...");
        return undefined;
      }

      await new Promise<void>((resolve) => {
        const frameHandler = () => {
          if (this.#timeoutId != undefined) {
            clearTimeout(this.#timeoutId);
          }
          resolve();
        };

        if (this.#timeoutId != undefined) {
          clearTimeout(this.#timeoutId);
        }

        this.#timeoutId = setTimeout(() => {
          this.removeListener("frame", frameHandler);
          this.emit(
            "warn",
            `Timed out decoding ${data.byteLength} byte chunk at time ${timestampMicros}`,
          );
          resolve(undefined);
        }, MAX_DECODE_WAIT_MS);

        this.once("frame", frameHandler);

        try {
          this.#decoder.decode(new EncodedVideoChunk({ type, data, timestamp: timestampMicros }));
        } catch (unk) {
          clearTimeout(this.#timeoutId);
          this.removeListener("frame", frameHandler);

          const error = new Error(
            `Failed to decode ${data.byteLength} byte chunk at time ${timestampMicros}: ${
              (unk as Error).message
            }`,
          );
          this.emit("error", error);
          resolve();
        }
      });

      const maybeVideoFrame = this.#pendingFrame;
      this.#pendingFrame = undefined;

      // Update the coded and display sizes if we have a new frame
      if (maybeVideoFrame) {
        if (!this.#codedSize) {
          this.#codedSize = { width: 0, height: 0 };
        }
        this.#codedSize.width = maybeVideoFrame.codedWidth;
        this.#codedSize.height = maybeVideoFrame.codedHeight;
      }

      return maybeVideoFrame;
    });
  }

  /**
   * Reset the VideoDecoder and clear any pending frames, but do not clear any
   * cached stream information or decoder configuration. This should be called
   * when seeking to a new position in the stream.
   */
  public resetForSeek(): void {
    if (this.#decoder.state === "configured") {
      this.#decoder.reset();
    }
    if (this.#timeoutId != undefined) {
      clearTimeout(this.#timeoutId);
    }
    this.#pendingFrame?.close();
    this.#pendingFrame = undefined;
  }

  /**
   * Close the VideoDecoder and clear any pending frames. Also clear any cached
   * stream information or decoder configuration.
   */
  public close(): void {
    if (this.#decoder.state !== "closed") {
      this.#decoder.close();
    }
    if (this.#timeoutId != undefined) {
      clearTimeout(this.#timeoutId);
    }
    this.#pendingFrame?.close();
    this.#pendingFrame = undefined;
  }
}
