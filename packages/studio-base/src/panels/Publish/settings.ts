// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { produce } from "immer";
import { isEqual, set } from "lodash";
import { useCallback, useEffect, useMemo } from "react";

import { Immutable, SettingsTreeAction, SettingsTreeNodes } from "@foxglove/studio";
import buildSampleMessage from "@foxglove/studio-base/panels/Publish/buildSampleMessage";
import { Topic } from "@foxglove/studio-base/players/types";
import { usePanelSettingsTreeUpdate } from "@foxglove/studio-base/providers/PanelStateContextProvider";
import { RosDatatypes } from "@foxglove/studio-base/types/RosDatatypes";
import { SaveConfig } from "@foxglove/studio-base/types/panels";

import { PublishConfig } from "./types";

export const defaultConfig: PublishConfig = {
  buttonText: "Publish",
  buttonTooltip: "",
  advancedView: true,
  value: "{}",
};

function datatypeError(schemaNames: string[], datatype?: string) {
  if (!datatype) {
    return "Message schema cannot be empty";
  }
  if (!schemaNames.includes(datatype)) {
    return "Schema name not found";
  }
  return undefined;
}

function topicError(topicName?: string) {
  if (!topicName) {
    return "Topic cannot be empty";
  }
  return undefined;
}

const buildSettingsTree = (
  config: PublishConfig,
  schemaNames: string[],
  topics: readonly Topic[],
): SettingsTreeNodes => ({
  general: {
    fields: {
      topicName: {
        label: "Topic",
        input: "autocomplete",
        error: topicError(config.topicName),
        value: config.topicName ?? "",
        items: topics.map((t) => t.name),
      },
      datatype: {
        label: "Message schema",
        input: "autocomplete",
        error: datatypeError(schemaNames, config.datatype),
        items: schemaNames,
        value: config.datatype ?? "",
      },
      advancedView: {
        label: "Editing mode",
        input: "boolean",
        value: config.advancedView,
      },
    },
  },
  button: {
    label: "Button",
    fields: {
      buttonText: { label: "Title", input: "string", value: config.buttonText },
      buttonTooltip: { label: "Tooltip", input: "string", value: config.buttonTooltip },
      buttonColor: { label: "Color", input: "rgb", value: config.buttonColor },
    },
  },
});

const getSampleMessage = (
  datatypes: Immutable<RosDatatypes>,
  datatype?: string,
): string | undefined => {
  if (datatype == undefined) {
    return undefined;
  }
  const sampleMessage = buildSampleMessage(datatypes, datatype);
  return sampleMessage != undefined ? JSON.stringify(sampleMessage, undefined, 2) : "{}";
};

export function usePublishPanelSettings(
  config: PublishConfig,
  saveConfig: SaveConfig<PublishConfig>,
  topics: readonly Topic[],
  datatypes: Immutable<RosDatatypes>,
): void {
  const updatePanelSettingsTree = usePanelSettingsTreeUpdate();
  const schemaNames = useMemo(() => Array.from(datatypes.keys()).sort(), [datatypes]);

  const actionHandler = useCallback(
    (action: SettingsTreeAction) => {
      if (action.action !== "update") {
        return;
      }
      const { path, value, input } = action.payload;

      saveConfig(
        produce<PublishConfig>((draft) => {
          if (input === "autocomplete") {
            if (isEqual(path, ["general", "topicName"])) {
              const topicSchemaName = topics.find((t) => t.name === value)?.schemaName;
              const sampleMessage = getSampleMessage(datatypes, topicSchemaName);

              draft.topicName = value;

              if (topicSchemaName) {
                draft.datatype = topicSchemaName;
              }
              if (sampleMessage) {
                draft.value = sampleMessage;
              }
            } else if (isEqual(path, ["general", "datatype"])) {
              const sampleMessage = getSampleMessage(datatypes, value);

              draft.datatype = value;

              if (sampleMessage) {
                draft.value = sampleMessage;
              }
            }
          } else {
            set(draft, path.slice(1), value);
          }
        }),
      );
    },
    [datatypes, saveConfig, topics],
  );

  useEffect(() => {
    updatePanelSettingsTree({
      actionHandler,
      nodes: buildSettingsTree(config, schemaNames, topics),
    });
  }, [actionHandler, config, schemaNames, topics, updatePanelSettingsTree]);
}
