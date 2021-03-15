// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2019-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.
import { LayoutDescription } from "@foxglove-studio/app/types/layouts";
import { isInIFrame, postMessageToIframeHost } from "@foxglove-studio/app/util/iframeUtils";
import {
  NotificationType,
  DetailsType,
  NotificationSeverity,
} from "@foxglove-studio/app/util/sendNotification";

type IframePlaybackMessageData = {
  playbackState: { timestampSec: number; timeStampNano: number };
};

type IframeNotificationMessageData = {
  message: string;
  details: DetailsType;
  type: NotificationType;
  severity: NotificationSeverity;
};

// Do not modify below values. You will break Miniviz
const WebvizNotificationMessageType = "webviz-notification";
const WebvizPlaybackMessageType = "webviz-playback";
const WebvizLayoutMessageType = "webviz-layout";
export const IframePlaybackMessageType = "playback-message";
export const IframeSeekMessageType = "seek-message";
export const IframeUrlChangeMessageType = "url-change-message";
export type IframeEvent =
  | { type: "url-change-message"; newUrlSource: string }
  | { type: "playback-message"; isPlaying: boolean; playSpeed: number }
  | { type: "seek-message"; seekTimeMs: number };

function createMessageHandler(handleMessage: (eventData: IframeEvent) => void) {
  return (event: any) => {
    if (!isInIFrame() || event.data == undefined || typeof event.data !== "object") {
      return;
    }
    handleMessage(event.data);
  };
}

const minivizAPI = {
  addListener: (handleMessage: (event: any) => void): (() => void) => {
    if (isInIFrame()) {
      const handler = createMessageHandler(handleMessage);
      window.addEventListener("message", handler, false);
      return () => {
        window.removeEventListener("message", handler, false);
      };
    }
    return () => {
      // no-op
    };
  },

  postPlaybackMessage: (data: IframePlaybackMessageData) => {
    postMessageToIframeHost({
      type: WebvizPlaybackMessageType,
      data,
    });
  },

  postNotificationMessage: (data: IframeNotificationMessageData) => {
    postMessageToIframeHost({
      type: WebvizNotificationMessageType,
      data,
    });
  },

  postLayoutsMessage: (data: LayoutDescription[]) => {
    postMessageToIframeHost({
      type: WebvizLayoutMessageType,
      data,
    });
  },
};

export default minivizAPI;
