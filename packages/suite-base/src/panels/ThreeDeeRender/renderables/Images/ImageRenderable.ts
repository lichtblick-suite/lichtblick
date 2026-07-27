// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as _ from "lodash-es";
import * as THREE from "three";
import { assert } from "ts-essentials";

import {
  EncodedVideoFrame,
  VideoCodec,
  VideoPlayer,
  canonicalVideoCodec,
  videoCodecNeedsKeyframeReplay,
} from "@lichtblick/den/video";
import Logger from "@lichtblick/log";
import { toNanoSec } from "@lichtblick/rostime";
import { ICameraModel } from "@lichtblick/suite";
import { IRenderer } from "@lichtblick/suite-base/panels/ThreeDeeRender/IRenderer";
import { BaseUserData, Renderable } from "@lichtblick/suite-base/panels/ThreeDeeRender/Renderable";
import { stringToRgba } from "@lichtblick/suite-base/panels/ThreeDeeRender/color";
import {
  clampBrightness,
  clampContrast,
} from "@lichtblick/suite-base/panels/ThreeDeeRender/renderables/ImageMode/utils";
import { WorkerImageDecoder } from "@lichtblick/suite-base/panels/ThreeDeeRender/renderables/Images/WorkerImageDecoder";
import { projectPixel } from "@lichtblick/suite-base/panels/ThreeDeeRender/renderables/projections";
import { RosValue } from "@lichtblick/suite-base/players/types";

import { AnyImage, CompressedVideo } from "./ImageTypes";
import {
  decodeCompressedImageToBitmap,
  decodeCompressedVideoToBitmap,
  emptyVideoFrame,
  prepareVideoFrame,
} from "./decodeImage";
import { PreparedVideoFrame, PreparedVideoFrameStatus } from "./types";
import { CameraInfo } from "../../ros";
import {
  DECODE_IMAGE_ERR_KEY,
  FRAGMENT_SHADER,
  IMAGE_TOPIC_PATH,
  INITIAL_BRIGHTNESS,
  INITIAL_CONTRAST,
  VERTEX_SHADER,
} from "../ImageMode/constants";
import { ColorModeSettings } from "../colorMode";

const log = Logger.getLogger(__filename);
export interface ImageRenderableSettings extends Partial<ColorModeSettings> {
  visible: boolean;
  frameLocked?: boolean;
  cameraInfoTopic: string | undefined;
  distance: number;
  planarProjectionFactor: number;
  color: string;
  brightness: number;
  contrast: number;
}

const DEFAULT_DISTANCE = 1;
const DEFAULT_PLANAR_PROJECTION_FACTOR = 0;
export const IMAGE_RENDERABLE_DEFAULT_SETTINGS: ImageRenderableSettings = {
  visible: false,
  frameLocked: true,
  cameraInfoTopic: undefined,
  distance: DEFAULT_DISTANCE,
  planarProjectionFactor: DEFAULT_PLANAR_PROJECTION_FACTOR,
  color: "#ffffff",
  brightness: INITIAL_BRIGHTNESS,
  contrast: INITIAL_CONTRAST,
};

const VIDEO_TIMESTAMP_JITTER_NS = 5_000_000n;

/**
 * Per-renderable cap on the GOP backfill cache (`#videoFrameHistory`).
 *
 * The cache lets us reconstruct a frame on a backward seek by replaying the most recent keyframe
 * plus all P-frames up to the seek target. To keep that replay possible without unbounded growth
 * we need to hold at least one full GOP plus some slack for codec implementations that emit
 * longer-than-typical key-to-key distances.
 *
 * Real-world H.265 recordings encountered so far use keyframe intervals on the order of 1–10 s
 * (≈30–600 frames at 30–60 fps). 2000 frames is roughly 30–60 s of history, which covers several
 * GOPs of slack while bounding the memory footprint of the cached encoded payloads to the order
 * of tens of MB per topic even on high-bitrate streams. If a recording ever needs a deeper cache,
 * this is the single knob to raise — but increasing it linearly increases per-renderable memory
 * use, so prefer fixing pathological GOP cadence at the source first.
 */
const MAX_VIDEO_FRAME_HISTORY = 2000;

/**
 * Byte ceiling for the GOP backfill cache, applied alongside {@link MAX_VIDEO_FRAME_HISTORY}. The
 * frame-count cap alone does not bound memory on high-bitrate streams, where 2000 encoded payloads
 * can reach hundreds of MB. Whichever limit is hit first evicts the oldest entries.
 */
const MAX_VIDEO_FRAME_HISTORY_BYTES = 256 * 1024 * 1024;

type PendingVideoDecode = {
  image: AnyImage;
  resizeWidth?: number;
  onDecoded?: () => void;
  seq: number;
};

type PreparedIncomingVideoFrame = {
  preparedFrame: PreparedVideoFrame;
  messageTime: bigint;
  timestampMicros: number;
};

type VideoFrameHistoryEntry = {
  frame: CompressedVideo;
  type: "key" | "delta";
  decoderConfig?: VideoDecoderConfig;
  timestampMicros: number;
};

