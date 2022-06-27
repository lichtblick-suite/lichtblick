// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import ReactDOM from "react-dom";
import { useAsync } from "react-use";
import { AsyncState } from "react-use/lib/useAsyncFn";

import Logger from "@foxglove/log";
import { ExtensionContext, ExtensionModule } from "@foxglove/studio";
import { RegisteredPanel } from "@foxglove/studio-base/context/ExtensionRegistryContext";
import { ExtensionLoader } from "@foxglove/studio-base/services/ExtensionLoader";
import { ExtensionInfo } from "@foxglove/studio-base/types/Extensions";

const log = Logger.getLogger(__filename);

export function useExtensionPanels(
  extensions: ExtensionInfo[],
  extensionLoaders: Pick<ExtensionLoader, "loadExtension">,
): AsyncState<Record<string, RegisteredPanel>> {
  const registeredPanels = useAsync(async () => {
    // registered panels stored by their fully qualified id
    // the fully qualified id is the extension name + panel name
    const panels: Record<string, RegisteredPanel> = {};

    for (const extension of extensions) {
      log.debug(`Activating extension ${extension.qualifiedName}`);

      const module = { exports: {} };
      const require = (name: string) => {
        return { react: React, "react-dom": ReactDOM }[name];
      };

      const extensionMode =
        process.env.NODE_ENV === "production"
          ? "production"
          : process.env.NODE_ENV === "test"
          ? "test"
          : "development";

      const ctx: ExtensionContext = {
        mode: extensionMode,

        registerPanel(params) {
          log.debug(`Extension ${extension.qualifiedName} registering panel: ${params.name}`);

          const fullId = `${extension.qualifiedName}.${params.name}`;
          if (panels[fullId]) {
            log.warn(`Panel ${fullId} is already registered`);
            return;
          }

          panels[fullId] = {
            extensionName: extension.qualifiedName,
            registration: params,
          };
        },
      };

      try {
        const unwrappedExtensionSource = await extensionLoaders.loadExtension(extension.id);

        // eslint-disable-next-line no-new-func
        const fn = new Function("module", "require", unwrappedExtensionSource);

        // load the extension module exports
        fn(module, require, {});
        const wrappedExtensionModule = module.exports as ExtensionModule;

        wrappedExtensionModule.activate(ctx);
      } catch (err) {
        log.error(err);
      }
    }

    return panels;
  }, [extensionLoaders, extensions]);

  return registeredPanels;
}
