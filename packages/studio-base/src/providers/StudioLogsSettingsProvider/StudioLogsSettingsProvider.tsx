// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { PropsWithChildren, useEffect, useState } from "react";
import { useLocalStorage } from "react-use";

import { StudioLogsSettingsContext } from "@foxglove/studio-base/context/StudioLogsSettingsContext";

import { createStudioLogsSettingsStore } from "./store";
import { LocalStorageSaveState } from "./types";

function StudioLogsSettingsProvider(props: PropsWithChildren<unknown>): JSX.Element {
  const [StudioLogsSettingsSavedState, setStudioLogsSettingsSavedState] =
    useLocalStorage<LocalStorageSaveState>("fox.studio-logs-settings", { disabledChannels: [] });

  const [StudioLogsSettingsStore] = useState(() =>
    createStudioLogsSettingsStore(StudioLogsSettingsSavedState),
  );

  useEffect(() => {
    return StudioLogsSettingsStore.subscribe((value) => {
      const disabledChannels: string[] = [];

      for (const channel of value.channels) {
        if (!channel.enabled) {
          disabledChannels.push(channel.name);
        }
      }
      setStudioLogsSettingsSavedState({ disabledChannels });
    });
  }, [StudioLogsSettingsStore, setStudioLogsSettingsSavedState]);

  return (
    <StudioLogsSettingsContext.Provider value={StudioLogsSettingsStore}>
      {props.children}
    </StudioLogsSettingsContext.Provider>
  );
}

export { StudioLogsSettingsProvider };