export type ImageUserData = BaseUserData & {
  topic: string;
  settings: ImageRenderableSettings;
  firstMessageTime: bigint | undefined;
  cameraInfo: CameraInfo | undefined;
  cameraModel: ICameraModel | undefined;
  image: AnyImage | undefined;
  texture: THREE.Texture | undefined;
  // The material should use ShaderMaterial so we can use custom shaders to apply effects like brightness and contrast
  material: THREE.ShaderMaterial | undefined;
  geometry: THREE.PlaneGeometry | undefined;
  mesh: THREE.Mesh | undefined;
};

export class ImageRenderable extends Renderable<ImageUserData> {
  // A lazily instantiated player for compressed video
  public videoPlayer: VideoPlayer | undefined;

  // Make sure that everything is build the first time we render
  // set when camera info or image changes
  #geometryNeedsUpdate = true;
  // set when geometry or material reference changes
  #meshNeedsUpdate = true;
  // set when image changes
  #textureNeedsUpdate = true;
  // set when material or texture changes
  #materialNeedsUpdate = true;

  #renderBehindScene: boolean = false;

  #isUpdating = false;

  #decodedImage?: ImageBitmap | ImageData;
  protected decoder?: WorkerImageDecoder;
  #receivedImageSequenceNumber = 0;
  #displayedImageSequenceNumber = 0;
  #showingErrorImage = false;
  // Decoder config parsed from the most recent keyframe. Delta frames carry no parameter sets, so
  // they reuse this instead of reparsing the SPS.
  #cachedVideoDecoderConfig?: VideoDecoderConfig;
  #videoFirstMessageTime: bigint | undefined;
  #lastVideoMessageTime: bigint | undefined;
  #lastQueuedVideoMessageTime: bigint | undefined;
  #waitingForVideoKeyframe = false;
  #canReplayVideoGop = false;
  // Resolves when the in-flight video decode drain (started by `flushPendingDecodes`) settles.
  // Used to gate the panel's frame barrier on a seek so the cursor parks until the seek frame
  // is actually decoded and painted, instead of resuming play before the image is ready.
  #activeVideoDecode: Promise<void> | undefined;
  readonly #pendingVideoDecodeQueue: PendingVideoDecode[] = [];
  #videoFrameHistory: VideoFrameHistoryEntry[] = [];
  #videoFrameHistoryBytes = 0;

  #disposed = false;

  #videoFormat: string | undefined;
  // Cache canonical codec normalization by incoming format string to avoid repeated prefix checks
  // while still handling format changes on a reused renderable instance.
  readonly #codecByFormat = new Map<string, VideoCodec | undefined>();
  #codec: VideoCodec | undefined;

  public constructor(topicName: string, renderer: IRenderer, userData: ImageUserData) {
    super(topicName, renderer, userData);
  }

  protected isDisposed(): boolean {
    return this.#disposed;
  }

  public getDecodedImage(): ImageBitmap | ImageData | undefined {
    return this.#decodedImage;
  }

  public override dispose(): void {
    this.#disposed = true;
    this.userData.texture?.dispose();
    this.userData.material?.dispose();
    this.userData.geometry?.dispose();
    this.videoPlayer?.close();
    this.decoder?.terminate();
    // Release the GOP backfill cache. Entries hold frame references and replay metadata for up to
    // MAX_VIDEO_FRAME_HISTORY timestamps; clearing on dispose keeps per-renderable memory bounded.
    this.#videoFrameHistory.length = 0;
    this.#videoFrameHistoryBytes = 0;
    this.#pendingVideoDecodeQueue.length = 0;
    super.dispose();
  }

  public updateHeaderInfo(): void {
    assert(this.userData.image, "updateHeaderInfo called without image");

    // If there is camera info, the frameId comes from the camera info since the user may have
    // selected camera info with a different frame than our image frame.
    //
    // If there is no camera info, we fall back to the image's frame
    const image = this.userData.image;
    const rawFrameId =
      this.userData.cameraInfo?.header.frame_id ??
      ("header" in image ? image.header.frame_id : image.frame_id);
    this.userData.frameId =
      typeof rawFrameId === "string" ? this.renderer.normalizeFrameId(rawFrameId) : rawFrameId;
    this.userData.messageTime = toNanoSec("header" in image ? image.header.stamp : image.timestamp);
  }

  public override details(): Record<string, RosValue> {
    return { image: this.userData.image, camera_info: this.userData.cameraInfo };
  }

  public setRenderBehindScene(): void {
    this.#renderBehindScene = true;
    this.#materialNeedsUpdate = true;
    this.#meshNeedsUpdate = true;
  }

  // Renderable should only need to care about the model
  public setCameraModel(cameraModel: ICameraModel): void {
    this.#geometryNeedsUpdate ||= this.userData.cameraModel !== cameraModel;
    this.userData.cameraModel = cameraModel;
  }

