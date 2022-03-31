// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { PropsWithChildren, useMemo } from "react";

import { NativeWindowContext, NativeWindow } from "@foxglove/studio-base";

import { Desktop } from "../../common/types";

const desktopBridge = (global as { desktopBridge?: Desktop }).desktopBridge;

export default function NativeWindowProvider(props: PropsWithChildren<unknown>): JSX.Element {
  const value = useMemo<NativeWindow>(() => {
    return {
      async setRepresentedFilename(path: string | undefined) {
        await desktopBridge?.setRepresentedFilename(path);
      },
    };
  }, []);

  return (
    <NativeWindowContext.Provider value={value}>{props.children}</NativeWindowContext.Provider>
  );
}
