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

import CheckboxBlankOutlineIcon from "@mdi/svg/svg/checkbox-blank-outline.svg";
import CheckboxMarkedIcon from "@mdi/svg/svg/checkbox-marked.svg";
import { useCallback, useEffect, useMemo, useRef } from "react";
import styled from "styled-components";

import Autocomplete from "@foxglove-studio/app/components/Autocomplete";
import Button from "@foxglove-studio/app/components/Button";
import Flex from "@foxglove-studio/app/components/Flex";
import Item from "@foxglove-studio/app/components/Menu/Item";
import Panel from "@foxglove-studio/app/components/Panel";
import PanelToolbar from "@foxglove-studio/app/components/PanelToolbar";
import PanelToolbarInput from "@foxglove-studio/app/components/PanelToolbarInput";
import PanelToolbarLabel from "@foxglove-studio/app/components/PanelToolbarLabel";
import usePublisher from "@foxglove-studio/app/hooks/usePublisher";
import { PlayerCapabilities, Topic } from "@foxglove-studio/app/players/types";
import colors from "@foxglove-studio/app/styles/colors.module.scss";
import { RosDatatypes } from "@foxglove-studio/app/types/RosDatatypes";

import buildSampleMessage from "./buildSampleMessage";

type Config = {
  topicName: string;
  datatype: string;
  buttonText: string;
  buttonTooltip: string;
  buttonColor: string;
  advancedView: boolean;
  value: string;
};

type Props = {
  config: Config;
  saveConfig: (arg0: Partial<Config>) => void;

  // player state
  capabilities: string[];
  topics: Topic[];
  datatypes: RosDatatypes;
};

const STextArea = styled.textarea`
  width: 100%;
  height: 100%;
  resize: none;
`;

const STextAreaContainer = styled.div`
  flex-grow: 1;
  padding: 12px 0;
`;

const SErrorText = styled.div`
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  padding: 4px;
  color: ${colors.red};
`;

const SSpan = styled.span`
  opacity: 0.8;
`;
const SRow = styled.div`
  display: flex;
  line-height: 24px;
  flex-shrink: 0;
`;

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
    } else if (parsedAny === null /* eslint-disable-line no-restricted-syntax */) {
      error = "Message content must be an object, not null";
    } else if (typeof parsedAny !== "object") {
      error = `Message content must be an object, not ‘${typeof parsedAny}’`;
    } else {
      parsedObject = parsedAny;
    }
  } catch (e) {
    error = value ? e.message : "";
  }
  return { error, parsedObject };
}

