// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Checkbox, FormControlLabel } from "@mui/material";
import { useMemo } from "react";

import log from "@foxglove/log";
import Panel from "@foxglove/studio-base/components/Panel";
import PanelToolbar from "@foxglove/studio-base/components/PanelToolbar";
import Stack from "@foxglove/studio-base/components/Stack";

import helpContent from "./index.help.md";

type Config = {
  // we store disabled channels so any new channels are default enabled
  disabledChannels: string[];
};

type Props = {
  config: Config;
  saveConfig: (config: Config) => void;
};

function InternalLogs(props: Props) {
  const { config } = props;

  const disabledChannels = useMemo(() => {
    return new Set(config.disabledChannels);
  }, [config]);

  const channels = useMemo(() => {
    const allChannels = log.channels();
    for (const channel of allChannels) {
      const name = channel.name().length === 0 ? "default" : channel.name();
      if (disabledChannels.has(name)) {
        channel.disable();
      } else {
        channel.enable();
      }
    }
    return allChannels;
  }, [disabledChannels]);

  return (
    <Stack fullWidth overflowY="auto">
      <PanelToolbar helpContent={helpContent} />
      <Stack padding={1} gap={1}>
        {channels.map((logger) => {
          const label = logger.name().length === 0 ? "default" : logger.name();
          return (
            <FormControlLabel
              key={label}
              label={label}
              style={{
                wordBreak: "break-word",
              }}
              control={
                <Checkbox
                  checked={logger.isEnabled()}
                  onChange={(event) => {
                    // track disabled channels so loggers are on by default
                    if (event.target.checked) {
                      disabledChannels.delete(label);
                    } else {
                      disabledChannels.add(label);
                    }
                    props.saveConfig({
                      disabledChannels: Array.from(disabledChannels.values()),
                    });
                  }}
                />
              }
            />
          );
        })}
      </Stack>
    </Stack>
  );
}

InternalLogs.panelType = "InternalLogs";
InternalLogs.defaultConfig = {
  disabledChannels: [],
} as Config;

export default Panel(InternalLogs);
