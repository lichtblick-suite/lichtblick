// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import Logger from "@foxglove/log";
import { ExtensionContext } from "@foxglove/studio";
import { ExtensionInstance } from "@foxglove/studio-base/ExtensionInstance";

const log = Logger.getLogger(__filename);

export class Extensions {
  extensions = new Map<string, ExtensionInstance>();

  async load(descriptors: { uri: string; packageJson: unknown }[]): Promise<void> {
    for (const { uri, packageJson } of descriptors) {
      const instance = new ExtensionInstance(uri, packageJson, true);
      log.debug(`Importing extension ${instance.name()} (${instance.version()}) from ${uri}`);
      this.extensions.set(uri, instance);

      if (instance.enabled) {
        try {
          instance.extension = await import(/* webpackIgnore: true */ uri);
        } catch (err) {
          log.error(`Failed to import extension ${uri}: ${err}`);
        }
      }
    }
  }

  activate(): void {
    const extensionMode =
      process.env.NODE_ENV === "production"
        ? "production"
        : process.env.NODE_ENV === "test"
        ? "test"
        : "development";
    const ctx: ExtensionContext = { extensionMode };

    for (const instance of this.extensions.values()) {
      if (
        instance.enabled &&
        instance.extension != undefined &&
        typeof instance.extension.activate === "function"
      ) {
        log.debug(`Activating extension ${instance.name()}`);
        instance.extension.activate(ctx);
      }
    }
  }
}
