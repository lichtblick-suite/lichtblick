// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Mutex } from "async-mutex";
import EventEmitter from "eventemitter3";

// foxglove-depcheck-used: @types/dom-webcodecs

const DEFAULT_TARGET_FRAME_WAIT_MS = 10;
const DEFAULT_MAX_DECODE_WAIT_MS = 30;
const HEVC_MAX_DECODE_WAIT_MS = 2000;
const HEVC_TARGET_FRAME_WAIT_MS = HEVC_MAX_DECODE_WAIT_MS;

export type EncodedVideoFrame = {
  data: Uint8Array;
  timestampMicros: number;
  type: "key" | "delta";
};

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
  overallTimeoutId: ReturnType<typeof setTimeout>;
};

export type VideoPlayerEventTypes = {
  frame: (frame: VideoFrame) => void;
  debug: (message: string) => void;
  warn: (message: string) => void;
  error: (error: Error) => void;
};

export class VideoPlayer extends EventEmitter<VideoPlayerEventTypes> {
  readonly #decoderInit: VideoDecoderInit;
  #decoder: VideoDecoder;
  #decoderConfig: VideoDecoderConfig | undefined;
  readonly #mutex = new Mutex();
  readonly #pendingFrames = new Map<number, VideoFrame>();
  readonly #pendingFrameOrder: number[] = [];
  #pendingDecode: PendingDecode | undefined;
  #pendingTargetTimestampMicros: number | undefined;
  #lastSubmittedTimestampMicros: number | undefined;
  #currentDecodeTimestampMicros: number | undefined;
  #targetWaiter:
    | {
        targetTimestampMicros: number;
        resolve: (frame: VideoFrame) => void;
        reject: (error: Error) => void;
      }
    | undefined;
  #codedSize: { width: number; height: number } | undefined;
  public lastImageBitmap: ImageBitmap | undefined;
  public lastVideoFrame: VideoFrame | undefined;

  public static IsSupported(): boolean {
    return self.isSecureContext && "VideoDecoder" in globalThis;
  }

  public constructor() {
    super();
    this.#decoderInit = {
      output: (videoFrame: VideoFrame) => {
        const timestampMicros = Number(videoFrame.timestamp);
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
          this.#currentDecodeTimestampMicros != undefined
            ? ` @ frame timestamp: ${this.#currentDecodeTimestampMicros / 1_000_000}s`
            : "";
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

  public async init(decoderConfig: VideoDecoderConfig): Promise<void> {
    await this.#mutex.runExclusive(async () => {
      const preferredConfig: VideoDecoderConfig = {
        ...decoderConfig,
        optimizeForLatency: true,
      };
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

  public isInitialized(): boolean {
    return this.#decoder.state === "configured";
  }

  public decoderConfig(): VideoDecoderConfig | undefined {
    return this.#decoderConfig;
  }

  public codedSize(): { width: number; height: number } | undefined {
    return this.#codedSize;
  }

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

  public async decodeFrames(frames: EncodedVideoFrame[]): Promise<DecodeFramesResult> {
    if (frames.length === 0) {
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

    const isHevc =
      this.#decoderConfig?.codec.startsWith("hev1") === true ||
      this.#decoderConfig?.codec.startsWith("hvc1") === true;
    const targetFrameWaitMs = isHevc ? HEVC_TARGET_FRAME_WAIT_MS : DEFAULT_TARGET_FRAME_WAIT_MS;
    const maxDecodeWaitMs = isHevc ? HEVC_MAX_DECODE_WAIT_MS : DEFAULT_MAX_DECODE_WAIT_MS;
    const targetFrame = frames[frames.length - 1]!;

    this.#pendingTargetTimestampMicros = targetFrame.timestampMicros;

    return await new Promise<DecodeFramesResult>((resolve, reject) => {
      const pendingDecode: PendingDecode = {
        targetTimestampMicros: targetFrame.timestampMicros,
        targetDeadlineMs: performance.now() + targetFrameWaitMs,
        waitForQueueDrain: isHevc,
        drained: !isHevc,
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
        overallTimeoutId: undefined as unknown as ReturnType<typeof setTimeout>,
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
        (timestampMicros != undefined ? this.#dequeueFrame(timestampMicros) : undefined) ??
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
    if (targetTimestampMicros != undefined) {
      if (!this.#pendingFrames.has(targetTimestampMicros)) {
        return undefined;
      }
      timestampMicros = targetTimestampMicros;
      const index = this.#pendingFrameOrder.indexOf(targetTimestampMicros);
      if (index >= 0) {
        this.#pendingFrameOrder.splice(index, 1);
      }
    } else {
      timestampMicros = this.#pendingFrameOrder.shift();
    }

    return this.#takePendingFrame(timestampMicros);
  }

  #dequeueNewestFrame(): VideoFrame | undefined {
    const timestampMicros = this.#pendingFrameOrder.pop();
    return this.#takePendingFrame(timestampMicros);
  }

  #takePendingFrame(timestampMicros: number | undefined): VideoFrame | undefined {
    const maybeVideoFrame =
      timestampMicros != undefined ? this.#pendingFrames.get(timestampMicros) : undefined;
    if (timestampMicros != undefined) {
      this.#pendingFrames.delete(timestampMicros);
    }

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

  public resetForSeek(): void {
    if (this.#decoder.state === "configured") {
      this.#decoder.reset();
    }
    this.#disposePendingState("Decoder reset");
  }

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
