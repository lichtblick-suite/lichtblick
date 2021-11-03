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

import { ContextualMenu, DefaultButton, Dialog, DialogFooter } from "@fluentui/react";
import { isEmpty, omit } from "lodash";
import Tabs, { TabPane } from "rc-tabs";
import React, { useCallback } from "react";

import ErrorBoundary from "@foxglove/studio-base/components/ErrorBoundary";
import { RenderToBodyComponent } from "@foxglove/studio-base/components/RenderToBodyComponent";
import { topicSettingsEditorForDatatype } from "@foxglove/studio-base/panels/ThreeDimensionalViz/TopicSettingsEditor";
import { Topic } from "@foxglove/studio-base/players/types";
import { SECOND_SOURCE_PREFIX } from "@foxglove/studio-base/util/globalConstants";

import { Save3DConfig } from "../index";

function MainEditor({
  datatype,
  collectorMessage,
  columnIndex: _columnIndex,
  onFieldChange,
  onSettingsChange,
  setCurrentEditingTopic,
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
  setCurrentEditingTopic: (arg0?: Topic) => void;
  settings: Record<string, unknown>;
  topicName: string;
}) {
  const Editor = topicSettingsEditorForDatatype(datatype);
  if (!Editor) {
    throw new Error(`No topic settings editor available for ${datatype}`);
  }

  return (
    <ErrorBoundary>
      <div>
        <Editor
          message={collectorMessage}
          onFieldChange={onFieldChange}
          settings={settings}
          onSettingsChange={onSettingsChange}
        />
        <DialogFooter>
          <DefaultButton onClick={() => onSettingsChange({})}>Reset to defaults</DefaultButton>
          <DefaultButton primary onClick={() => setCurrentEditingTopic(undefined)}>
            Done
          </DefaultButton>
        </DialogFooter>
      </div>
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
      setCurrentEditingTopic={setCurrentEditingTopic}
    />
  );

  return (
    <RenderToBodyComponent>
      <Dialog
        isOpen
        onDismiss={() => setCurrentEditingTopic(undefined)}
        dialogContentProps={{
          title: currentEditingTopic.name,
          subText: currentEditingTopic.datatype,
          showCloseButton: true,
        }}
        maxWidth={480}
        minWidth={480}
        modalProps={{
          isModeless: true,
          dragOptions: {
            moveMenuItemText: "Move",
            closeMenuItemText: "Close",
            menu: ContextualMenu,
          },
        }}
      >
        {hasFeatureColumn ? (
          <Tabs
            activeKey={`${columnIndex}`}
            onChange={(newKey) => {
              const newEditingTopicName =
                newKey === "0" ? nonPrefixedTopic : `${SECOND_SOURCE_PREFIX}${nonPrefixedTopic}`;
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
        ) : (
          editorElem
        )}
      </Dialog>
    </RenderToBodyComponent>
  );
}

export default React.memo<Props>(TopicSettingsModal);
