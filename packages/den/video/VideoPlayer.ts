// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Mutex } from "async-mutex";
import EventEmitter from "eventemitter3";

import { H265_TARGET_FRAME_WAIT_MS } from "./h265/constants";

// foxglove-depcheck-used: @types/dom-webcodecs

// H.264 typically emits a decoded VideoFrame within a couple of milliseconds of submitting an
// EncodedVideoChunk, so a tight 30 ms ceiling lets us return quickly when decoding is healthy and
// fail fast when the decoder is stuck. The H.265 budgets live in `./h265/constants.ts` and are
// much larger because HEVC decoders may need to consume an entire GOP before emitting the target
// frame.
const DEFAULT_TARGET_FRAME_WAIT_MS = 10;

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

type FrameWaiter = {
  promise: Promise<DecodeFramesResult>;
  resolve: (result: DecodeFramesResult) => void;
  timeoutId: ReturnType<typeof setTimeout>;
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
  readonly #frameWaiters = new Map<number, FrameWaiter>();
  #lastSubmittedTimestampMicros: number | undefined;
  #currentDecodeTimestampMicros: number | undefined;
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

        const waiter = this.#frameWaiters.get(timestampMicros);
        if (!waiter) {
          // No awaiter for this timestamp: either a reference (non-target) frame from a
          // GOP chain, or a late frame that arrived after its timeout/seek. Nobody will
          // claim it, so close it now to avoid the "VideoFrame GC without close" stall.
          videoFrame.close();
          return;
        }

        clearTimeout(waiter.timeoutId);
        this.#frameWaiters.delete(timestampMicros);

        // Replicate the display-cache bookkeeping that #takePendingFrame used to do.
        this.#cacheDisplayFrame(videoFrame);

        // Hand the original frame to the awaiter; the caller closes it.
        waiter.resolve({ type: "target", frame: videoFrame });
        this.emit("frame", videoFrame);
      },
      error: (error) => {
        const timestampSec =
          this.#currentDecodeTimestampMicros == undefined
            ? ""
            : ` @ frame timestamp: ${this.#currentDecodeTimestampMicros / 1_000_000}s`;
        const decodeError = new DOMException(`${error.message}${timestampSec}`, error.name);

        for (const waiter of this.#frameWaiters.values()) {
          clearTimeout(waiter.timeoutId);
          waiter.resolve({ type: "aborted" });
        }
        this.#frameWaiters.clear();

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
   * Concurrent calls are safe: a shared mutex serializes the body in FIFO acquisition order, which
   * also matches the order in which chunks are submitted to the underlying VideoDecoder. This is
   * what lets `ImageRenderable` fire H.264 `#startDecode` calls in parallel without losing the
   * keyframe-first ordering that the decoder needs to produce non-garbled output after a seek.
   */
  public async decodeFrames(frames: EncodedVideoFrame[]): Promise<DecodeFramesResult> {
    const targetFrame = frames.at(-1);
    if (targetFrame == undefined) {
      return { type: "timeout" };
    }

    let waiterPromise: Promise<DecodeFramesResult> | undefined;

    // Await the exclusive section so the synchronous submit (and waiter registration) has actually
    // run before we read waiterPromise. The callback is synchronous, so the lock is held only for
    // the in-order submit
    await this.#mutex
      .runExclusive(() => {
        // check decoder state, submit chunks, register waiters
        if (this.#decoder.state === "closed") {
          this.emit("warn", "VideoDecoder is closed, creating a new one");
          this.#decoder = new VideoDecoder(this.#decoderInit);
          if (this.#decoderConfig != undefined) {
            this.#decoder.configure(this.#decoderConfig);
          }
        }

        if (this.#decoder.state === "unconfigured") {
          this.emit("debug", "Waiting for initialization...");
          waiterPromise = Promise.resolve({ type: "timeout" });
          return;
        }

        const isH265 =
          this.#decoderConfig?.codec.startsWith("hev1") === true ||
          this.#decoderConfig?.codec.startsWith("hvc1") === true;
        const targetFrameWaitMs = isH265 ? H265_TARGET_FRAME_WAIT_MS : DEFAULT_TARGET_FRAME_WAIT_MS;

        // Register the target waiter BEFORE submitting so the output callback always finds it,
        // even if the decoder delivers the frame synchronously during decode(). Reference
        // (non-target) frames hit the output callback with no waiter and are closed immediately.
        const waiter = this.#registerFrameWaiter(targetFrame.timestampMicros, targetFrameWaitMs);
        this.#frameWaiters.set(targetFrame.timestampMicros, waiter);
        waiterPromise = waiter.promise;

        // Submit every chunk in order so the decoder's dependency chain stays intact.
        for (const frame of frames) {
          if (!this.#decodeChunk(frame.data, frame.timestampMicros, frame.type)) {
            // Submission failed: tear down the target waiter and report a timeout.
            clearTimeout(waiter.timeoutId);
            this.#frameWaiters.delete(targetFrame.timestampMicros);
            waiterPromise = Promise.resolve({ type: "timeout" });
            return;
          }
        }
      })
      .catch((error_: unknown) => {
        const error = new Error(`Failed to submit decode chain: ${(error_ as Error).message}`);
        this.emit("error", error);
        waiterPromise = Promise.resolve({ type: "aborted" });
      });

    return (await waiterPromise) ?? { type: "timeout" };
  }

  #registerFrameWaiter(timestampMicros: number, timeoutMs: number): FrameWaiter {
    let resolve!: (result: DecodeFramesResult) => void;

    const promise = new Promise<DecodeFramesResult>((res) => {
      resolve = res;
    });

    const timeoutId = setTimeout(() => {
      this.#frameWaiters.delete(timestampMicros);
      resolve({ type: "timeout" });
    }, timeoutMs);

    return { promise, resolve, timeoutId };
  }

  #cacheDisplayFrame(videoFrame: VideoFrame): void {
    if (!this.#codedSize) {
      this.#codedSize = { width: 0, height: 0 };
    }
    this.#codedSize.width = videoFrame.codedWidth;
    this.#codedSize.height = videoFrame.codedHeight;
    this.lastVideoFrame?.close();
    this.lastVideoFrame = videoFrame.clone();
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

  /**
   * Reset the VideoDecoder and clear any pending frames when seeking.
   *
   * We intentionally do not re-configure here. Callers already transition to
   * keyframe-gated decode after a seek and call `init()` on that keyframe, so
   * re-configuring in `resetForSeek()` would do duplicate work and add latency.
   *
   */
  public resetForSeek(): void {
    if (this.#decoder.state === "configured") {
      this.#decoder.reset();
    }
    this.#disposePendingState();
  }

  /**
   * Close the VideoDecoder and clear any pending frames. Also clears the cached decoder
   * configuration; a subsequent `init()` is required before more decoding.
   */
  public close(): void {
    if (this.#decoder.state !== "closed") {
      this.#decoder.close();
    }
    this.#disposePendingState();
    // The player is being torn down, so the display cache is freed here
    this.lastVideoFrame?.close();
    this.lastVideoFrame = undefined;
    this.lastImageBitmap?.close();
    this.lastImageBitmap = undefined;
    this.#decoderConfig = undefined;
  }

  #disposePendingState(): void {
    // The decoder is reset/closed by the caller before this runs, so any still-registered waiter
    // will never receive its frame. Abort them all (load-bearing on seek: a post-seek frame could
    // otherwise reuse the same timestamp as a stale waiter).
    for (const waiter of this.#frameWaiters.values()) {
      clearTimeout(waiter.timeoutId);
      waiter.resolve({ type: "aborted" });
    }
    this.#frameWaiters.clear();

    this.#lastSubmittedTimestampMicros = undefined;
    this.#currentDecodeTimestampMicros = undefined;
    // lastVideoFrame/lastImageBitmap are intentionally NOT closed here. This runs on every
    // seek/loop reset, and discarding the cached frame forces the renderer into emptyVideoFrame()
  }
}