  public setSettings(newSettings: ImageRenderableSettings): void {
    const prevSettings = this.userData.settings;
    if (prevSettings.cameraInfoTopic !== newSettings.cameraInfoTopic) {
      // clear mesh since it is no longer showing userData accurately
      if (this.userData.mesh != undefined) {
        this.remove(this.userData.mesh);
      }
      this.userData.mesh = undefined;
      this.#geometryNeedsUpdate = true;
    }
    if (
      prevSettings.distance !== newSettings.distance ||
      newSettings.planarProjectionFactor !== prevSettings.planarProjectionFactor
    ) {
      this.#geometryNeedsUpdate = true;
    }

    if (
      newSettings.color !== prevSettings.color ||
      prevSettings.brightness !== newSettings.brightness ||
      prevSettings.contrast !== newSettings.contrast
    ) {
      this.#materialNeedsUpdate = true;
    }

    if (
      prevSettings.colorMode !== newSettings.colorMode ||
      prevSettings.flatColor !== newSettings.flatColor ||
      !_.isEqual(prevSettings.gradient, newSettings.gradient) ||
      prevSettings.colorMap !== newSettings.colorMap ||
      prevSettings.minValue !== newSettings.minValue ||
      prevSettings.maxValue !== newSettings.maxValue
    ) {
      this.userData.settings = newSettings;
      // Decode the current image again, which takes into account the new options
      const image = this.userData.image;
      if (image) {
        this.setImage(image);
      }
      return;
    }

    this.userData.settings = newSettings;
  }

  public setImage(image: AnyImage, resizeWidth?: number, onDecoded?: () => void): void {
    this.userData.image = image;

    const seq = ++this.#receivedImageSequenceNumber;
    const incomingFormat = "format" in image ? image.format : undefined;
    const incomingCodec =
      incomingFormat == undefined ? undefined : this.#cachedCanonicalCodec(incomingFormat);
    const incomingVideoFormat = incomingCodec == undefined ? undefined : incomingFormat;
    if (incomingCodec !== this.#codec || incomingVideoFormat !== this.#videoFormat) {
      this.#resetCodecStateForFormatChange(incomingCodec, incomingVideoFormat);
    }
    const codec = this.#codec;

    if (codec != undefined) {
      const videoImage = image as CompressedVideo;
      const messageTime = toNanoSec(videoImage.timestamp);
      // Duplicate exact-timestamp resubmission — `expandVideoSeekBackfill` can include the
      // already-delivered target frame alongside its preceding GOP. Suppress the redundant decode.
      // Only apply this dedupe when the decoder is in a healthy initialized state; after a seek
      // reset (decoder uninitialized) we must allow the keyframe through even if its timestamp
      // matches the last queued one from the previous epoch.
      const isVideoPlayerHealthy = this.videoPlayer?.isInitialized() === true;
      if (
        isVideoPlayerHealthy &&
        !this.#waitingForVideoKeyframe &&
        messageTime === this.#lastQueuedVideoMessageTime
      ) {
        return;
      }
      // A backward jump detected at enqueue time means anything still queued is a pre-seek
      // leftover that must be dropped before this frame's GOP arrives. For non-replay codecs the
      // same signal also flips us from parallel decode into the queue + drain path so the
      // keyframe in the incoming GOP fully processes — and clears `#waitingForVideoKeyframe` —
      // before any P-frame in that GOP evaluates that gate inside `decodeImage`.
      const backwardSeekDetected =
        this.#lastQueuedVideoMessageTime != undefined &&
        messageTime < this.#lastQueuedVideoMessageTime &&
        this.#lastQueuedVideoMessageTime - messageTime > VIDEO_TIMESTAMP_JITTER_NS;

      if (backwardSeekDetected) {
        this.#pendingVideoDecodeQueue.length = 0;
      }
      this.#lastQueuedVideoMessageTime = messageTime;

      // All video codecs go through the single drain pipeline. The drain decodes serially (which
      // every codec needs after a seek so the keyframe clears `#waitingForVideoKeyframe` before
      // its P-frames evaluate that gate) and collapses a burst to a single GPU upload via
      // `skipRender`, so a high-speed catch-up paints only the latest frame instead of one bitmap
      // per frame. It also makes the in-flight work awaitable through `#activeVideoDecode`, so a
      // pause stops painting at the current frame instead of letting orphaned parallel decodes
      // keep drawing for a second after stop.
      this.#pendingVideoDecodeQueue.push({ image, resizeWidth, onDecoded, seq });
      return;
    }

    // Raw (non-video) images decode in parallel; the `#displayedImageSequenceNumber > seq` guard
    // inside `#startDecode` drops late results.
    void this.#startDecode(image, seq, resizeWidth, onDecoded);
  }

  #cachedCanonicalCodec(format: string): VideoCodec | undefined {
    if (this.#codecByFormat.has(format)) {
      return this.#codecByFormat.get(format);
    }

