// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { PropsWithChildren, useMemo } from "react";

import OsContextSingleton from "@foxglove-studio/app/OsContextSingleton";
import NativeAppMenuContext, {
  NativeAppMenu,
  NativeAppMenuEvent,
} from "@foxglove-studio/app/context/NativeAppMenuContext";

type Handler = () => void;

export default function NativeAppMenuProvider(props: PropsWithChildren<unknown>): JSX.Element {
  const value = useMemo<NativeAppMenu>(() => {
    return {
      addFileEntry: (name: string, handler: Handler) => {
        OsContextSingleton?.menuAddInputSource(name, handler);
      },
      removeFileEntry: (name: string) => {
        OsContextSingleton?.menuRemoveInputSource(name);
      },
      on: (name: NativeAppMenuEvent, listener: Handler) => {
        OsContextSingleton?.addIpcEventListener(name, listener);
      },
      off: (name: NativeAppMenuEvent, listener: Handler) => {
        OsContextSingleton?.removeIpcEventListener(name, listener);
      },
    };
  }, []);

  return (
    <NativeAppMenuContext.Provider value={value}>{props.children}</NativeAppMenuContext.Provider>
  );
}
