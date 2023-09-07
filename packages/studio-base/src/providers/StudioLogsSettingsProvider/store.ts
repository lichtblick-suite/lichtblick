// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { createStore, StoreApi } from "zustand";

import Log, { Logger, LogLevel, toLogLevel } from "@foxglove/log";
import {
  IStudioLogsSettings,
  StudioLogConfigChannel,
} from "@foxglove/studio-base/context/StudioLogsSettingsContext";

import { LocalStorageSaveState } from "./types";

const log = Log.getLogger(__filename);

const defaultGlobalLevel: LogLevel = process.env.NODE_ENV === "development" ? "debug" : "warn";

function createStudioLogsSettingsStore(
  initialState?: LocalStorageSaveState,
): StoreApi<IStudioLogsSettings> {
  const globalLevel = toLogLevel(initialState?.globalLevel ?? defaultGlobalLevel);
  const disabledChannels = initialState?.disabledChannels ?? [];

  log.debug(`Initializing log Config. ${disabledChannels.length} disabled channels.`);
  const channels: StudioLogConfigChannel[] = [];

  // Lookup channel by name, there might be multiple channels that use the same name
  const channelByName = new Map<string, Logger[]>();

  const sortedChannels = Log.channels().sort((a, b) => a.name().localeCompare(b.name()));

  for (const channel of sortedChannels) {
    const name = channel.name() ? channel.name() : "<root>";

    if (disabledChannels.includes(name)) {
      channel.setLevel("warn");
    } else {
      channel.setLevel(globalLevel);
    }

    // enabled means the channel meets at least the global logging level?
    // if the channel is greater than the global logging level it is not enabled?

    // Only add to the channels list (for the provider) if we haven't seen this name.
    // If another channel has the same name we only add to the channels list once because they
    // are indistiguishable from each other.
    if (!channelByName.has(name)) {
      channels.push({
        name,
        enabled: channel.isLevelOn(globalLevel),
      });
    }

    const existing = channelByName.get(name) ?? [];
    existing.push(channel);
    channelByName.set(name, existing);
  }

  function regenerateChannels(
    get: () => IStudioLogsSettings,
    set: (partial: Partial<IStudioLogsSettings>) => void,
  ) {
    const currentGlobalLevel = get().globalLevel;
    let didChange = false;
    for (const channel of channels) {
      const logChannels = channelByName.get(channel.name);
      if (!logChannels) {
        continue;
      }

      const anyChannel = logChannels[0];
      if (anyChannel && anyChannel.isLevelOn(currentGlobalLevel) !== channel.enabled) {
        channel.enabled = !channel.enabled;
        didChange = true;
      }
    }

    if (!didChange) {
      return;
    }

    set({ channels: [...channels] });
  }

  return createStore<IStudioLogsSettings>((set, get) => ({
    globalLevel,

    channels,

    setGlobalLevel(level: LogLevel) {
      log.debug(`Set global level: ${level}`);

      // Enable the underlying log channels
      for (const [, logChannels] of channelByName) {
        for (const channel of logChannels) {
          channel.setLevel(level);
        }
      }

      set({ globalLevel: level });
      regenerateChannels(get, set);
    },

    enableChannel(name: string) {
      log.debug(`Enable channel: ${name}`);

      // Enable the underlying log channels
      const logChannels = channelByName.get(name) ?? [];
      for (const channel of logChannels) {
        channel.setLevel("debug");
      }

      regenerateChannels(get, set);
    },

    disableChannel(name: string) {
      log.debug(`Disable channel: ${name}`);

      // Enable the underlying log channels
      const logChannels = channelByName.get(name) ?? [];
      for (const channel of logChannels) {
        channel.setLevel("warn");
      }

      regenerateChannels(get, set);
    },

    enablePrefix(prefix: string) {
      log.debug(`Enable prefix ${prefix}`);
      // find all channels matching the prefix and enable them
      for (const [key, logChannels] of channelByName) {
        if (key.startsWith(prefix)) {
          for (const channel of logChannels) {
            channel.setLevel("debug");
          }
        }
      }

      regenerateChannels(get, set);
    },

    disablePrefix(prefix: string) {
      log.debug(`Disable prefix ${prefix}`);

      for (const [key, logChannels] of channelByName) {
        if (key.startsWith(prefix)) {
          for (const channel of logChannels) {
            channel.setLevel("warn");
          }
        }
      }

      regenerateChannels(get, set);
    },
  }));
}

export { createStudioLogsSettingsStore };