    const codec = canonicalVideoCodec(format);
    this.#codecByFormat.set(format, codec);
    return codec;
  }

  #resetCodecStateForFormatChange(
    nextCodec: VideoCodec | undefined,
    nextVideoFormat: string | undefined,
  ): void {
    this.#codec = nextCodec;
    this.#videoFormat = nextVideoFormat;
    this.#cachedVideoDecoderConfig = undefined;
    this.#videoFirstMessageTime = undefined;
    this.#lastVideoMessageTime = undefined;
    this.#lastQueuedVideoMessageTime = undefined;
    this.#waitingForVideoKeyframe = nextCodec != undefined;
    this.#canReplayVideoGop = false;
    this.#pendingVideoDecodeQueue.length = 0;
    this.#videoFrameHistory.length = 0;
    this.videoPlayer?.resetForSeek();
  }

  /**
   * Start draining the pending video decode queue if it is non-empty and not already draining.
   *
   * Call this after all `setImage` calls for the current render frame have been made (i.e. from
   * the scene extension's `startFrame()` hook). At that point the queue contains the full batch of
   * frames for this frame, so `skipRender` correctly identifies every frame except the last one as
   * an intermediate that does not need a GPU upload.
   */
  public flushPendingDecodes(): void {
    if (this.#pendingVideoDecodeQueue.length > 0 && this.#activeVideoDecode == undefined) {
      this.#activeVideoDecode = this.#drainPendingVideoDecodes().finally(() => {
        this.#activeVideoDecode = undefined;
      });
    }
  }

  /**
   * Resolves once any in-flight video decode drain has fully settled (all queued frames decoded
   * and the latest painted). Used to gate the panel frame barrier on a seek so the cursor parks
   * on the target until the seek frame is rendered. Resolves immediately when nothing is decoding.
   */
  public async settleVideoDecodes(): Promise<void> {
    await this.#activeVideoDecode;
  }

  /**
   * Reset decoder state for an external seek and force keyframe-gated decode on next frames.
   */
  public resetVideoForSeek(): void {
    this.videoPlayer?.resetForSeek();
    this.#waitingForVideoKeyframe = true;
    this.#canReplayVideoGop = true;
    this.#pendingVideoDecodeQueue.length = 0;
    this.#lastQueuedVideoMessageTime = undefined;
  }

  async #drainPendingVideoDecodes(): Promise<void> {
    while (this.#pendingVideoDecodeQueue.length > 0) {
      const pendingDecode = this.#pendingVideoDecodeQueue.shift();
      if (pendingDecode == undefined) {
        break;
      }
      // Decode every frame so the P-frame reference chain stays intact, but only paint a frame
      // when no newer frame has been received. During a seek-while-playing catch-up the decoder
      // works off a backlog (the replayed GOP plus frames that arrived while decoding) faster
      // than realtime; painting each one would fast-forward the video. Skipping all but the
      // latest-received frame collapses the burst into a single jump to the current frame.
      // Using the received sequence number (not the momentary queue length) is robust to frames
      // being fed incrementally across multiple drain passes during playback.
      const skipRender = pendingDecode.seq < this.#receivedImageSequenceNumber;

      await this.#startDecode(
        pendingDecode.image,
        pendingDecode.seq,
        pendingDecode.resizeWidth,
        pendingDecode.onDecoded,
        { skipRender },
      );
    }
  }

  async #startDecode(
    image: AnyImage,
    seq: number,
    resizeWidth?: number,
    onDecoded?: () => void,
    options?: { skipRender?: boolean },
  ): Promise<void> {
    try {
      const skipRender = options?.skipRender ?? false;
      const result = await this.decodeImage(image, resizeWidth);
      if (this.isDisposed()) {
        return;
      }
      if (this.#displayedImageSequenceNumber > seq) {
        return;
      }
      this.#displayedImageSequenceNumber = seq;
      this.#decodedImage = result;
      this.#textureNeedsUpdate = true;
      if (!skipRender) {
        this.update();
      }
      this.#showingErrorImage = false;

      onDecoded?.();
      this.removeError(DECODE_IMAGE_ERR_KEY);
      if (!skipRender) {
        this.renderer.queueAnimationFrame();
      }
    } catch (err) {
      log.error(err);
      if (this.isDisposed()) {
        return;
      }
      if (!this.#showingErrorImage) {
        await this.#setErrorImage(seq, onDecoded);
      }
      this.addError(DECODE_IMAGE_ERR_KEY, `Error decoding image: ${(err as Error).message}`);
    }
  }

  async #setErrorImage(seq: number, onDecoded?: () => void): Promise<void> {
    const errorBitmap = await getErrorImage(64, 64);
    if (this.isDisposed()) {
      return;
    }
    if (this.#displayedImageSequenceNumber > seq) {
      return;
    }
    this.#decodedImage = errorBitmap;
    this.#textureNeedsUpdate = true;
    this.update();
    this.#showingErrorImage = true;
    // call ondecoded to display the error image when calibration is None
    onDecoded?.();
    this.renderer.queueAnimationFrame();
  }

  #prepareIncomingVideoFrame(frameMsg: CompressedVideo): PreparedIncomingVideoFrame {
    const messageTime = toNanoSec(frameMsg.timestamp);
    if (
      this.#lastVideoMessageTime != undefined &&
      messageTime < this.#lastVideoMessageTime &&
      this.#lastVideoMessageTime - messageTime > VIDEO_TIMESTAMP_JITTER_NS
    ) {
      this.videoPlayer?.resetForSeek();
      this.#waitingForVideoKeyframe = true;
      this.#canReplayVideoGop = true;
      this.#lastQueuedVideoMessageTime = messageTime;
      // Pre-seek leftovers in `#pendingVideoDecodeQueue` are dropped at enqueue time in
      // `setImage`; doing it again here would also wipe the GOP that `expandVideoSeekBackfill`
      // packs alongside this keyframe.
      // The cached frames newer than the new playback position are from the abandoned forward
      // portion of playback — they cannot participate in a GOP replay to a target at or before
      // `messageTime`. Drop them now so the cache footprint tracks the actual replay window
      // instead of waiting for the MAX_VIDEO_FRAME_HISTORY cap to evict them. The frames at or
      // before the seek target are still useful: `#decodeVideoGopToTarget` walks backward from
      // the target to find the keyframe that anchors the replay chain.
      if (this.#videoFirstMessageTime != undefined && this.#videoFrameHistory.length > 0) {
        const seekTargetMicros = Number((messageTime - this.#videoFirstMessageTime) / 1000n);
        let writeIndex = 0;
        let keptBytes = 0;
        for (const entry of this.#videoFrameHistory) {
          if (entry.timestampMicros <= seekTargetMicros) {
            this.#videoFrameHistory[writeIndex++] = entry;
            keptBytes += entry.frame.data.byteLength;
          }
        }
        this.#videoFrameHistory.length = writeIndex;
        this.#videoFrameHistoryBytes = keptBytes;
      }
    }
    this.#lastVideoMessageTime = messageTime;
    this.#videoFirstMessageTime ??= messageTime;

    const preparedFrame = prepareVideoFrame(frameMsg, undefined, this.#codec);

    // Keyframes are the only frames that produce a decoder config; remember it for delta frames.
    if (preparedFrame.decoderConfig != undefined) {
      this.#cachedVideoDecoderConfig = preparedFrame.decoderConfig;
    }

    const timestampMicros = Number((messageTime - this.#videoFirstMessageTime) / 1000n);
    this.#rememberVideoFrame(frameMsg, preparedFrame, timestampMicros);

    return { preparedFrame, messageTime, timestampMicros };
  }

  #rememberVideoFrame(
    frame: CompressedVideo,
    preparedFrame: PreparedVideoFrame,
    timestampMicros: number,
  ): void {
    if (!videoCodecNeedsKeyframeReplay(this.#codec)) {
      return;
    }
    const existingIndex = this.#videoFrameHistory.findIndex(
      (entry) => entry.timestampMicros === timestampMicros,
    );
    const historyEntry: VideoFrameHistoryEntry = {
      frame: { ...frame, data: frame.data.slice() },
      type: preparedFrame.type,
      decoderConfig: preparedFrame.decoderConfig,
      timestampMicros,
    };
    if (existingIndex >= 0) {
      this.#videoFrameHistoryBytes +=
        historyEntry.frame.data.byteLength -
        this.#videoFrameHistory[existingIndex]!.frame.data.byteLength;
      this.#videoFrameHistory[existingIndex] = historyEntry;
      return;
    }
    this.#videoFrameHistory.push(historyEntry);
    this.#videoFrameHistoryBytes += historyEntry.frame.data.byteLength;
    while (
      this.#videoFrameHistory.length > MAX_VIDEO_FRAME_HISTORY ||
      this.#videoFrameHistoryBytes > MAX_VIDEO_FRAME_HISTORY_BYTES
    ) {
      const evicted = this.#videoFrameHistory.shift();
      if (!evicted) {
        this.#videoFrameHistoryBytes = 0;
        break;
      }
      this.#videoFrameHistoryBytes -= evicted.frame.data.byteLength;
    }
  }

  #gopForTargetFrame(targetTimestampMicros: number): VideoFrameHistoryEntry[] | undefined {
    const targetIndex = this.#videoFrameHistory.findIndex(
      (entry) => entry.timestampMicros === targetTimestampMicros,
    );
    if (targetIndex < 0) {
      return undefined;
    }
    for (let index = targetIndex; index >= 0; index--) {
      const entry = this.#videoFrameHistory[index];
      if (entry?.type === "key") {
        return this.#videoFrameHistory.slice(index, targetIndex + 1);
      }
    }
    return undefined;
  }

  protected handleVideoPlayerError(err: Error): void {
    this.#waitingForVideoKeyframe = true;
    this.#canReplayVideoGop = false;
    this.videoPlayer?.resetForSeek();
    // The cached GOP cannot be replayed after a player error: the prior decoder state is gone,
    // and re-feeding the same chain will hit the same failure. Clear the history so the next
    // keyframe starts a fresh cache instead of accumulating on top of poisoned entries.
    this.#videoFrameHistory.length = 0;
    this.#videoFrameHistoryBytes = 0;
    log.error(err);
    this.addError(DECODE_IMAGE_ERR_KEY, `Error decoding video: ${err.message}`);
  }

  async #decodeVideoGopToTarget(
    targetFrame: CompressedVideo,
    resizeWidth?: number,
  ): Promise<ImageBitmap | undefined> {
    if (!this.videoPlayer || this.#videoFirstMessageTime == undefined) {
      return undefined;
    }
    const targetTimestampMicros = Number(
      (toNanoSec(targetFrame.timestamp) - this.#videoFirstMessageTime) / 1000n,
    );
    const gop = this.#gopForTargetFrame(targetTimestampMicros);
    if (gop == undefined || gop.length === 0) {
      return undefined;
    }
    const decoderConfig = gop[0]?.decoderConfig ?? this.#cachedVideoDecoderConfig;
    if (decoderConfig == undefined) {
      return undefined;
    }

    this.videoPlayer.resetForSeek();
    await this.videoPlayer.init(decoderConfig);
    const result = await this.videoPlayer.decodeFrames(
      gop.map((entry): EncodedVideoFrame => {
        const preparedFrame = prepareVideoFrame(entry.frame, undefined, this.#codec);
        return {
          data: preparedFrame.data,
          timestampMicros: entry.timestampMicros,
          type: entry.type,
        };
      }),
    );

    if (result.type !== "target") {
      if ("frame" in result) {
        result.frame?.close();
      }
      return undefined;
    }

    try {
      const imageBitmap = await globalThis.createImageBitmap(result.frame, { resizeWidth });
      this.videoPlayer.lastImageBitmap?.close();
      this.videoPlayer.lastImageBitmap = imageBitmap;
      this.#waitingForVideoKeyframe = false;
      this.#canReplayVideoGop = false;
      return imageBitmap;
    } finally {
      result.frame.close();
    }
  }

  protected async decodeImage(
    image: AnyImage,
    resizeWidth?: number,
  ): Promise<ImageBitmap | ImageData> {
    if ("format" in image) {
      if (this.#codec == undefined) {
        return await decodeCompressedImageToBitmap(image, resizeWidth);
      } else {
        const frameMsg = image as CompressedVideo;

        if (frameMsg.data.byteLength === 0) {
          const error = "Empty video frame";
          log.error(error);
          // show last frame instead of error image if available
          if (this.videoPlayer?.lastImageBitmap) {
            return this.videoPlayer.lastImageBitmap;
          }
          // show black image instead of error image
          return await emptyVideoFrame(this.videoPlayer, resizeWidth);
        }

        if (!this.videoPlayer) {
          if (!VideoPlayer.IsSupported()) {
            throw new Error("WebCodecs VideoDecoder is not available in this browser");
          }
          this.videoPlayer = new VideoPlayer();
          this.videoPlayer.on("error", (err) => {
            this.handleVideoPlayerError(err);
          });
          this.videoPlayer.on("warn", (msg) => {
            log.warn(msg);
          });
        }

        const videoPlayer = this.videoPlayer;
        const { preparedFrame } = this.#prepareIncomingVideoFrame(frameMsg);

        if (preparedFrame.status === PreparedVideoFrameStatus.UnsupportedBFrame) {
          return videoPlayer.lastImageBitmap ?? (await emptyVideoFrame(videoPlayer, resizeWidth));
        }
        if (this.#waitingForVideoKeyframe && preparedFrame.type !== "key") {
          const replayBitmap = this.#canReplayVideoGop
            ? await this.#decodeVideoGopToTarget(frameMsg, resizeWidth)
            : undefined;
          return replayBitmap ?? (await emptyVideoFrame(videoPlayer, resizeWidth));
        }

        // Initialize the video player if needed
        if (!videoPlayer.isInitialized() || this.#waitingForVideoKeyframe) {
          const decoderConfig = preparedFrame.decoderConfig ?? this.#cachedVideoDecoderConfig;
          if (decoderConfig != undefined) {
            if (preparedFrame.type !== "key") {
              const replayBitmap = this.#canReplayVideoGop
                ? await this.#decodeVideoGopToTarget(frameMsg, resizeWidth)
                : undefined;
              return replayBitmap ?? (await emptyVideoFrame(videoPlayer, resizeWidth));
            }
            await videoPlayer.init(decoderConfig);
            this.#waitingForVideoKeyframe = false;
            this.#canReplayVideoGop = false;
          } else {
            const detail = preparedFrame.diagnostics ?? "no decoder configuration available";
            throw new Error(`Waiting for keyframe (${detail})`);
          }
        }

        assert(this.#videoFirstMessageTime != undefined, "firstMessageTime must be set");

        return await decodeCompressedVideoToBitmap(
          frameMsg,
          preparedFrame,
          videoPlayer,
          this.#videoFirstMessageTime,
          resizeWidth,
        );
      }
    }
    return await (this.decoder ??= new WorkerImageDecoder()).decode(image, this.userData.settings);
  }

  public update(): void {
    if (this.#isUpdating) {
      return;
    }
    this.#isUpdating = true;

    if (this.#textureNeedsUpdate && this.#decodedImage) {
      this.#updateTexture();
      this.#textureNeedsUpdate = false;
    }

    if (this.userData.image) {
      this.updateHeaderInfo();
    }

    if (this.#geometryNeedsUpdate && this.userData.cameraModel) {
      this.#rebuildGeometry();
      this.#geometryNeedsUpdate = false;
    }

    if (this.#materialNeedsUpdate) {
      this.#updateMaterial();
      this.#materialNeedsUpdate = false;
    }

    if (
      this.#meshNeedsUpdate &&
      this.userData.texture &&
      this.userData.geometry &&
      this.userData.material
    ) {
      this.#updateMesh();
      this.#meshNeedsUpdate = false;
    }
    this.#isUpdating = false;
  }

  #rebuildGeometry() {
    assert(this.userData.cameraModel, "Camera model must be set before geometry can be updated");
    // Dispose of the current geometry if the settings have changed
    this.userData.geometry?.dispose();
    this.userData.geometry = undefined;
    const geometry = createGeometry(this.userData.cameraModel, this.userData.settings);
    this.userData.geometry = geometry;
    this.#meshNeedsUpdate = true;
  }

  #updateTexture(): void {
    assert(
      this.#decodedImage,
      "Decoded image must be set before texture can be updated or created",
    );
    const decodedImage = this.#decodedImage;
    // Create or update the bitmap texture
    if (decodedImage instanceof ImageBitmap) {
      const canvasTexture = this.userData.texture;
      if (
        canvasTexture == undefined ||
        // instanceof check allows us to switch from a raw image (DataTexture) to a compressed image (CanvasTexture)
        !(canvasTexture instanceof THREE.CanvasTexture) ||
        !bitmapDimensionsEqual(decodedImage, canvasTexture.image as ImageBitmap | undefined)
      ) {
        if (canvasTexture?.image instanceof ImageBitmap) {
          // don't close the image if it is the error image
          canvasTexture.image.close();
        }
        canvasTexture?.dispose();
        this.userData.texture = createCanvasTexture(decodedImage);
      } else {
        canvasTexture.image = decodedImage;
        canvasTexture.needsUpdate = true;
      }
    } else {
      let dataTexture = this.userData.texture;
      if (
        dataTexture == undefined ||
        // instanceof check allows us to switch from a compressed image (CanvasTexture) to a raw image (DataTexture)
        !(dataTexture instanceof THREE.DataTexture) ||
        dataTexture.image.width !== decodedImage.width ||
        dataTexture.image.height !== decodedImage.height
      ) {
        dataTexture?.dispose();
        dataTexture = createDataTexture(decodedImage);
        this.userData.texture = dataTexture;
      } else {
        dataTexture.image = decodedImage;
        dataTexture.needsUpdate = true;
      }
    }
    this.#materialNeedsUpdate = true;
  }

  #updateMaterial(): void {
    if (!this.userData.material) {
      this.#initMaterial();
      this.#meshNeedsUpdate = true;
    }
    const material = this.userData.material!;

    const texture = this.userData.texture;
    if (texture) {
      material.uniforms.map = { value: texture };
    }

    tempColor = stringToRgba(tempColor, this.userData.settings.color);
    const transparent = tempColor.a < 1;
    const color = new THREE.Color(tempColor.r, tempColor.g, tempColor.b);
    const { brightness, contrast } = this.userData.settings;
    material.uniforms.color = { value: color };
    material.uniforms.brightness = { value: clampBrightness(brightness) };
    material.uniforms.contrast = { value: clampContrast(contrast) };
    material.uniforms.opacity = { value: tempColor.a };
    material.opacity = tempColor.a;
    material.transparent = transparent;
    material.depthWrite = !transparent;

    if (this.#renderBehindScene) {
      material.depthWrite = false;
      material.depthTest = false;
    } else {
      material.depthTest = true;
    }

    material.needsUpdate = true;
  }

  #initMaterial(): void {
    stringToRgba(tempColor, this.userData.settings.color);
    const transparent = tempColor.a < 1;
    const color = new THREE.Color(tempColor.r, tempColor.g, tempColor.b);
    const { brightness, contrast } = this.userData.settings;
    const uniforms = {
      map: { value: this.userData.texture },
      color: { value: color },
      opacity: { value: tempColor.a },
      brightness: { value: clampBrightness(brightness) },
      contrast: { value: clampContrast(contrast) },
    };
    this.userData.material = new THREE.ShaderMaterial({
      name: `${this.userData.topic}:Material`,
      uniforms,
      side: THREE.DoubleSide,
      opacity: tempColor.a,
      transparent,
      depthWrite: !transparent,
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
    });
  }

  #updateMesh(): void {
    assert(this.userData.geometry, "Geometry must be set before mesh can be updated or created");
    assert(this.userData.material, "Material must be set before mesh can be updated or created");
    if (!this.userData.mesh) {
      this.userData.mesh = new THREE.Mesh(this.userData.geometry, this.userData.material);
      this.add(this.userData.mesh);
    } else {
      this.userData.mesh.geometry = this.userData.geometry;
      this.userData.mesh.material = this.userData.material;
    }

    if (!this.#renderBehindScene) {
      this.userData.mesh.renderOrder = 0;
      return;
    }

    this.userData.mesh.renderOrder = -1 * Number.MAX_SAFE_INTEGER;
  }

  protected addError(key: string, message: string): void {
    if (this.isDisposed()) {
      return;
    }
    // must account for if the renderable is part of `ImageMode` or `Images` scene extension
    this.renderer.settings.errors.add(IMAGE_TOPIC_PATH, key, message);
    this.renderer.settings.errors.addToTopic(this.userData.topic, key, message);
  }

  protected removeError(key: string): void {
    this.renderer.settings.errors.remove(IMAGE_TOPIC_PATH, key);
    this.renderer.settings.errors.removeFromTopic(this.userData.topic, key);
  }
}

