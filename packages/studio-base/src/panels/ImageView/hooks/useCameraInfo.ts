// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useCallback } from "react";

import { MessageEvent } from "@foxglove/studio";
import { useMessageReducer } from "@foxglove/studio-base/PanelAPI";
import { CameraInfo } from "@foxglove/studio-base/types/Messages";

import { getCameraInfoTopic } from "../lib/util";

export function useCameraInfo(cameraTopic: string): CameraInfo | undefined {
  const cameraInfoTopic = getCameraInfoTopic(cameraTopic);
  return useMessageReducer<CameraInfo | undefined>({
    topics: cameraInfoTopic != undefined ? [cameraInfoTopic] : [],
    restore: useCallback((value) => value, []),
    addMessage: useCallback(
      (_value: CameraInfo | undefined, { message }: MessageEvent<unknown>) => message as CameraInfo,
      [],
    ),
  });
}
