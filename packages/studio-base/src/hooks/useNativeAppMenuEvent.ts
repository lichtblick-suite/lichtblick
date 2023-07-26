// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useEffect } from "react";

import {
  NativeAppMenuEvent,
  useNativeAppMenu,
} from "@foxglove/studio-base/context/NativeAppMenuContext";

type EventHandler = () => void;

export default function useNativeAppMenuEvent(
  eventName: NativeAppMenuEvent,
  handler: EventHandler,
): void {
  const nativeAppMenu = useNativeAppMenu();

  useEffect(() => {
    if (!nativeAppMenu) {
      return;
    }

    return nativeAppMenu.on(eventName, handler);
  }, [eventName, handler, nativeAppMenu]);
}