let tempColor = { r: 0, g: 0, b: 0, a: 0 };

function createCanvasTexture(bitmap: ImageBitmap): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(
    bitmap,
    THREE.UVMapping,
    THREE.ClampToEdgeWrapping,
    THREE.ClampToEdgeWrapping,
    THREE.NearestFilter,
    THREE.LinearFilter,
    THREE.RGBAFormat,
    THREE.UnsignedByteType,
  );
  texture.generateMipmaps = false;
  // Color space needs to be set to LinearSRGBColorSpace for correct color rendering on custom Shader
  texture.colorSpace = THREE.LinearSRGBColorSpace;
  return texture;
}

function createDataTexture(imageData: ImageData): THREE.DataTexture {
  const dataTexture = new THREE.DataTexture(
    imageData.data,
    imageData.width,
    imageData.height,
    THREE.RGBAFormat,
    THREE.UnsignedByteType,
    THREE.UVMapping,
    THREE.ClampToEdgeWrapping,
    THREE.ClampToEdgeWrapping,
    THREE.NearestFilter,
    THREE.LinearFilter,
    1,
    // Color space needs to be set to LinearSRGBColorSpace for correct color rendering on custom Shader
    THREE.LinearSRGBColorSpace,
  );
  dataTexture.needsUpdate = true; // ensure initial image data is displayed
  return dataTexture;
}

