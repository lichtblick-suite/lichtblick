// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import { Mutex } from "async-mutex";

import { OsContext } from "@foxglove-studio/app/OsContext";
import { AppConfiguration } from "@foxglove-studio/app/context/AppConfigurationContext";

export default class OsContextAppConfiguration implements AppConfiguration {
  static STORE_NAME = "settings";
  static STORE_KEY = "settings.json";

  readonly #ctx: Pick<OsContext, "storage">;

  // Protect access to currentValue to avoid read-modify-write races between multiple set() calls.
  #mutex = new Mutex();
  #currentValue: unknown;

  constructor(ctx: Pick<OsContext, "storage">) {
    this.#ctx = ctx;
    this.#mutex.runExclusive(async () => {
      const value = await this.#ctx.storage.get(
        OsContextAppConfiguration.STORE_NAME,
        OsContextAppConfiguration.STORE_KEY,
        { encoding: "utf8" },
      );
      this.#currentValue = JSON.parse(value ?? "{}");
    });
  }

  async get(key: string): Promise<unknown> {
    return await this.#mutex.runExclusive(
      () => (this.#currentValue as Record<string, unknown>)[key],
    );
  }

  async set(key: string, value: unknown): Promise<void> {
    await this.#mutex.runExclusive(async () => {
      const currentConfig = await this.#ctx.storage.get(
        OsContextAppConfiguration.STORE_NAME,
        OsContextAppConfiguration.STORE_KEY,
        { encoding: "utf8" },
      );

      const newConfig: unknown = { ...JSON.parse(currentConfig ?? "{}"), [key]: value };

      await this.#ctx.storage.put(
        OsContextAppConfiguration.STORE_NAME,
        OsContextAppConfiguration.STORE_KEY,
        JSON.stringify(newConfig),
      );
      this.#currentValue = newConfig;
    });
  }
}
