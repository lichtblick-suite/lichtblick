// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2019-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { Button, Typography, styled as muiStyled, OutlinedInput } from "@mui/material";
import produce from "immer";
import { set } from "lodash";
import { useCallback, useEffect, useMemo, useRef } from "react";

import { useRethrow } from "@foxglove/hooks";
import { SettingsTreeAction, SettingsTreeNodes } from "@foxglove/studio";
import { useDataSourceInfo } from "@foxglove/studio-base/PanelAPI";
import Autocomplete, { IAutocomplete } from "@foxglove/studio-base/components/Autocomplete";
import Panel from "@foxglove/studio-base/components/Panel";
import PanelToolbar from "@foxglove/studio-base/components/PanelToolbar";
import Stack from "@foxglove/studio-base/components/Stack";
import usePublisher from "@foxglove/studio-base/hooks/usePublisher";
import { PlayerCapabilities, Topic } from "@foxglove/studio-base/players/types";
import { usePanelSettingsTreeUpdate } from "@foxglove/studio-base/providers/PanelSettingsEditorContextProvider";
import { SaveConfig } from "@foxglove/studio-base/types/panels";
import { fonts } from "@foxglove/studio-base/util/sharedStyleConstants";

import buildSampleMessage from "./buildSampleMessage";
import helpContent from "./index.help.md";

type Config = Partial<{
  topicName: string;
  datatype: string;
  buttonText: string;
  buttonTooltip: string;
  buttonColor: string;
  advancedView: boolean;
  value: string;
}>;

type Props = {
  config: Config;
  saveConfig: SaveConfig<Config>;
};

function buildSettingsTree(config: Config): SettingsTreeNodes {
  return {
    general: {
      icon: "Settings",
      fields: {
        advancedView: { label: "Editing Mode", input: "boolean", value: config.advancedView },
        buttonText: { label: "Button Title", input: "string", value: config.buttonText },
        buttonTooltip: { label: "Button Tooltip", input: "string", value: config.buttonTooltip },
        buttonColor: { label: "Button Color", input: "rgb", value: config.buttonColor },
      },
    },
  };
}

const StyledButton = muiStyled(Button, {
  shouldForwardProp: (prop) => prop !== "buttonColor",
})<{ buttonColor?: string }>(({ theme, buttonColor }) => {
  if (buttonColor == undefined) {
    return {};
  }
  const augmentedButtonColor = theme.palette.augmentColor({
    color: { main: buttonColor },
  });

  return {
    backgroundColor: augmentedButtonColor.main,
    color: augmentedButtonColor.contrastText,

    "&:hover": {
      backgroundColor: augmentedButtonColor.dark,
    },
  };
});

const StyledTextarea = muiStyled(OutlinedInput)(({ theme }) => ({
  width: "100%",
  height: "100%",
  textAlign: "left",
  backgroundColor: theme.palette.background.paper,
  overflow: "hidden",
  padding: theme.spacing(1, 0.5),

  ".MuiInputBase-input": {
    height: "100% !important",
    font: "inherit",
    lineHeight: 1.4,
    fontFamily: fonts.MONOSPACE,
    fontSize: "100%",
    overflow: "auto !important",
    resize: "none",
  },
}));

function getTopicName(topic: Topic): string {
  return topic.name;
}

function parseInput(value: string): { error?: string; parsedObject?: unknown } {
  let parsedObject;
  let error = undefined;
  try {
    const parsedAny: unknown = JSON.parse(value);
    if (Array.isArray(parsedAny)) {
      error = "Message content must be an object, not an array";
    } else if (parsedAny == null /* eslint-disable-line no-restricted-syntax */) {
      error = "Message content must be an object, not null";
    } else if (typeof parsedAny !== "object") {
      error = `Message content must be an object, not ‘${typeof parsedAny}’`;
    } else {
      parsedObject = parsedAny;
    }
  } catch (e) {
    error = value.length !== 0 ? e.message : "";
  }
  return { error, parsedObject };
}

