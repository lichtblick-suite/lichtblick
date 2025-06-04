// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { INativeWindow, NativeWindowEvent } from "@lichtblick/suite-base";

import { Desktop } from "../../common/types";

type Handler = () => void;

export class NativeWindow implements INativeWindow {
  readonly #bridge?: Desktop;

  public constructor(bridge: Desktop) {
    this.#bridge = bridge;
  }

  public async setRepresentedFilename(path: string | undefined): Promise<void> {
    await this.#bridge?.setRepresentedFilename(path);
  }
  public on(name: NativeWindowEvent, listener: Handler): void {
    this.#bridge?.addIpcEventListener(name, listener);
  }

  public handleTitleBarDoubleClick(): void {
    this.#bridge?.handleTitleBarDoubleClick();
  }

  public isMaximized(): boolean {
    return this.#bridge?.isMaximized() ?? false;
  }
  public minimize(): void {
    this.#bridge?.minimizeWindow();
  }
  public maximize(): void {
    this.#bridge?.maximizeWindow();
  }
  public unmaximize(): void {
    this.#bridge?.unmaximizeWindow();
  }
  public close(): void {
    this.#bridge?.closeWindow();
  }
  public reload(): void {
    this.#bridge?.reloadWindow();
  }
}
