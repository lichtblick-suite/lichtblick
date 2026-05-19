// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Mutex } from "async-mutex";
import EventEmitter from "eventemitter3";

import { H265_MAX_DECODE_WAIT_MS, H265_TARGET_FRAME_WAIT_MS } from "./h265/constants";

// foxglove-depcheck-used: @types/dom-webcodecs

// H.264 typically emits a decoded VideoFrame within a couple of milliseconds of submitting an
// EncodedVideoChunk, so a tight 30 ms ceiling lets us return quickly when decoding is healthy and
// fail fast when the decoder is stuck. The H.265 budgets live in `./h265/constants.ts` and are
// much larger because HEVC decoders may need to consume an entire GOP before emitting the target
// frame.
const DEFAULT_TARGET_FRAME_WAIT_MS = 10;
const DEFAULT_MAX_DECODE_WAIT_MS = 30;

/** A single chunk of encoded video bitstream representing one frame. */
export type EncodedVideoFrame = {
  data: Uint8Array;
  timestampMicros: number;
  type: "key" | "delta";
};

/**
 * The outcome of a `decodeFrames()` call. `target` means we got the exact frame requested,
 * `intermediate` means we returned a best-effort earlier frame because the target did not arrive
 * in time, `timeout` means nothing decoded before the ceiling, and `aborted` means the decoder
 * errored or was reset (the optional `frame` is whatever had decoded before the abort).
 */
export type DecodeFramesResult =
  | { type: "target"; frame: VideoFrame }
  | { type: "intermediate"; frame: VideoFrame }
  | { type: "timeout" }
  | { type: "aborted"; frame?: VideoFrame };

type PendingDecode = {
  targetTimestampMicros: number;
  targetDeadlineMs: number;
  waitForQueueDrain: boolean;
  drained: boolean;
  resolvedResult?: DecodeFramesResult;
  resolve: (result: DecodeFramesResult) => void;
  reject: (error: Error) => void;
  targetTimeoutId?: ReturnType<typeof setTimeout>;
  overallTimeoutId?: ReturnType<typeof setTimeout>;
};

export type VideoPlayerEventTypes = {
  frame: (frame: VideoFrame) => void;
  debug: (message: string) => void;
  warn: (message: string) => void;
  error: (error: Error) => void;
};

/**
 * A wrapper around the WebCodecs VideoDecoder API that is safe to use from multiple asynchronous
 * contexts, is keyframe-aware, and exposes both a single-frame `decode()` helper and a multi-frame
 * `decodeFrames()` API that accepts a dependency chain (e.g. a keyframe followed by P-frames
 * leading up to a target frame). The class emits events for debugging and error handling.
 *
 * `decodeFrames()` exists because H.265 decoders can hold many submitted chunks in their pipeline
 * before producing output. The caller hands us the full chain and we return a `DecodeFramesResult`
 * describing whether the exact target frame, an intermediate frame, a timeout, or an abort
 * occurred — semantics that a strictly per-chunk `decode()` call cannot express.
 */
export class VideoPlayer extends EventEmitter<VideoPlayerEventTypes> {
  readonly #decoderInit: VideoDecoderInit;
  #decoder: VideoDecoder;
  #decoderConfig: VideoDecoderConfig | undefined;
  readonly #mutex = new Mutex();
  // Decoded frames keyed by their EncodedVideoChunk timestamp. The order array tracks insertion
  // order so we can return the newest decoded frame on timeout without scanning the map. Frames
  // remain owned by this class until they are dequeued (returned to the caller) or disposed.
  readonly #pendingFrames = new Map<number, VideoFrame>();
  readonly #pendingFrameOrder: number[] = [];
  #pendingDecode: PendingDecode | undefined;
  #pendingTargetTimestampMicros: number | undefined;
  #lastSubmittedTimestampMicros: number | undefined;
  #currentDecodeTimestampMicros: number | undefined;
  // Lets a caller park on the still-decoding target frame after `decodeFrames()` resolves with an
  // intermediate or timeout, so the eventual on-time decode can still be surfaced.
  #targetWaiter:
    | {
        targetTimestampMicros: number;
        resolve: (frame: VideoFrame) => void;
        reject: (error: Error) => void;
      }
    | undefined;
  #codedSize: { width: number; height: number } | undefined;
  /** Last decoded frame as an ImageBitmap; populated by callers after they paint a frame. */
  public lastImageBitmap: ImageBitmap | undefined;
  /** Owned clone of the last frame returned to the caller, used to redraw without redecoding. */
  public lastVideoFrame: VideoFrame | undefined;

