// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { IAppConfiguration, ChangeHandler, AppConfigurationValue } from "@foxglove/studio-base";

/**
 * MemoryAppConfiguration implements IAppConfiguration by storing and reading configuration from
 * memory.
 *
 * Configuration does not survive any reload nor is it persisted.
 */
export class MemoryAppConfiguration implements IAppConfiguration {
  #values = new Map<string, AppConfigurationValue>();

  #changeListeners = new Map<string, Set<ChangeHandler>>();

  public constructor({ defaults }: { defaults?: { [key: string]: AppConfigurationValue } }) {
    if (defaults) {
      for (const [key, value] of Object.entries(defaults)) {
        this.#values.set(key, value);
      }
    }
  }

  public get(key: string): AppConfigurationValue {
    return this.#values.get(key);
  }
  public async set(key: string, value: AppConfigurationValue): Promise<void> {
    this.#values.set(key, value);
    const listeners = this.#changeListeners.get(key);
    if (listeners) {
      // Copy the list of listeners to protect against mutation during iteration
      [...listeners].forEach((listener) => listener(value));
    }
  }

  public addChangeListener(key: string, cb: ChangeHandler): void {
    let listeners = this.#changeListeners.get(key);
    if (!listeners) {
      listeners = new Set();
      this.#changeListeners.set(key, listeners);
    }
    listeners.add(cb);
  }

  public removeChangeListener(key: string, cb: ChangeHandler): void {
    const listeners = this.#changeListeners.get(key);
    listeners?.delete(cb);
  }
}
