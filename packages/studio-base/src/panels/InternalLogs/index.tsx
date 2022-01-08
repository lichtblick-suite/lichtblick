// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Checkbox, Stack, useTheme } from "@fluentui/react";
import { useMemo } from "react";

import log from "@foxglove/log";
import Flex from "@foxglove/studio-base/components/Flex";
import Panel from "@foxglove/studio-base/components/Panel";
import PanelToolbar from "@foxglove/studio-base/components/PanelToolbar";

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

  const theme = useTheme();

  return (
    <Flex col scroll style={{ maxWidth: "100%" }}>
      <PanelToolbar floating helpContent={helpContent} />
      <Stack tokens={{ padding: theme.spacing.s1, childrenGap: theme.spacing.s1 }}>
        {channels.map((logger) => {
          const label = logger.name().length === 0 ? "default" : logger.name();
          return (
            <Checkbox
              key={label}
              label={label}
              styles={{ label: { wordBreak: "break-word" } }}
              checked={logger.isEnabled()}
              // eslint-disable-next-line @foxglove/no-boolean-parameters
              onChange={(_event, newChecked = false) => {
                // track disabled channels so loggers are on by default
                if (newChecked) {
                  disabledChannels.delete(label);
                } else {
                  disabledChannels.add(label);
                }

                props.saveConfig({
                  disabledChannels: Array.from(disabledChannels.values()),
                });
              }}
            />
          );
        })}
      </Stack>
    </Flex>
  );
}

InternalLogs.panelType = "InternalLogs";
InternalLogs.defaultConfig = {
  disabledChannels: [],
} as Config;

export default Panel(InternalLogs);
