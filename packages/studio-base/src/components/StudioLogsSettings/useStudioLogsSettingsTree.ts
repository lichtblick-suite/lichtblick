// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { extname } from "path";
import { useMemo } from "react";

import Log, { toLogLevel } from "@foxglove/log";
import { SettingsTree, SettingsTreeNode, SettingsTreeNodes } from "@foxglove/studio";
import { useStudioLogsSettings } from "@foxglove/studio-base/context/StudioLogsSettingsContext";

const log = Log.getLogger(__filename);

type ItemDetail = {
  type: "prefix" | "channel";
  fullPath: string;
};

function useStudioLogsSettingsTree(): SettingsTree {
  const logsConfig = useStudioLogsSettings();

  return useMemo<SettingsTree>(() => {
    // When building the settings tree we strip away uninformative parts of the channel name (i.e.
    // packages, src) to reduce the repetitive noise. However, to enable/disable channels and
    // prefixes we need to know the original name or prefix. Here we store the stripped path to
    // original path mapping.
    const itemDetailByPath = new Map<string, ItemDetail>();

    // Root node of all other settings nodes
    const settingsRoot: SettingsTreeNodes = {
      Settings: {
        label: "Settings",
        fields: {
          level: {
            label: "level",
            input: "select",
            value: logsConfig.globalLevel,
            options: [
              { label: "error", value: "error" },
              { label: "warn", value: "warn" },
              { label: "info", value: "info" },
              { label: "debug", value: "debug" },
            ],
          },
        },
      },
    };

    // Channels are split into two buckets - "packages" and "misc". This is the root for "misc"
    // channels.
    const miscRoot: SettingsTreeNode = {
      label: "Misc",
      defaultExpansionState: "expanded",
      children: {},
    };

    for (const channel of logsConfig.channels) {
      const channelName = channel.name;

      const parts = channelName.split("/");

      // Studio code may live in a `studio` workspace, and we'll still want the tree to work the same
      const studioSpacePrefix = /^(studio\/)/.test(channelName) ? `${parts.shift()}/` : "";

      const [type, pkgName, srcPath, component, ...rest] = parts;

      // misc entry
      if (type !== "packages") {
        miscRoot.children![channelName] = {
          label: channelName,
          visible: channel.enabled,
        };

        itemDetailByPath.set(`misc/${channelName}`, {
          type: "channel",
          fullPath: channel.name,
        });
        continue;
      }

      if (!pkgName) {
        continue;
      }

      // The package doesn't keep src files in `src`, drop into the misc items section
      if (srcPath !== "src" || !component) {
        miscRoot.children![channel.name] = {
          label: channel.name,
          visible: channel.enabled,
        };

        itemDetailByPath.set(`misc/${channelName}`, {
          type: "channel",
          fullPath: channel.name,
        });
        continue;
      }

      // Setup the package name node
      const pkgNode = (settingsRoot[pkgName] ??= {
        label: pkgName,
        visible: false,
        children: {},
      });

      itemDetailByPath.set(pkgName, {
        type: "prefix",
        fullPath: `${studioSpacePrefix}packages/${pkgName}`,
      });

      const componentNode = (pkgNode.children![component] ??= {
        label: component,
        visible: false,
      });

      if (channel.enabled) {
        pkgNode.visible = true;
        componentNode.visible = true;
      }

      // The component has a file extension, no subtree is added under the component
      if (extname(component)) {
        itemDetailByPath.set(`${pkgName}/${component}`, {
          type: "channel",
          fullPath: `${studioSpacePrefix}packages/${pkgName}/src/${component}`,
        });
        continue;
      }

      itemDetailByPath.set(`${pkgName}/${component}`, {
        type: "prefix",
        fullPath: `${studioSpacePrefix}packages/${pkgName}/src/${component}`,
      });

      // If there are items under the component, add a children entry and add them to the children entry
      if (rest.length > 0) {
        // Component node is not a file so it might have children under it
        componentNode.children ??= {};

        const leafId = rest.join("/");
        componentNode.children[leafId] = {
          label: leafId,
          visible: channel.enabled,
        };

        itemDetailByPath.set(`${pkgName}/${component}/${leafId}`, {
          type: "channel",
          fullPath: `${studioSpacePrefix}packages/${pkgName}/src/${component}/${leafId}`,
        });
      }
    }

    // Add misc nodes at the end of root
    settingsRoot["misc"] = miscRoot;

    return {
      enableFilter: true,
      actionHandler: (action) => {
        log.debug("action", action);

        if (action.action === "update" && action.payload.path.join(".") === "Settings.level") {
          if (typeof action.payload.value !== "string") {
            return;
          }
          logsConfig.setGlobalLevel(toLogLevel(action.payload.value));
          return;
        }

        // visibility toggle sends and update as if it was a boolean input
        if (action.action !== "update" || action.payload.input !== "boolean") {
          return;
        }

        // When using settings visibility toggle the last item of the path is the word "visible"
        // Since that's our only action we ignore any other type of path
        const path = action.payload.path;
        const lastPathItem = path[path.length - 1];
        if (lastPathItem !== "visible") {
          return;
        }

        const enable = action.payload.value === true;

        const remain = path.slice(0, path.length - 1);
        const pathStr = remain.join("/");

        const item = itemDetailByPath.get(pathStr);
        switch (item?.type) {
          case "prefix":
            if (enable) {
              logsConfig.enablePrefix(item.fullPath);
            } else {
              logsConfig.disablePrefix(item.fullPath);
            }
            break;
          case "channel":
            if (enable) {
              logsConfig.enableChannel(item.fullPath);
            } else {
              logsConfig.disableChannel(item.fullPath);
            }
            break;
          default:
            // no-op for undefined
            break;
        }
      },
      nodes: settingsRoot,
    };
  }, [logsConfig]);
}

export { useStudioLogsSettingsTree };
