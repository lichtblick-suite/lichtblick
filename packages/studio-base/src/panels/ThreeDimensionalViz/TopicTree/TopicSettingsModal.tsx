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

import CloseIcon from "@mui/icons-material/Close";
import {
  Button,
  Dialog,
  DialogContent,
  DialogActions,
  Typography,
  IconButton,
} from "@mui/material";
import { isEmpty, omit } from "lodash";
import React, { useCallback } from "react";

import ErrorBoundary from "@foxglove/studio-base/components/ErrorBoundary";
import Stack from "@foxglove/studio-base/components/Stack";
import { topicSettingsEditorForDatatype } from "@foxglove/studio-base/panels/ThreeDimensionalViz/TopicSettingsEditor";
import { Topic } from "@foxglove/studio-base/players/types";

import { Save3DConfig } from "../index";

function MainEditor({
  datatype,
  collectorMessage,
  onFieldChange,
  onSettingsChange,
  setCurrentEditingTopic,
  settings,
  topicName: _topicName,
}: {
  datatype: string;
  collectorMessage: unknown;
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
      <DialogContent>
        <Editor
          message={collectorMessage}
          onFieldChange={onFieldChange}
          settings={settings}
          onSettingsChange={onSettingsChange}
        />
      </DialogContent>
      <DialogActions>
        <Button
          size="large"
          variant="outlined"
          color="inherit"
          onClick={() => onSettingsChange({})}
        >
          Reset to defaults
        </Button>
        <Button size="large" variant="contained" onClick={() => setCurrentEditingTopic(undefined)}>
          Done
        </Button>
      </DialogActions>
    </ErrorBoundary>
  );
}

type Props = {
  currentEditingTopic: Topic;
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

  return (
    <Dialog open onClose={() => setCurrentEditingTopic(undefined)} maxWidth="xs" fullWidth>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="flex-start"
        paddingX={3}
        paddingTop={2}
      >
        <Stack>
          <Typography variant="h4" fontWeight={600} gutterBottom>
            {currentEditingTopic.name}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {currentEditingTopic.datatype}
          </Typography>
        </Stack>

        <IconButton onClick={() => setCurrentEditingTopic(undefined)} edge="end">
          <CloseIcon />
        </IconButton>
      </Stack>
      <MainEditor
        collectorMessage={sceneBuilderMessage}
        datatype={datatype}
        onFieldChange={onFieldChange}
        onSettingsChange={onSettingsChange}
        settings={settingsByKey[topicSettingsKey] ?? {}}
        topicName={topicName}
        setCurrentEditingTopic={setCurrentEditingTopic}
      />
    </Dialog>
  );
}

export default React.memo<Props>(TopicSettingsModal);
