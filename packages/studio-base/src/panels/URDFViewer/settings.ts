// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import produce from "immer";
import { clamp, isEmpty, set } from "lodash";
import { useCallback, useEffect, useMemo } from "react";
import { URDFRobot } from "urdf-loader";

import { filterMap } from "@foxglove/den/collection";
import { SettingsTreeAction, SettingsTreeFields, SettingsTreeNodes } from "@foxglove/studio";
import * as PanelAPI from "@foxglove/studio-base/PanelAPI";
import { useAssets } from "@foxglove/studio-base/context/AssetsContext";
import useRobotDescriptionAsset from "@foxglove/studio-base/panels/URDFViewer/useRobotDescriptionAsset";
import { Topic } from "@foxglove/studio-base/players/types";
import { usePanelSettingsTreeUpdate } from "@foxglove/studio-base/providers/PanelSettingsEditorContextProvider";
import { SaveConfig } from "@foxglove/studio-base/types/panels";
import { ROBOT_DESCRIPTION_PARAM } from "@foxglove/studio-base/util/globalConstants";

import { defaultConfig } from "./defaultConfig";
import { Config, DATA_TYPES } from "./types";

export function buildSettingsTree(
  config: Config,
  topics: readonly Topic[],
  model: undefined | URDFRobot,
  assetOptions: Array<{ label: string; value: string }>,
): SettingsTreeNodes {
  const manualControl = isEmpty(config.jointStatesTopic);
  const topicOptions = topics.map((topic) => ({ label: topic.name, value: topic.name }));

  // Insert our selected topic into the options list even if it's not in the
  // list of available topics.
  if (
    config.jointStatesTopic != undefined &&
    config.jointStatesTopic !== "" &&
    !topics.some((topic) => topic.name === config.jointStatesTopic)
  ) {
    topicOptions.unshift({ label: config.jointStatesTopic, value: config.jointStatesTopic });
  }

  const joints = model?.joints
    ? Object.entries(model.joints).sort(([key1], [key2]) => key1.localeCompare(key2))
    : [];

  const jointFields: SettingsTreeFields = Object.fromEntries(
    filterMap(joints, ([name, joint]) => {
      const min = joint.jointType === "continuous" ? -Math.PI : +joint.limit.lower;
      const max = joint.jointType === "continuous" ? Math.PI : +joint.limit.upper;
      const value =
        config.customJointValues?.[name] ?? clamp(0, +joint.limit.lower, +joint.limit.upper);
      if (min === max) {
        return undefined;
      }

      return [
        name,
        {
          label: name,
          input: "number",
          precision: 2,
          min,
          max,
          step: 0.05,
          value,
        },
      ];
    }),
  );

  const settings: SettingsTreeNodes = {
    general: {
      icon: "Settings",
      fields: {
        assetId: {
          label: "Asset",
          input: "select",
          options: assetOptions,
          value: config.selectedAssetId,
        },
        opacity: {
          label: "Opacity",
          input: "number",
          precision: 2,
          min: 0,
          max: 1,
          step: 0.1,
          value: config.opacity,
        },
        manualControl: {
          label: "Manual Control",
          input: "boolean",
          value: manualControl,
        },
        jointStatesTopic: manualControl
          ? undefined
          : {
              input: "select",
              label: "Topic",
              value: config.jointStatesTopic,
              options: topicOptions,
            },
      },
    },
    customJointValues:
      manualControl && !isEmpty(jointFields)
        ? {
            label: "Joints",
            fields: jointFields,
          }
        : undefined,
  };

  return settings;
}

export function useURDFViewerSettings(
  config: Config,
  saveConfig: SaveConfig<Config>,
  model: undefined | URDFRobot,
): void {
  const { topics } = PanelAPI.useDataSourceInfo();

  const { assets } = useAssets();

  const { robotDescriptionAsset } = useRobotDescriptionAsset();

  const availableTopics = useMemo(
    () => topics.filter((topic) => DATA_TYPES.includes(topic.schemaName)),
    [topics],
  );

  const assetOptions = useMemo(() => {
    const options = filterMap(assets, (asset) =>
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      asset.type === "urdf" ? { value: asset.uuid, label: asset.name } : undefined,
    );
    if (robotDescriptionAsset != undefined) {
      options.unshift({ value: ROBOT_DESCRIPTION_PARAM, label: ROBOT_DESCRIPTION_PARAM });
    }
    return options;
  }, [assets, robotDescriptionAsset]);

  const updatePanelSettingsTree = usePanelSettingsTreeUpdate();

  const actionHandler = useCallback(
    (action: SettingsTreeAction) => {
      if (action.action !== "update") {
        return;
      }

      const { input, path, value } = action.payload;

      if (input === "boolean" && path[1] === "manualControl") {
        saveConfig({
          jointStatesTopic: value === true ? undefined : defaultConfig.jointStatesTopic,
        });
        return;
      }

      if (input === "select" && path[1] === "assetId") {
        saveConfig({ selectedAssetId: value as undefined | string });
        return;
      }

      if (input === "number" && path[0] === "customJointValues") {
        const jointName = path[1];
        if (jointName && value != undefined) {
          saveConfig(
            produce((draft) => {
              draft.customJointValues ??= {};
              draft.customJointValues[jointName] = value;
            }),
          );
        }
        return;
      }

      saveConfig(produce((draft) => set(draft, path.slice(1), value)));
    },
    [saveConfig],
  );

  useEffect(() => {
    updatePanelSettingsTree({
      actionHandler,
      nodes: buildSettingsTree(config, availableTopics, model, assetOptions),
    });
  }, [actionHandler, assetOptions, availableTopics, config, model, updatePanelSettingsTree]);
}
