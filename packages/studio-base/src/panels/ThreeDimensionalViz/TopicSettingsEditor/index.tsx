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

import React, { useCallback, ComponentType } from "react";

import ErrorBoundary from "@foxglove/studio-base/components/ErrorBoundary";
import { LegacyButton } from "@foxglove/studio-base/components/LegacyStyledComponents";
import GridSettingsEditor from "@foxglove/studio-base/panels/ThreeDimensionalViz/TopicSettingsEditor/GridSettingsEditor";
import { TopicSettingsEditorProps } from "@foxglove/studio-base/panels/ThreeDimensionalViz/TopicSettingsEditor/types";
import { Topic } from "@foxglove/studio-base/players/types";
import {
  FOXGLOVE_GRID_DATATYPE,
  NAV_MSGS_PATH_DATATYPE,
  POINT_CLOUD_DATATYPE,
  POSE_STAMPED_DATATYPE,
  SENSOR_MSGS_LASER_SCAN_DATATYPE,
  VELODYNE_SCAN_DATATYPE,
  VISUALIZATION_MSGS_MARKER_ARRAY_DATATYPE,
  VISUALIZATION_MSGS_MARKER_DATATYPE,
} from "@foxglove/studio-base/util/globalConstants";

import LaserScanSettingsEditor from "./LaserScanSettingsEditor";
import MarkerSettingsEditor from "./MarkerSettingsEditor";
import PointCloudSettingsEditor from "./PointCloudSettingsEditor";
import PoseSettingsEditor from "./PoseSettingsEditor";
import styles from "./TopicSettingsEditor.module.scss";

export type { TopicSettingsEditorProps } from "./types";

export function topicSettingsEditorForDatatype(datatype: string):
  | (ComponentType<TopicSettingsEditorProps<unknown, Record<string, unknown>>> & {
      canEditNamespaceOverrideColor?: boolean;
    })
  | undefined {
  const editors = new Map<string, unknown>([
    [FOXGLOVE_GRID_DATATYPE, GridSettingsEditor],
    [POINT_CLOUD_DATATYPE, PointCloudSettingsEditor],
    [VELODYNE_SCAN_DATATYPE, PointCloudSettingsEditor],
    [POSE_STAMPED_DATATYPE, PoseSettingsEditor],
    [SENSOR_MSGS_LASER_SCAN_DATATYPE, LaserScanSettingsEditor],
    [VISUALIZATION_MSGS_MARKER_DATATYPE, MarkerSettingsEditor],
    [VISUALIZATION_MSGS_MARKER_ARRAY_DATATYPE, MarkerSettingsEditor],
    [NAV_MSGS_PATH_DATATYPE, MarkerSettingsEditor],
  ]);

  return editors.get(datatype) as
    | (ComponentType<TopicSettingsEditorProps<unknown, Record<string, unknown>>> & {
        canEditNamespaceOverrideColor?: boolean;
      })
    | undefined;
}

export function canEditDatatype(datatype: string): boolean {
  return topicSettingsEditorForDatatype(datatype) != undefined;
}

export function canEditNamespaceOverrideColorDatatype(datatype: string): boolean {
  const editor = topicSettingsEditorForDatatype(datatype);
  return editor?.canEditNamespaceOverrideColor === true;
}

type Props = {
  topic: Topic;
  message: unknown;
  settings?: Record<string, unknown>;
  onSettingsChange: (
    arg0:
      | Record<string, unknown>
      | ((prevSettings: Record<string, unknown>) => Record<string, unknown>),
  ) => void;
};

const TopicSettingsEditor = React.memo<Props>(function TopicSettingsEditor({
  topic,
  message,
  settings,
  onSettingsChange,
}: Props) {
  const onFieldChange = useCallback(
    (fieldName: string, value: unknown) => {
      onSettingsChange((newSettings) => ({ ...newSettings, [fieldName]: value }));
    },
    [onSettingsChange],
  );

  const Editor = topicSettingsEditorForDatatype(topic.datatype);
  if (!Editor) {
    throw new Error(`No topic settings editor available for ${topic.datatype}`);
  }

  return (
    <div className={styles.container}>
      <h3 className={styles.topicName}>{topic.name}</h3>
      <h4 className={styles.datatype}>
        <code>{topic.datatype}</code>
      </h4>
      <ErrorBoundary>
        <Editor
          message={message}
          settings={settings ?? {}}
          onFieldChange={onFieldChange}
          onSettingsChange={onSettingsChange}
        />
      </ErrorBoundary>
      <LegacyButton onClick={() => onSettingsChange({})}>Reset to defaults</LegacyButton>
    </div>
  );
});

export default TopicSettingsEditor;