function Publish(props: Props) {
  const {
    capabilities,
    topics,
    datatypes,
    config: { topicName, datatype, buttonText, buttonTooltip, buttonColor, advancedView, value },
    saveConfig,
  } = props;

  const publish = usePublisher({ name: "Publish", topic: topicName, datatype });

  const datatypeNames = useMemo(() => Object.keys(datatypes).sort(), [datatypes]);
  const { error, parsedObject } = useMemo(() => parseInput(value), [value]);

  // when the selected datatype changes, replace the textarea contents with a sample message of the correct shape
  // Make sure not to build a sample message on first load, though -- we don't want to overwrite
  // the user's message just because prevDatatype hasn't been initialized.
  const prevDatatype = useRef<string | undefined>();
  useEffect(() => {
    if (
      datatype.length > 0 &&
      prevDatatype.current != undefined &&
      datatype !== prevDatatype.current &&
      datatypes[datatype] != undefined
    ) {
      const sampleMessage = buildSampleMessage(datatypes, datatype);
      if (sampleMessage) {
        const stringifiedSampleMessage = JSON.stringify(sampleMessage, undefined, 2);
        saveConfig({ value: stringifiedSampleMessage });
      }
    }
    prevDatatype.current = datatype;
  }, [saveConfig, datatype, datatypes]);

  const onChangeTopic = useCallback(
    (event: unknown, name: string) => {
      saveConfig({ topicName: name });
    },
    [saveConfig],
  );

  // when a known topic is selected, also fill in its datatype
  const onSelectTopic = useCallback(
    (name: string, topic: Topic, autocomplete: Autocomplete<Topic>) => {
      saveConfig({ topicName: name, datatype: topic.datatype });
      autocomplete.blur();
    },
    [saveConfig],
  );

  const onSelectDatatype = useCallback(
    (newDatatype: string, _value: unknown, autocomplete: Autocomplete<string>) => {
      saveConfig({ datatype: newDatatype });
      autocomplete.blur();
    },
    [saveConfig],
  );

  const onPublishClicked = useCallback(() => {
    if (topicName && parsedObject) {
      publish(parsedObject);
    } else {
      throw new Error(`called _publish() when input was invalid`);
    }
  }, [publish, parsedObject, topicName]);

  const onChange = useCallback(
    (event: React.SyntheticEvent<HTMLTextAreaElement>) => {
      saveConfig({ value: (event.target as any).value });
    },
    [saveConfig],
  );

  const menuContent = (
    <>
      <Item
        icon={advancedView ? <CheckboxMarkedIcon /> : <CheckboxBlankOutlineIcon />}
        onClick={() => {
          saveConfig({ advancedView: !advancedView });
        }}
      >
        <span>Advanced mode</span>
      </Item>
      <Item>
        <PanelToolbarLabel>Button text</PanelToolbarLabel>
        <PanelToolbarInput
          type="text"
          value={buttonText}
          onChange={(event) => {
            saveConfig({ buttonText: event.target.value });
          }}
          placeholder="Publish"
        />
      </Item>
      <Item>
        <PanelToolbarLabel>Button tooltip</PanelToolbarLabel>
        <PanelToolbarInput
          type="text"
          value={buttonTooltip}
          onChange={(event) => {
            saveConfig({ buttonTooltip: event.target.value });
          }}
        />
      </Item>
      <Item>
        <PanelToolbarLabel>Button color (rgba or hex)</PanelToolbarLabel>
        <PanelToolbarInput
          type="text"
          value={buttonColor}
          onChange={(event) => {
            saveConfig({ buttonColor: event.target.value });
          }}
          placeholder="rgba(1,1,1,1) or #FFFFFF"
        />
      </Item>
    </>
  );

  const canPublish = capabilities.includes(PlayerCapabilities.advertise);
  const buttonRowStyle = advancedView
    ? { flex: "0 0 auto" }
    : { flex: "0 0 auto", justifyContent: "center" };

  return (
    <Flex col style={{ height: "100%", padding: "12px" }}>
      <PanelToolbar floating menuContent={menuContent} />
      {advancedView && (
        <SRow>
          <SSpan>Topic:</SSpan>
          <Autocomplete
            placeholder="Choose a topic"
            items={topics}
            hasError={false}
            onChange={onChangeTopic}
            onSelect={onSelectTopic}
            selectedItem={{ name: topicName, datatype: "" }}
            getItemText={getTopicName}
            getItemValue={getTopicName}
          />
        </SRow>
      )}
      {advancedView && (
        <SRow>
          <PanelToolbarLabel>Datatype:</PanelToolbarLabel>
          <Autocomplete
            clearOnFocus
            placeholder="Choose a datatype"
            items={datatypeNames}
            onSelect={onSelectDatatype}
            selectedItem={datatype}
          />
        </SRow>
      )}
      {advancedView && (
        <STextAreaContainer>
          <STextArea
            placeholder="Enter message content as JSON"
            value={value || ""}
            onChange={onChange}
          />
        </STextAreaContainer>
      )}
      <Flex row style={buttonRowStyle}>
        {error && <SErrorText>{error}</SErrorText>}
        <Button
          style={canPublish ? { backgroundColor: buttonColor } : {}}
          tooltip={canPublish ? buttonTooltip : "Connect to ROS to publish data"}
          disabled={!canPublish || !parsedObject}
          primary={canPublish && !!parsedObject}
          onClick={onPublishClicked}
        >
          {buttonText}
        </Button>
      </Flex>
    </Flex>
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