function createGeometry(
  cameraModel: ICameraModel,
  settings: ImageRenderableSettings,
): THREE.PlaneGeometry {
  const WIDTH_SEGMENTS = 100;
  const HEIGHT_SEGMENTS = 100;

  const width = cameraModel.width;
  const height = cameraModel.height;
  const geometry = new THREE.PlaneGeometry(1, 1, WIDTH_SEGMENTS, HEIGHT_SEGMENTS);

  const gridX1 = WIDTH_SEGMENTS + 1;
  const gridY1 = HEIGHT_SEGMENTS + 1;
  const size = gridX1 * gridY1;

  const segmentWidth = width / WIDTH_SEGMENTS;
  const segmentHeight = height / HEIGHT_SEGMENTS;

  // Use a slight offset to avoid z-fighting with the CameraInfo wireframe
  const EPS = 1e-3;

  // Rebuild the position buffer for the plane by iterating through the grid and
  // projecting each pixel space x/y coordinate into a 3D ray and casting out by
  // the user-configured distance setting. UV coordinates are rebuilt so the
  // image is not vertically flipped
  const pixel = { x: 0, y: 0 };
  const p = { x: 0, y: 0, z: 0 };
  const vertices = new Float32Array(size * 3);
  const uvs = new Float32Array(size * 2);
  for (let iy = 0; iy < gridY1; iy++) {
    for (let ix = 0; ix < gridX1; ix++) {
      const vOffset = (iy * gridX1 + ix) * 3;
      const uvOffset = (iy * gridX1 + ix) * 2;

      pixel.x = ix * segmentWidth;
      pixel.y = iy * segmentHeight;
      projectPixel(p, pixel, cameraModel, settings);

      vertices[vOffset + 0] = p.x;
      vertices[vOffset + 1] = p.y;
      vertices[vOffset + 2] = p.z - EPS;

      uvs[uvOffset + 0] = ix / WIDTH_SEGMENTS;
      uvs[uvOffset + 1] = iy / HEIGHT_SEGMENTS;
    }
  }

  geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geometry.attributes.position!.needsUpdate = true;
  geometry.attributes.uv!.needsUpdate = true;

  return geometry;
}

const bitmapDimensionsEqual = (a?: ImageBitmap, b?: ImageBitmap) =>
  a?.width === b?.width && a?.height === b?.height;

async function getErrorImage(width: number, height: number): Promise<ImageBitmap> {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw Error("Could not instantiate 2D canvas context");
  }

  canvas.width = width;
  canvas.height = height;

  // Draw outline
  ctx.strokeStyle = "red";
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, width, height);

  // Draw X
  ctx.strokeStyle = "red";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(width, height);
  ctx.moveTo(width, 0);
  ctx.lineTo(0, height);
  ctx.stroke();

  // Get the updated image data
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const bitmap = await createImageBitmap(imageData, { resizeWidth: width });

  return bitmap;
}
