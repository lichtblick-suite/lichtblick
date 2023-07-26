// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { INativeAppMenu, NativeAppMenuEvent } from "@foxglove/studio-base";

import { NativeMenuBridge, UnregisterFn } from "../../common/types";

type Handler = () => void;

export class NativeAppMenu implements INativeAppMenu {
  #bridge?: NativeMenuBridge;

  public constructor(bridge?: NativeMenuBridge) {
    this.#bridge = bridge;
  }
  public addFileEntry(name: string, handler: Handler): void {
    void this.#bridge?.menuAddInputSource(name, handler);
  }
  public removeFileEntry(name: string): void {
    void this.#bridge?.menuRemoveInputSource(name);
  }
  public on(name: NativeAppMenuEvent, listener: Handler): UnregisterFn | undefined {
    return this.#bridge?.addIpcEventListener(name, listener);
  }
}