function Publish(props: Props) {
  const { topics, datatypes, capabilities } = useDataSourceInfo();
  const {
    config: {
      topicName = "",
      datatype = "",
      buttonText = "Publish",
      buttonTooltip = "",
      buttonColor = "#00A871",
      advancedView = true,
      value = "",
    },
    saveConfig,
  } = props;

  const publish = usePublisher({ name: "Publish", topic: topicName, datatype, datatypes });

  const datatypeNames = useMemo(() => Array.from(datatypes.keys()).sort(), [datatypes]);
  const { error, parsedObject } = useMemo(() => parseInput(value), [value]);
  const updatePanelSettingsTree = usePanelSettingsTreeUpdate();

  // when the selected datatype changes, replace the textarea contents with a sample message of the correct shape
  // Make sure not to build a sample message on first load, though -- we don't want to overwrite
  // the user's message just because prevDatatype hasn't been initialized.
  const prevDatatype = useRef<string | undefined>();
  useEffect(() => {
    if (
      datatype.length > 0 &&
      prevDatatype.current != undefined &&
      datatype !== prevDatatype.current &&
      datatypes.get(datatype) != undefined
    ) {
      const sampleMessage = buildSampleMessage(datatypes, datatype);
      if (sampleMessage != undefined) {
        const stringifiedSampleMessage = JSON.stringify(sampleMessage, undefined, 2);
        saveConfig({ value: stringifiedSampleMessage });
      }
    }
    prevDatatype.current = datatype;
  }, [saveConfig, datatype, datatypes]);

  const actionHandler = useCallback(
    (action: SettingsTreeAction) => {
      if (action.action !== "update") {
        return;
      }

      saveConfig(
        produce((draft) => {
          set(draft, action.payload.path.slice(1), action.payload.value);
        }),
      );
    },
    [saveConfig],
  );

  useEffect(() => {
    updatePanelSettingsTree({
      actionHandler,
      nodes: buildSettingsTree(props.config),
    });
  }, [actionHandler, props.config, updatePanelSettingsTree]);

  const onChangeTopic = useCallback(
    (_event: unknown, name: string) => {
      saveConfig({ topicName: name });
    },
    [saveConfig],
  );

  // when a known topic is selected, also fill in its datatype
  const onSelectTopic = useCallback(
    (name: string, topic: Topic, autocomplete: IAutocomplete) => {
      saveConfig({ topicName: name, datatype: topic.schemaName });
      autocomplete.blur();
    },
    [saveConfig],
  );

  const onSelectDatatype = useCallback(
    (newDatatype: string, _value: unknown, autocomplete: IAutocomplete) => {
      saveConfig({ datatype: newDatatype });
      autocomplete.blur();
    },
    [saveConfig],
  );

  const onPublishClicked = useRethrow(
    useCallback(() => {
      if (topicName.length !== 0 && parsedObject != undefined) {
        publish(parsedObject as Record<string, unknown>);
      } else {
        throw new Error(`called _publish() when input was invalid`);
      }
    }, [publish, parsedObject, topicName]),
  );

  const canPublish = capabilities.includes(PlayerCapabilities.advertise);

  return (
    <Stack fullHeight>
      <PanelToolbar helpContent={helpContent} />
      {advancedView && (
        <Stack flex="auto" padding={2} gap={1} paddingBottom={0}>
          <div>
            <Stack alignItems="baseline" gap={1} padding={0.5} direction="row" flexShrink={0}>
              <Typography color="text.secondary" variant="body2" component="label">
                Topic:
              </Typography>
              <Autocomplete
                placeholder="Choose a topic"
                items={[...topics]}
                hasError={false}
                onChange={onChangeTopic}
                onSelect={onSelectTopic}
                selectedItem={{ name: topicName, schemaName: "" }}
                getItemText={getTopicName}
                getItemValue={getTopicName}
              />
            </Stack>
            <Stack alignItems="baseline" gap={1} padding={0.5} direction="row" flexShrink={0}>
              <Typography color="text.secondary" variant="body2" component="label">
                Datatype:
              </Typography>
              <Autocomplete
                clearOnFocus
                placeholder="Choose a datatype"
                items={datatypeNames}
                onSelect={onSelectDatatype}
                selectedItem={datatype}
              />
            </Stack>
          </div>
          <Stack flex="auto">
            <StyledTextarea
              multiline
              placeholder="Enter message content as JSON"
              value={value}
              onChange={(event) => saveConfig({ value: event.target.value })}
            />
          </Stack>
        </Stack>
      )}
      <Stack
        direction="row"
        flex="0 0 auto"
        alignItems="flex-start"
        justifyContent={advancedView ? "flex-end" : "center"}
        padding={2}
      >
        {error && (
          <Stack flex="auto" padding={0.5} justifyContent="center">
            <Typography variant="body2" color="error.main">
              {error}
            </Typography>
          </Stack>
        )}
        <StyledButton
          variant="contained"
          size="large"
          buttonColor={buttonColor ? buttonColor : undefined}
          title={canPublish ? buttonTooltip : "Connect to ROS to publish data"}
          disabled={!canPublish || parsedObject == undefined}
          onClick={onPublishClicked}
        >
          {buttonText}
        </StyledButton>
      </Stack>
    </Stack>
  );
}

export default Panel(
  Object.assign(React.memo(Publish), {
    panelType: "Publish",
    defaultConfig: {
      topicName: "",
      datatype: "",
      buttonText: "Publish",
      buttonTooltip: "",
      buttonColor: "#00A871",
      advancedView: true,
      value: "",
    },
  }),
);
