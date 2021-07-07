/** @jest-environment jsdom */
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

import PerformanceMeasuringClient from "./PerformanceMeasuringClient";

describe("PerformanceMeasuringClient", () => {
  let onPlaybackFinished: any;
  let onPlaybackError: any;
  beforeEach(() => {
    onPlaybackFinished = jest.fn();
    onPlaybackError = jest.fn();
    window.addEventListener("playbackFinished", (e: any) => {
      onPlaybackFinished(e.detail);
    });
    window.addEventListener("playbackError", (e: any) => {
      onPlaybackError(e.detail);
    });
  });

  it("emits a 'finishedPlayback' event when finished", async () => {
    const perfClient = new PerformanceMeasuringClient();
    perfClient.start({ bagLengthMs: 1 });
    await perfClient.finish();
    expect(onPlaybackFinished).toHaveBeenCalled();
    expect(onPlaybackError).not.toHaveBeenCalled();
  });

  it("emits an error event when encountered", () => {
    const perfClient = new PerformanceMeasuringClient();
    perfClient.start({ bagLengthMs: 1 });
    const error = new Error("playback_error");
    void perfClient.onError(error);
    expect(onPlaybackFinished).not.toHaveBeenCalled();
    expect(onPlaybackError).toHaveBeenCalledWith(error.toString());
  });
});
