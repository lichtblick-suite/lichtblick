// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { createStore, StoreApi } from "zustand";

import Log, { Logger } from "@foxglove/log";
import {
  IStudioLogsSettings,
  StudioLogConfigChannel,
} from "@foxglove/studio-base/context/StudioLogsSettingsContext";

import { LocalStorageSaveState } from "./types";

const log = Log.getLogger(__filename);

function createStudioLogsSettingsStore(
  initialState?: LocalStorageSaveState,
): StoreApi<IStudioLogsSettings> {
  log.debug(
    `Initializing log Config. ${initialState?.disabledChannels.length ?? 0} disabled channels.`,
  );
  const channels: StudioLogConfigChannel[] = [];

  // Lookup channel by name, there might be multiple channels that use the same name
  const channelByName = new Map<string, Logger[]>();

  const sortedChannels = Log.channels().sort((a, b) => a.name().localeCompare(b.name()));

  for (const channel of sortedChannels) {
    const name = channel.name() ? channel.name() : "<root>";

    if (initialState?.disabledChannels.includes(name) === true) {
      channel.disable();
    } else {
      channel.enable();
    }

    // Only add to the channels list (for the provider) if we haven't seen this name.
    // If another channel has the same name we only add to the channels list once because they
    // are indistiguishable from each other.
    if (!channelByName.has(name)) {
      channels.push({
        name,
        enabled: channel.isEnabled(),
      });
    }

    const existing = channelByName.get(name) ?? [];
    existing.push(channel);
    channelByName.set(name, existing);
  }

  function regenerateChannels(set: (partial: Partial<IStudioLogsSettings>) => void) {
    let didChange = false;
    for (const channel of channels) {
      const logChannels = channelByName.get(channel.name);
      if (!logChannels) {
        continue;
      }

      const anyChannel = logChannels[0];
      if (anyChannel && anyChannel.isEnabled() !== channel.enabled) {
        channel.enabled = anyChannel.isEnabled();
        didChange = true;
      }
    }

    if (!didChange) {
      return;
    }

    set({ channels: [...channels] });
  }

  return createStore<IStudioLogsSettings>((set) => ({
    channels,

    enableChannel(name: string) {
      log.debug(`Enable channel: ${name}`);

      // Enable the underlying log channels
      const logChannels = channelByName.get(name) ?? [];
      for (const channel of logChannels) {
        channel.enable();
      }

      regenerateChannels(set);
    },
    disableChannel(name: string) {
      log.debug(`Disable channel: ${name}`);

      // Enable the underlying log channels
      const logChannels = channelByName.get(name) ?? [];
      for (const channel of logChannels) {
        channel.disable();
      }

      regenerateChannels(set);
    },

    enablePrefix(prefix: string) {
      log.debug(`Enable prefix ${prefix}`);
      // find all channels matching the prefix and enable them
      for (const [key, logChannels] of channelByName) {
        if (key.startsWith(prefix)) {
          for (const channel of logChannels) {
            channel.enable();
          }
        }
      }

      regenerateChannels(set);
    },
    disablePrefix(prefix: string) {
      log.debug(`Disable prefix ${prefix}`);

      for (const [key, logChannels] of channelByName) {
        if (key.startsWith(prefix)) {
          for (const channel of logChannels) {
            channel.disable();
          }
        }
      }

      regenerateChannels(set);
    },
  }));
}

export { createStudioLogsSettingsStore };
