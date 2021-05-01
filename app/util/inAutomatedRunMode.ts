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

function getSearchParams(): URLSearchParams {
  return new URLSearchParams(global.location.search ?? "");
}

export function inVideoRecordingMode(): boolean {
  return getSearchParams().has("video-recording-mode");
}

export function inPlaybackPerformanceMeasuringMode(): boolean {
  return getSearchParams().has("measure-playback-performance-mode");
}

export function inLoadPerformanceMode(): boolean {
  return getSearchParams().has("measure-load-performance-mode");
}

function inAutomatedRunMode(): boolean {
  return inVideoRecordingMode() || inPlaybackPerformanceMeasuringMode() || inLoadPerformanceMode();
}

export default inAutomatedRunMode;
