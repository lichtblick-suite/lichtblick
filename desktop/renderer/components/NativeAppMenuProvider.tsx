// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { PropsWithChildren, useMemo } from "react";

import NativeAppMenuContext, {
  NativeAppMenu,
  NativeAppMenuEvent,
} from "@foxglove/studio-base/context/NativeAppMenuContext";

import { NativeMenuBridge } from "../../common/types";

const menuBridge = (global as { menuBridge?: NativeMenuBridge }).menuBridge;

type Handler = () => void;

export default function NativeAppMenuProvider(props: PropsWithChildren<unknown>): JSX.Element {
  const value = useMemo<NativeAppMenu>(() => {
    return {
      addFileEntry: (name: string, handler: Handler) => {
        menuBridge?.menuAddInputSource(name, handler);
      },
      removeFileEntry: (name: string) => {
        menuBridge?.menuRemoveInputSource(name);
      },
      on: (name: NativeAppMenuEvent, listener: Handler) => {
        menuBridge?.addIpcEventListener(name, listener);
      },
      off: (name: NativeAppMenuEvent, listener: Handler) => {
        menuBridge?.removeIpcEventListener(name, listener);
      },
    };
  }, []);

  return (
    <NativeAppMenuContext.Provider value={value}>{props.children}</NativeAppMenuContext.Provider>
  );
}
