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

import { upperFirst } from "lodash";
import React, { useCallback, ComponentType } from "react";

import LaserScanSettingsEditor from "./LaserScanSettingsEditor";
import MarkerSettingsEditor from "./MarkerSettingsEditor";
import PointCloudSettingsEditor from "./PointCloudSettingsEditor";
import PoseSettingsEditor from "./PoseSettingsEditor";
import styles from "./TopicSettingsEditor.module.scss";
import { SLabel, SDescription, SInput } from "./common";
import ErrorBoundary from "@foxglove-studio/app/components/ErrorBoundary";
import Flex from "@foxglove-studio/app/components/Flex";
import { Select, Option } from "@foxglove-studio/app/components/Select";
import { getGlobalHooks } from "@foxglove-studio/app/loadWebviz";
import { Topic } from "@foxglove-studio/app/players/types";
import {
  POINT_CLOUD_DATATYPE,
  POSE_STAMPED_DATATYPE,
  SENSOR_MSGS_LASER_SCAN_DATATYPE,
  WEBVIZ_MARKER_DATATYPE,
} from "@foxglove-studio/app/util/globalConstants";

export const LINED_CONVEX_HULL_RENDERING_SETTING = "LinedConvexHull";

export function CommonPointSettings({
  defaultPointSize,
  defaultPointShape = "circle",
  settings,
  onFieldChange,
}: {
  defaultPointSize: number;
  defaultPointShape?: string;
  settings: {
    pointSize?: number | null | undefined;
    pointShape?: string | null | undefined;
  };
  onFieldChange: (name: string, value: any) => void;
}) {
  const pointSizeVal = settings.pointSize === undefined ? "" : settings.pointSize;

  const pointShape = settings.pointShape;
  const pointShapeVal = pointShape ? pointShape : defaultPointShape;
  const pointShapeOpts = ["circle", "square"].map((field) => (
    <Option key={field} value={field}>
      {upperFirst(field)}
    </Option>
  ));

  return (
    <Flex col>
      <SLabel>Point size</SLabel>
      <SInput
        data-test="point-size-input"
        type="number"
        placeholder={defaultPointSize.toString()}
        value={pointSizeVal as any}
        min={1}
        max={50}
        step={1}
        onChange={(e) => {
          const isInputValid = !isNaN(parseFloat(e.target.value));
          onFieldChange("pointSize", isInputValid ? parseFloat(e.target.value) : undefined);
        }}
      />

      <SLabel>Point shape</SLabel>
      <Select
        text={upperFirst(pointShapeVal)}
        value={pointShapeVal}
        onChange={(value) => onFieldChange("pointShape", value)}
      >
        {pointShapeOpts}
      </Select>
    </Flex>
  );
}

export function CommonDecaySettings({
  settings,
  onFieldChange,
}: {
  settings: { decayTime?: number | null | undefined };
  onFieldChange: (name: string, value: any) => any;
}) {
  const decayTime = settings.decayTime;
  const decayTimeValue = decayTime === undefined ? "" : decayTime;

  return (
    <Flex col>
      <SLabel>Decay time (seconds)</SLabel>
      <SDescription>When set to 0, only the latest received data will be displayed.</SDescription>
      <SInput
        type="number"
        placeholder="0"
        value={decayTimeValue as any}
        min={0}
        step={0.1}
        onChange={(e) => {
          const isInputValid = !isNaN(parseFloat(e.target.value));
          onFieldChange("decayTime", isInputValid ? parseFloat(e.target.value) : undefined);
        }}
      />
    </Flex>
  );
}

export type TopicSettingsEditorProps<Msg, Settings> = {
  message: Msg | null | undefined;
  settings: Settings;
  onFieldChange: (name: string, value: any) => void;
  onSettingsChange: (arg0: any | ((arg0: any) => any)) => void;
};

export function topicSettingsEditorForDatatype(
  datatype: string,
): ComponentType<TopicSettingsEditorProps<any, any>> | null | undefined {
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
  return topicSettingsEditorForDatatype(datatype) != null;
}

export function canEditNamespaceOverrideColorDatatype(datatype: string): boolean {
  const editor = topicSettingsEditorForDatatype(datatype);
  return !!(editor && (editor as any).canEditNamespaceOverrideColor);
}

type Props = {
  topic: Topic;
  message: any;
  settings: any | null | undefined;
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
