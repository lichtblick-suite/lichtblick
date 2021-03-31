// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import { Mutex } from "async-mutex";

import { OsContext } from "@foxglove-studio/app/OsContext";
import { AppConfiguration } from "@foxglove-studio/app/context/AppConfigurationContext";

export default class OsContextAppConfiguration implements AppConfiguration {
  static STORE_NAME = "settings";
  static STORE_KEY = "settings.json";

  private readonly _ctx: Pick<OsContext, "storage">;

  // Protect access to currentValue to avoid read-modify-write races between multiple set() calls.
  private _mutex = new Mutex();
  private _currentValue: unknown;

  constructor(ctx: Pick<OsContext, "storage">) {
    this._ctx = ctx;
    this._mutex.runExclusive(async () => {
      const value = await this._ctx.storage.get(
        OsContextAppConfiguration.STORE_NAME,
        OsContextAppConfiguration.STORE_KEY,
        { encoding: "utf8" },
      );
      this._currentValue = JSON.parse(value ?? "{}");
    });
  }

  async get(key: string): Promise<unknown> {
    return await this._mutex.runExclusive(
      () => (this._currentValue as Record<string, unknown>)[key],
    );
  }

  async set(key: string, value: unknown): Promise<void> {
    await this._mutex.runExclusive(async () => {
      const currentConfig = await this._ctx.storage.get(
        OsContextAppConfiguration.STORE_NAME,
        OsContextAppConfiguration.STORE_KEY,
        { encoding: "utf8" },
      );

      const newConfig: unknown = { ...JSON.parse(currentConfig ?? "{}"), [key]: value };

      await this._ctx.storage.put(
        OsContextAppConfiguration.STORE_NAME,
        OsContextAppConfiguration.STORE_KEY,
        JSON.stringify(newConfig),
      );
      this._currentValue = newConfig;
    });
  }
}