  /** Reports whether video decoding is supported in this browser session. */
  public static IsSupported(): boolean {
    return self.isSecureContext && "VideoDecoder" in globalThis;
  }

  public constructor() {
    super();
    this.#decoderInit = {
      output: (videoFrame: VideoFrame) => {
        const timestampMicros = videoFrame.timestamp;
        // Check for duplicate timestamp
        const previousFrame = this.#pendingFrames.get(timestampMicros);
        if (previousFrame) {
          previousFrame.close();
        } else {
          this.#pendingFrameOrder.push(timestampMicros);
        }
        this.#pendingFrames.set(timestampMicros, videoFrame);
        this.#handleDecodedFrame(timestampMicros);
        this.emit("frame", videoFrame);
      },
      error: (error) => {
        const timestampSec =
          this.#currentDecodeTimestampMicros == undefined
            ? ""
            : ` @ frame timestamp: ${this.#currentDecodeTimestampMicros / 1_000_000}s`;
        const decodeError = new DOMException(`${error.message}${timestampSec}`, error.name);
        const newestFrame = this.#dequeueNewestFrame();
        this.#pendingDecode?.resolve({ type: "aborted", frame: newestFrame });
        this.#pendingDecode = undefined;
        this.#targetWaiter?.reject(decodeError);
        this.#targetWaiter = undefined;
        this.emit("error", decodeError);
      },
    };
    this.#decoder = new VideoDecoder(this.#decoderInit);
  }

  /**
   * Configures the VideoDecoder with the given VideoDecoderConfig. This must be called before
   * `decode()` or `decodeFrames()` will return a VideoFrame. If hardware-accelerated configuration
   * fails we fall back to a `no-preference` config so the decoder still functions on machines that
   * lack hardware support for the codec.
   */
  public async init(decoderConfig: VideoDecoderConfig): Promise<void> {
    await this.#mutex.runExclusive(async () => {
      // optimizeForLatency lets the decoder emit frames as soon as they are ready instead of
      // waiting on a full flush, which means callers do not need to call flush() per chunk.
      // See <https://github.com/w3c/webcodecs/issues/206>.
      const preferredConfig: VideoDecoderConfig = {
        ...decoderConfig,
        optimizeForLatency: true,
      };
      // Fallback used only if the preferred config is rejected (e.g. no hardware HEVC decoder).
      const fallbackConfig: VideoDecoderConfig = {
        ...decoderConfig,
        optimizeForLatency: true,
        hardwareAcceleration: "no-preference",
      };

      if (this.#decoder.state === "closed") {
        this.emit("debug", "VideoDecoder is closed, creating a new one");
        this.#decoder = new VideoDecoder(this.#decoderInit);
      }

      this.emit("debug", `Configuring VideoDecoder with ${JSON.stringify(preferredConfig)}`);
      try {
        this.#decoder.configure(preferredConfig);
        this.#decoderConfig = preferredConfig;
      } catch {
        this.emit(
          "warn",
          `Failed to configure VideoDecoder with ${JSON.stringify(preferredConfig)}. Retrying with no-preference hardware acceleration`,
        );
        try {
          this.#decoder.configure(fallbackConfig);
          this.#decoderConfig = fallbackConfig;
        } catch (fallbackError) {
          const err = new Error(
            `Failed to configure VideoDecoder with ${JSON.stringify(fallbackConfig)}: ${(fallbackError as Error).message}`,
          );
          this.emit("error", err);
          return;
        }
      }

      this.#codedSize = undefined;
      this.#lastSubmittedTimestampMicros = undefined;
      this.#currentDecodeTimestampMicros = undefined;
      if (
        this.#decoderConfig.codedWidth != undefined &&
        this.#decoderConfig.codedHeight != undefined
      ) {
        this.#codedSize = {
          width: this.#decoderConfig.codedWidth,
          height: this.#decoderConfig.codedHeight,
        };
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
   * Decode a single chunk of encoded video bitstream and return the resulting VideoFrame.
   *
   * Internally this delegates to `decodeFrames` with a one-element array. Use `decodeFrames`
   * directly when you need to feed the decoder a dependency chain (e.g. previous P-frames before
   * a seek target).
   *
   * @param data A chunk of encoded video bitstream.
   * @param timestampMicros Microsecond timestamp of the chunk relative to the start of the stream.
   * @param type "key" if this chunk contains a keyframe, "delta" otherwise.
   * @returns A VideoFrame if one was decoded; undefined on timeout.
   */
  public async decode(
    data: Uint8Array,
    timestampMicros: number,
    type: "key" | "delta",
  ): Promise<VideoFrame | undefined> {
    const result = await this.decodeFrames([{ data, timestampMicros, type }]);
    if (result.type === "target" || result.type === "intermediate" || result.type === "aborted") {
      return result.frame;
    }
    return undefined;
  }

  /**
   * Decode a sequence of encoded chunks, treating the last chunk as the target frame. The earlier
   * chunks satisfy the decoder's dependency requirements (e.g. keyframe + intervening P-frames).
   *
   * The returned `DecodeFramesResult` describes whether the exact target frame was produced
   * (`target`), an earlier frame had to be returned because the target did not arrive within the
   * codec-specific deadline (`intermediate`), nothing decoded in time (`timeout`), or the decoder
   * was reset/errored mid-flight (`aborted`).
   *
   * Throws if called while a previous decode is still in progress — the caller is expected to
   * await the prior result before submitting another batch.
   */
  public async decodeFrames(frames: EncodedVideoFrame[]): Promise<DecodeFramesResult> {
    const targetFrame = frames.at(-1);
    if (targetFrame == undefined) {
      return { type: "timeout" };
    }
    if (this.#pendingDecode) {
      throw new Error("decodeFrames called while a previous decode is still in progress");
    }

    if (this.#decoder.state === "closed") {
      this.emit("warn", "VideoDecoder is closed, creating a new one");
      this.#decoder = new VideoDecoder(this.#decoderInit);
      if (this.#decoderConfig != undefined) {
        this.#decoder.configure(this.#decoderConfig);
      }
    }

    if (this.#decoder.state === "unconfigured") {
      this.emit("debug", "Waiting for initialization...");
      return { type: "timeout" };
    }

    const isH265 =
      this.#decoderConfig?.codec.startsWith("hev1") === true ||
      this.#decoderConfig?.codec.startsWith("hvc1") === true;
    const targetFrameWaitMs = isH265 ? H265_TARGET_FRAME_WAIT_MS : DEFAULT_TARGET_FRAME_WAIT_MS;
    const maxDecodeWaitMs = isH265 ? H265_MAX_DECODE_WAIT_MS : DEFAULT_MAX_DECODE_WAIT_MS;

    this.#pendingTargetTimestampMicros = targetFrame.timestampMicros;

    return await new Promise<DecodeFramesResult>((resolve, reject) => {
      const pendingDecode: PendingDecode = {
        targetTimestampMicros: targetFrame.timestampMicros,
        targetDeadlineMs: performance.now() + targetFrameWaitMs,
        waitForQueueDrain: isH265,
        drained: !isH265,
        resolve: (result) => {
          if (pendingDecode.targetTimeoutId != undefined) {
            clearTimeout(pendingDecode.targetTimeoutId);
          }
          clearTimeout(pendingDecode.overallTimeoutId);
          if (this.#pendingDecode === pendingDecode) {
            this.#pendingDecode = undefined;
          }
          resolve(result);
        },
        reject: (error) => {
          if (pendingDecode.targetTimeoutId != undefined) {
            clearTimeout(pendingDecode.targetTimeoutId);
          }
          clearTimeout(pendingDecode.overallTimeoutId);
          if (this.#pendingDecode === pendingDecode) {
            this.#pendingDecode = undefined;
          }
          reject(error);
        },
      };

      pendingDecode.targetTimeoutId = setTimeout(() => {
        this.#handleDecodedFrame();
      }, targetFrameWaitMs);

      pendingDecode.overallTimeoutId = setTimeout(() => {
        if (this.#pendingDecode !== pendingDecode) {
          return;
        }
        const frame = this.#dequeueNewestFrame();
        if (frame) {
          pendingDecode.resolve({ type: "intermediate", frame });
          return;
        }
        this.emit(
          "warn",
          `Timed out decoding ${targetFrame.data.byteLength} byte chunk at time ${targetFrame.timestampMicros}`,
        );
        pendingDecode.resolve({ type: "timeout" });
      }, maxDecodeWaitMs);

      this.#pendingDecode = pendingDecode;

      try {
        for (const frame of frames) {
          if (!this.#decodeChunk(frame.data, frame.timestampMicros, frame.type)) {
            pendingDecode.resolve({ type: "timeout" });
            return;
          }
        }
      } catch (error) {
        pendingDecode.reject(error as Error);
        return;
      }

      this.#waitForDecodeQueueDrain(maxDecodeWaitMs, () => {
        pendingDecode.drained = true;
        if (pendingDecode.resolvedResult != undefined) {
          pendingDecode.resolve(pendingDecode.resolvedResult);
          return;
        }
        this.#handleDecodedFrame();
      });
      this.#handleDecodedFrame();
    });
  }

  /**
   * Waits for the target frame from the most recent `decodeFrames()` call to arrive, even if
   * `decodeFrames()` already resolved with an `intermediate` or `timeout` result. Useful when the
   * caller needs to display a placeholder while the slow target still works its way through the
   * decoder pipeline. Throws if called without a pending target or if a previous wait is still
   * outstanding.
   */
  public async awaitTargetFrame(): Promise<VideoFrame> {
    const targetTimestampMicros =
      this.#pendingDecode?.targetTimestampMicros ?? this.#pendingTargetTimestampMicros;
    if (targetTimestampMicros == undefined) {
      throw new Error("awaitTargetFrame called without a pending target");
    }

    const frame = this.#dequeueFrame(targetTimestampMicros);
    if (frame) {
      return frame;
    }
    if (this.#targetWaiter) {
      throw new Error("awaitTargetFrame called while a previous target wait is still in progress");
    }

    return await new Promise<VideoFrame>((resolve, reject) => {
      this.#targetWaiter = {
        targetTimestampMicros,
        resolve: (targetFrame) => {
          if (this.#targetWaiter?.resolve === resolve) {
            this.#targetWaiter = undefined;
          }
          resolve(targetFrame);
        },
        reject: (error) => {
          if (this.#targetWaiter?.reject === reject) {
            this.#targetWaiter = undefined;
          }
          reject(error);
        },
      };
      this.#handleDecodedFrame();
    });
  }

  #decodeChunk(data: Uint8Array, timestampMicros: number, type: "key" | "delta"): boolean {
    if (
      this.#lastSubmittedTimestampMicros != undefined &&
      timestampMicros <= this.#lastSubmittedTimestampMicros
    ) {
      const error = new Error(
        `Failed to decode ${data.byteLength} byte chunk at time ${timestampMicros}: timestamp must increase`,
      );
      this.emit("error", error);
      return false;
    }

    try {
      const chunkData =
        data.byteOffset !== 0 || data.byteLength !== data.buffer.byteLength ? data.slice() : data;
      this.#currentDecodeTimestampMicros = timestampMicros;
      const chunkInit: EncodedVideoChunkInit & { transfer?: ArrayBuffer[] } = {
        type,
        data: chunkData,
        timestamp: timestampMicros,
        transfer: chunkData.buffer instanceof ArrayBuffer ? [chunkData.buffer] : undefined,
      };
      this.#decoder.decode(new EncodedVideoChunk(chunkInit));
      this.#lastSubmittedTimestampMicros = timestampMicros;
      return true;
    } catch (unk) {
      const error = new Error(
        `Failed to decode ${data.byteLength} byte chunk at time ${timestampMicros}: ${(unk as Error).message}`,
      );
      this.emit("error", error);
      return false;
    }
  }

  #waitForDecodeQueueDrain(timeoutMs: number, onDrain: () => void): void {
    if (this.#decoder.decodeQueueSize === 0) {
      onDrain();
      return;
    }

    const previousOndequeue = this.#decoder.ondequeue;
    const handleDequeue = (event: Event) => {
      previousOndequeue?.call(this.#decoder, event);
      if (this.#decoder.decodeQueueSize > 0) {
        return;
      }
      clearTimeout(timeoutId);
      if (this.#decoder.ondequeue === handleDequeue) {
        this.#decoder.ondequeue = previousOndequeue;
      }
      onDrain();
    };

    const timeoutId = setTimeout(() => {
      if (this.#decoder.ondequeue === handleDequeue) {
        this.#decoder.ondequeue = previousOndequeue;
      }
      onDrain();
    }, timeoutMs);

    this.#decoder.ondequeue = handleDequeue;
  }

  #handleDecodedFrame(timestampMicros?: number): void {
    if (this.#targetWaiter) {
      const frame = this.#dequeueFrame(this.#targetWaiter.targetTimestampMicros);
      if (frame) {
        this.#pendingTargetTimestampMicros = undefined;
        this.#targetWaiter.resolve(frame);
        return;
      }
    }

    if (!this.#pendingDecode) {
      return;
    }

    const targetFrame = this.#dequeueFrame(this.#pendingDecode.targetTimestampMicros);
    if (targetFrame) {
      this.#pendingTargetTimestampMicros = undefined;
      this.#resolvePendingDecodeWhenReady({ type: "target", frame: targetFrame });
      return;
    }

    if (
      performance.now() >= this.#pendingDecode.targetDeadlineMs &&
      (timestampMicros != undefined || this.#pendingFrameOrder.length > 0)
    ) {
      const frame =
        (timestampMicros == undefined ? undefined : this.#dequeueFrame(timestampMicros)) ??
        this.#dequeueNewestFrame();
      if (frame) {
        this.#resolvePendingDecodeWhenReady({ type: "intermediate", frame });
      }
    }
  }

  #resolvePendingDecodeWhenReady(result: DecodeFramesResult): void {
    const pendingDecode = this.#pendingDecode;
    if (!pendingDecode) {
      return;
    }
    if (pendingDecode.waitForQueueDrain && !pendingDecode.drained) {
      pendingDecode.resolvedResult = result;
      return;
    }
    pendingDecode.resolve(result);
  }

  #dequeueFrame(targetTimestampMicros?: number): VideoFrame | undefined {
    let timestampMicros: number | undefined;
    if (targetTimestampMicros == undefined) {
      timestampMicros = this.#pendingFrameOrder.shift();
    } else {
      if (!this.#pendingFrames.has(targetTimestampMicros)) {
        return undefined;
      }
      timestampMicros = targetTimestampMicros;
      const index = this.#pendingFrameOrder.indexOf(targetTimestampMicros);
      if (index >= 0) {
        this.#pendingFrameOrder.splice(index, 1);
      }
    }

    return this.#takePendingFrame(timestampMicros);
  }

  #dequeueNewestFrame(): VideoFrame | undefined {
    const timestampMicros = this.#pendingFrameOrder.pop();
    return this.#takePendingFrame(timestampMicros);
  }

  #takePendingFrame(timestampMicros: number | undefined): VideoFrame | undefined {
    if (timestampMicros == undefined) {
      return undefined;
    }
    const maybeVideoFrame = this.#pendingFrames.get(timestampMicros);
    this.#pendingFrames.delete(timestampMicros);

    if (maybeVideoFrame) {
      if (!this.#codedSize) {
        this.#codedSize = { width: 0, height: 0 };
      }
      this.#codedSize.width = maybeVideoFrame.codedWidth;
      this.#codedSize.height = maybeVideoFrame.codedHeight;
      this.lastVideoFrame?.close();
      this.lastVideoFrame = maybeVideoFrame.clone();
    }

    return maybeVideoFrame;
  }

  /**
   * Reset the VideoDecoder and clear any pending frames, but keep the decoder configuration so
   * the next `decodeFrames()` call can submit chunks immediately. Call this when seeking to a
   * new position in the stream.
   *
   * Per the WebCodecs spec, `VideoDecoder.reset()` returns the decoder to the unconfigured state,
   * so we re-apply the cached `VideoDecoderConfig` here. Without this, the next `decodeFrames()`
   * call would observe `state === "unconfigured"` and bail out with a timeout result.
   */
  public resetForSeek(): void {
    if (this.#decoder.state === "configured") {
      this.#decoder.reset();
      if (this.#decoderConfig != undefined) {
        this.#decoder.configure(this.#decoderConfig);
      }
    }
    this.#disposePendingState("Decoder reset");
  }

  /**
   * Close the VideoDecoder and clear any pending frames. Also clears the cached decoder
   * configuration; a subsequent `init()` is required before more decoding.
   */
  public close(): void {
    if (this.#decoder.state !== "closed") {
      this.#decoder.close();
    }
    this.#disposePendingState("Decoder closed");
    this.#decoderConfig = undefined;
  }

  #disposePendingState(waiterRejectReason: string): void {
    const abortedFrame = this.#dequeueNewestFrame();
    this.#pendingDecode?.resolve({ type: "aborted", frame: abortedFrame });
    this.#pendingDecode = undefined;
    this.#pendingTargetTimestampMicros = undefined;
    this.#lastSubmittedTimestampMicros = undefined;
    this.#currentDecodeTimestampMicros = undefined;
    this.#targetWaiter?.reject(new Error(waiterRejectReason));
    this.#targetWaiter = undefined;
    for (const frame of this.#pendingFrames.values()) {
      frame.close();
    }
    this.#pendingFrames.clear();
    this.#pendingFrameOrder.length = 0;
    this.lastVideoFrame?.close();
    this.lastVideoFrame = undefined;
    this.lastImageBitmap?.close();
    this.lastImageBitmap = undefined;
  }
}
