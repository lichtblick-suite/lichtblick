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
import styled from "styled-components";

import Autocomplete from "@foxglove-studio/app/components/Autocomplete";
import Button from "@foxglove-studio/app/components/Button";
import Flex from "@foxglove-studio/app/components/Flex";
import Item from "@foxglove-studio/app/components/Menu/Item";
import Panel from "@foxglove-studio/app/components/Panel";
import PanelToolbar from "@foxglove-studio/app/components/PanelToolbar";
import Publisher from "@foxglove-studio/app/components/Publisher";
import { PlayerCapabilities, Topic } from "@foxglove-studio/app/players/types";
import {
  PanelToolbarInput,
  PanelToolbarLabel,
} from "@foxglove-studio/app/shared/panelToolbarStyles";
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

type PanelState = {
  cachedProps: Partial<Props>;
  datatypeNames: string[];
  parsedObject?: any;
  error?: string;
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

function parseInput(value: string): Partial<PanelState> {
  let parsedObject;
  let error = undefined;
  try {
    const parsedAny = JSON.parse(value);
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

class Publish extends React.PureComponent<Props, PanelState> {
  static panelType = "Publish";
  static defaultConfig = {
    topicName: "",
    datatype: "",
    buttonText: "Publish",
    buttonTooltip: "",
    buttonColor: "#00A871",
    advancedView: true,
    value: "",
  };

  _publisher = React.createRef<Publisher>();

  state = {
    cachedProps: {},
    datatypeNames: [],
    error: undefined,
    parsedObject: undefined,
  };

  static getDerivedStateFromProps(props: Props, state: PanelState) {
    const newState: Partial<PanelState> = parseInput(props.config.value);
    let changed = false;

    if (props !== state.cachedProps) {
      newState.cachedProps = props;
      changed = true;
    }

    if (props.datatypes !== state.cachedProps.datatypes) {
      newState.datatypeNames = Object.keys(props.datatypes).sort();
      changed = true;
    }

    // when the selected datatype changes, replace the textarea contents with a sample message of the correct shape
    // Make sure not to build a sample message on first load, though -- we don't want to overwrite
    // the user's message just because state.cachedProps.config hasn't been initialized.
    if (
      props.config.datatype &&
      state.cachedProps?.config?.datatype != undefined &&
      props.config.datatype !== state.cachedProps?.config?.datatype &&
      props.datatypes[props.config.datatype] != undefined
    ) {
      const sampleMessage = buildSampleMessage(props.datatypes, props.config.datatype);
      if (sampleMessage) {
        const stringifiedSampleMessage = JSON.stringify(sampleMessage, undefined, 2);
        props.saveConfig({ value: stringifiedSampleMessage });
        changed = true;
      }
    }

    return changed ? newState : undefined;
  }

  _onChangeTopic = (event: any, topicName: string) => {
    this.props.saveConfig({ topicName });
  };

  // when a known topic is selected, also fill in its datatype
  _onSelectTopic = (topicName: string, topic: Topic, autocomplete: Autocomplete) => {
    this.props.saveConfig({ topicName, datatype: topic.datatype });
    autocomplete.blur();
  };

  _onSelectDatatype = (datatype: string, value: any, autocomplete: Autocomplete) => {
    this.props.saveConfig({ datatype });
    autocomplete.blur();
  };

  _publish = () => {
    const { topicName } = this.props.config;
    const { parsedObject } = this.state;
    if (topicName && parsedObject && this._publisher.current) {
      this._publisher.current.publish(parsedObject);
    } else {
      throw new Error(`called _publish() when input was invalid`);
    }
  };

  _onChange = (event: React.SyntheticEvent<HTMLTextAreaElement>) => {
    this.props.saveConfig({ value: (event.target as any).value });
  };

  _renderMenuContent() {
    const { config, saveConfig } = this.props;

    return (
      <>
        <Item
          icon={config.advancedView ? <CheckboxMarkedIcon /> : <CheckboxBlankOutlineIcon />}
          onClick={() => {
            saveConfig({ advancedView: !config.advancedView });
          }}
        >
          <span>Advanced mode</span>
        </Item>
        <Item>
          <PanelToolbarLabel>Button text</PanelToolbarLabel>
          <PanelToolbarInput
            type="text"
            value={config.buttonText}
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
            value={config.buttonTooltip}
            onChange={(event) => {
              saveConfig({ buttonTooltip: event.target.value });
            }}
          />
        </Item>
        <Item>
          <PanelToolbarLabel>Button color (rgba or hex)</PanelToolbarLabel>
          <PanelToolbarInput
            type="text"
            value={config.buttonColor}
            onChange={(event) => {
              saveConfig({ buttonColor: event.target.value });
            }}
            placeholder="rgba(1,1,1,1) or #FFFFFF"
          />
        </Item>
      </>
    );
  }

  render() {
    const {
      capabilities,
      topics,
      config: { topicName, datatype, buttonText, buttonTooltip, buttonColor, advancedView, value },
    } = this.props;

    const { datatypeNames, parsedObject, error } = this.state;
    const canPublish = capabilities.includes(PlayerCapabilities.advertise);
    const buttonRowStyle = advancedView
      ? { flex: "0 0 auto" }
      : { flex: "0 0 auto", justifyContent: "center" };

    return (
      <Flex col style={{ height: "100%", padding: "12px" }}>
        {topicName && datatype && (
          <Publisher ref={this._publisher} name="Publish" topic={topicName} datatype={datatype} />
        )}
        <PanelToolbar floating menuContent={this._renderMenuContent()} />
        {advancedView && (
          <SRow>
            <SSpan>Topic:</SSpan>
            <Autocomplete
              placeholder="Choose a topic"
              items={topics}
              hasError={false}
              onChange={this._onChangeTopic}
              onSelect={this._onSelectTopic as any}
              selectedItem={{ name: topicName }}
              getItemText={getTopicName as any}
              getItemValue={getTopicName as any}
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
              onSelect={this._onSelectDatatype}
              selectedItem={datatype}
            />
          </SRow>
        )}
        {advancedView && (
          <STextAreaContainer>
            <STextArea
              placeholder="Enter message content as JSON"
              value={value || ""}
              onChange={this._onChange}
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
            onClick={this._publish}
          >
            {buttonText}
          </Button>
        </Flex>
      </Flex>
    );
  }
}

export default Panel(Publish);
