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

import LaserScanSettingsEditor from "./LaserScanSettingsEditor";
import MarkerSettingsEditor from "./MarkerSettingsEditor";
import PointCloudSettingsEditor from "./PointCloudSettingsEditor";
import PoseSettingsEditor from "./PoseSettingsEditor";
import styles from "./TopicSettingsEditor.module.scss";
import ErrorBoundary from "@foxglove-studio/app/components/ErrorBoundary";
import { getGlobalHooks } from "@foxglove-studio/app/loadWebviz";
import { TopicSettingsEditorProps } from "@foxglove-studio/app/panels/ThreeDimensionalViz/TopicSettingsEditor/types";
import { Topic } from "@foxglove-studio/app/players/types";
import {
  POINT_CLOUD_DATATYPE,
  POSE_STAMPED_DATATYPE,
  SENSOR_MSGS_LASER_SCAN_DATATYPE,
  WEBVIZ_MARKER_DATATYPE,
} from "@foxglove-studio/app/util/globalConstants";

export const LINED_CONVEX_HULL_RENDERING_SETTING = "LinedConvexHull";

export type { TopicSettingsEditorProps } from "./types";

export function topicSettingsEditorForDatatype(
  datatype: string,
): ComponentType<TopicSettingsEditorProps<any, any>> | undefined {
  const editors = {
    [POINT_CLOUD_DATATYPE]: PointCloudSettingsEditor,
    [POSE_STAMPED_DATATYPE]: PoseSettingsEditor,
    [SENSOR_MSGS_LASER_SCAN_DATATYPE]: LaserScanSettingsEditor,
    [WEBVIZ_MARKER_DATATYPE]: MarkerSettingsEditor,
    "visualization_msgs/Marker": MarkerSettingsEditor,
    "visualization_msgs/MarkerArray": MarkerSettingsEditor,
    ...(getGlobalHooks() as any).perPanelHooks().ThreeDimensionalViz.topicSettingsEditors,
  };
  return editors[datatype];
}

export function canEditDatatype(datatype: string): boolean {
  return topicSettingsEditorForDatatype(datatype) != undefined;
}

export function canEditNamespaceOverrideColorDatatype(datatype: string): boolean {
  const editor = topicSettingsEditorForDatatype(datatype);
  return !!(editor && (editor as any).canEditNamespaceOverrideColor);
}

type Props = {
  topic: Topic;
  message: any;
  settings?: any;
  onSettingsChange: (arg0: any) => void;
};

const TopicSettingsEditor = React.memo<Props>(function TopicSettingsEditor({
  topic,
  message,
  settings,
  onSettingsChange,
}: Props) {
  const onFieldChange = useCallback(
    (fieldName: string, value: any) => {
      onSettingsChange((newSettings: any) => ({ ...newSettings, [fieldName]: value }));
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
          settings={settings || {}}
          onFieldChange={onFieldChange}
          onSettingsChange={onSettingsChange}
        />
      </ErrorBoundary>
      <button onClick={() => onSettingsChange({})}>Reset to defaults</button>
    </div>
  );
});

export default TopicSettingsEditor;
