// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import Logger from "@foxglove/log";
import delay from "@foxglove/studio-base/util/delay";
import signal, { Signal } from "@foxglove/studio-base/util/signal";

const logger = Logger.getLogger("videoRecordingClient");

// This is the interface between the video recording server (recordVideo.js) and
// the client (whomever uses `videoRecordingClient`). The idea is that the server opens a webpage
// that runs a client, and from that point on, the client is in control. Essentially, the client
// makes remote procedure calls to the server, which the server executes and then acknowledges.
// Right now there are only three calls to the server:
// - "error" (which throws an error and aborts);
// - "finish" (to close the browser and generate the actual video);
// - "screenshot" (take a screenshot and acknowledge when done, so we can continue).
//

let screenshotResolve: (() => void) | undefined;
let finishedMsPerFrame: number | undefined;
let error: Error | undefined;
let errorSignal: Signal<void> | undefined;

export type VideoRecordingAction = {
  action: "error" | "finish" | "screenshot";
  error?: string;
  msPerFrame?: number;
};

type VideoRecording = {
  nextAction(): VideoRecordingAction | undefined;
  hasTakenScreenshot(): void;
};
(window as typeof window & { videoRecording: VideoRecording }).videoRecording = {
  nextAction(): VideoRecordingAction | undefined {
    if (error) {
      // This object is serialized and deserialized to pass it to Puppeteer, so passing the error object itself will
      // just result in { "action": "error", "error": {} }. Instead pass a string - the stack itself.
      const payload: VideoRecordingAction = {
        action: "error",
        error: error.stack ?? error.message ?? error.toString?.() ?? error,
      };
      // Clear error, since if it is whitelisted we will ignore and try to keep running
      error = undefined;
      if (errorSignal) {
        errorSignal.resolve();
        errorSignal = undefined;
      }
      return payload;
    }
    if (finishedMsPerFrame != undefined) {
      return { action: "finish", msPerFrame: finishedMsPerFrame };
    }
    if (screenshotResolve) {
      return { action: "screenshot" };
    }
    return undefined;
  },

  hasTakenScreenshot() {
    if (!screenshotResolve) {
      throw new Error("No screenshotResolve found!");
    }
    const resolve = screenshotResolve;
    screenshotResolve = undefined;
    resolve();
  },
};

const params = new URLSearchParams(location.search);
const [workerIndex = 0, workerTotal = 1] = (params.get("video-recording-worker") ?? "0/1")
  .split("/")
  .map((n) => parseInt(n));
const msPerFrame = params.has("video-recording-framerate")
  ? 1000 / parseFloat(params.get("video-recording-framerate") ?? "")
  : 200;
const speed = params.has("video-recording-speed")
  ? parseFloat(params.get("video-recording-speed") ?? "")
  : 0.2;

class VideoRecordingClient {
  msPerFrame = msPerFrame;
  workerIndex = workerIndex;
  workerTotal = workerTotal;
  speed = speed;
  shouldLoadDataBeforePlaying = false;
  lastFrameStart = 0;
  preloadStart = 0;

  start({ bagLengthMs }: { bagLengthMs: number }) {
    logger.info("videoRecordingClient.start()", bagLengthMs);
  }

  markFrameRenderStart() {
    this.lastFrameStart = performance.now();
  }

  markFrameRenderEnd() {
    return Math.round(performance.now() - this.lastFrameStart);
  }

  markPreloadStart() {
    this.preloadStart = performance.now();
  }

  markPreloadEnd() {
    const preloadDurationMs = performance.now() - this.preloadStart;
    const preloadTimeSec = (preloadDurationMs / 1000).toFixed(1);
    logger.info(`[VideoRecordingClient] Preload duration: ${preloadTimeSec}s`);
    return preloadDurationMs;
  }

  markTotalFrameStart() {
    // no-op
  }

  markTotalFrameEnd() {
    // no-op
  }

  onError(e: Error) {
    error = e;
    if (!errorSignal) {
      errorSignal = signal<void>();
    }
    return errorSignal;
  }

  async onFrameFinished(frameCount: number) {
    // Wait a bit to allow for the camera to get in position and images to load.
    if (frameCount === 0) {
      await delay(5000);
      return;
    }

    await delay(60); // Give PlayerDispatcher time to dispatch a frame, and then render everything.
    if (screenshotResolve) {
      throw new Error("Already have a screenshot queued!");
    }
    return await new Promise<void>((resolve) => {
      screenshotResolve = resolve;
    });
  }

  async finish() {
    logger.info("videoRecordingClient.finish()");
    finishedMsPerFrame = msPerFrame;
  }
}

export default new VideoRecordingClient();
