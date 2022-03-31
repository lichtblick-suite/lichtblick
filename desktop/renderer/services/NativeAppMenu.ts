// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { INativeAppMenu, NativeAppMenuEvent } from "@foxglove/studio-base";

import { NativeMenuBridge } from "../../common/types";

type Handler = () => void;

export class NativeAppMenu implements INativeAppMenu {
  private bridge?: NativeMenuBridge;

  constructor(bridge?: NativeMenuBridge) {
    this.bridge = bridge;
  }
  addFileEntry(name: string, handler: Handler): void {
    void this.bridge?.menuAddInputSource(name, handler);
  }
  removeFileEntry(name: string): void {
    void this.bridge?.menuRemoveInputSource(name);
  }
  on(name: NativeAppMenuEvent, listener: Handler): void {
    this.bridge?.addIpcEventListener(name, listener);
  }
  off(name: NativeAppMenuEvent, listener: Handler): void {
    this.bridge?.removeIpcEventListener(name, listener);
  }
}
