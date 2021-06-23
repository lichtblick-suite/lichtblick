// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { isEmpty, omit } from "lodash";
import Tabs, { TabPane } from "rc-tabs";
import React, { useCallback } from "react";
import styled from "styled-components";

import Button from "@foxglove/studio-base/components/Button";
import ErrorBoundary from "@foxglove/studio-base/components/ErrorBoundary";
import Modal from "@foxglove/studio-base/components/Modal";
import { RenderToBodyComponent } from "@foxglove/studio-base/components/RenderToBodyComponent";
import { topicSettingsEditorForDatatype } from "@foxglove/studio-base/panels/ThreeDimensionalViz/TopicSettingsEditor";
import { Topic } from "@foxglove/studio-base/players/types";
import { SECOND_SOURCE_PREFIX } from "@foxglove/studio-base/util/globalConstants";
import { colors } from "@foxglove/studio-base/util/sharedStyleConstants";

import { Save3DConfig } from "../index";

const STopicSettingsEditor = styled.div`
  background: ${colors.DARK2};
  color: ${colors.TEXT};
  padding: 16px;
`;
const STitle = styled.h3`
  font-size: 20px;
  font-size: 20px;
  margin-right: 36px;
  word-break: break-all;
  line-height: 1.3;
`;

const SDatatype = styled.p`
  padding-bottom: 12px;
`;

const SEditorWrapper = styled.div`
  color: ${colors.TEXT};
  width: 400px;
`;

const STabWrapper = styled.div`
  .rc-tabs-nav-list {
    display: flex;
  }
  .rc-tabs-tab {
    margin-right: 16px;
    padding-bottom: 6px;
    margin-bottom: 8px;
    color: ${colors.TEXT};
    font-size: 14px;
    cursor: pointer;
  }
  .rc-tabs-tab-active {
    border-bottom: 2px solid ${colors.BLUEL1};
  }
  .rc-tabs-nav-operations {
    display: none;
  }
`;

function MainEditor({
  datatype,
  collectorMessage,
  columnIndex: _columnIndex,
  onFieldChange,
  onSettingsChange,
  settings,
  topicName: _topicName,
}: {
  datatype: string;
  collectorMessage: unknown;
  columnIndex: number;
  onFieldChange: (fieldName: string, value: unknown) => void;
  onSettingsChange: (
    settings:
      | Record<string, unknown>
      | ((prevSettings: Record<string, unknown>) => Record<string, unknown>),
  ) => void;
  settings: Record<string, unknown>;
  topicName: string;
}) {
  const Editor = topicSettingsEditorForDatatype(datatype);
  if (!Editor) {
    throw new Error(`No topic settings editor available for ${datatype}`);
  }

  return (
    <ErrorBoundary>
      <SEditorWrapper>
        <Editor
          message={collectorMessage}
          onFieldChange={onFieldChange}
          settings={settings}
          onSettingsChange={onSettingsChange}
        />
        <Button
          className="test-reset-settings-btn"
          style={{ marginTop: 8 }}
          onClick={() => {
            onSettingsChange({});
          }}
        >
          Reset to defaults
        </Button>
      </SEditorWrapper>
    </ErrorBoundary>
  );
}

type Props = {
  currentEditingTopic: Topic;
  hasFeatureColumn: boolean;
  saveConfig: Save3DConfig;
  sceneBuilderMessage: unknown;
  setCurrentEditingTopic: (arg0?: Topic) => void;
  settingsByKey: {
    [topic: string]: Record<string, unknown>;
  };
};

function TopicSettingsModal({
  currentEditingTopic,
  currentEditingTopic: { datatype, name: topicName },
  hasFeatureColumn,
  saveConfig,
  sceneBuilderMessage,
  setCurrentEditingTopic,
  settingsByKey,
}: Props) {
  const topicSettingsKey = `t:${topicName}`;
  const onSettingsChange = useCallback(
    (
      settings:
        | Record<string, unknown>
        | ((prevSettings: Record<string, unknown>) => Record<string, unknown>),
    ) => {
      if (typeof settings !== "function" && isEmpty(settings)) {
        // Remove the field if the topic settings are empty to prevent the panelConfig from every growing.
        saveConfig({ settingsByKey: omit(settingsByKey, [topicSettingsKey]) });
        return;
      }
      saveConfig({
        settingsByKey: {
          ...settingsByKey,
          [topicSettingsKey]:
            typeof settings === "function"
              ? settings(settingsByKey[topicSettingsKey] ?? {})
              : settings,
        },
      });
    },
    [saveConfig, settingsByKey, topicSettingsKey],
  );

  const onFieldChange = useCallback(
    (fieldName: string, value: unknown) => {
      onSettingsChange((prevSettings: Record<string, unknown>) => ({
        ...prevSettings,
        [fieldName]: value,
      }));
    },
    [onSettingsChange],
  );

  const columnIndex = topicName.startsWith(SECOND_SOURCE_PREFIX) ? 1 : 0;
  const nonPrefixedTopic =
    columnIndex === 1 ? topicName.substr(SECOND_SOURCE_PREFIX.length) : topicName;

  const editorElem = (
    <MainEditor
      collectorMessage={sceneBuilderMessage}
      columnIndex={columnIndex}
      datatype={datatype}
      onFieldChange={onFieldChange}
      onSettingsChange={onSettingsChange}
      settings={settingsByKey[topicSettingsKey] ?? {}}
      topicName={nonPrefixedTopic}
    />
  );
  return (
    <RenderToBodyComponent>
      <Modal
        onRequestClose={() => setCurrentEditingTopic(undefined)}
        contentStyle={{
          maxHeight: "calc(100vh - 200px)",
          maxWidth: 480,
          display: "flex",
          flexDirection: "column",
          overflow: "auto",
        }}
      >
        <STopicSettingsEditor>
          <STitle>{currentEditingTopic.name}</STitle>
          <SDatatype>{currentEditingTopic.datatype}</SDatatype>
          {hasFeatureColumn ? (
            <STabWrapper>
              <Tabs
                activeKey={`${columnIndex}`}
                onChange={(newKey) => {
                  const newEditingTopicName =
                    newKey === "0"
                      ? nonPrefixedTopic
                      : `${SECOND_SOURCE_PREFIX}${nonPrefixedTopic}`;
                  setCurrentEditingTopic({ datatype, name: newEditingTopicName });
                }}
              >
                <TabPane tab={"base"} key={"0"}>
                  {editorElem}
                </TabPane>
                <TabPane tab={SECOND_SOURCE_PREFIX} key={"1"}>
                  {editorElem}
                </TabPane>
              </Tabs>
            </STabWrapper>
          ) : (
            editorElem
          )}
        </STopicSettingsEditor>
      </Modal>
    </RenderToBodyComponent>
  );
}

export default React.memo<Props>(TopicSettingsModal);
