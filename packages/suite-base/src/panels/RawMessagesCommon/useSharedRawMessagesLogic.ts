// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { useCallback, useEffect, useMemo, useState } from "react";

import { parseMessagePath, MessagePath, MessagePathStructureItem } from "@lichtblick/message-path";
import { useDataSourceInfo } from "@lichtblick/suite-base/PanelAPI";
import {
  messagePathStructures,
  traverseStructure,
} from "@lichtblick/suite-base/components/MessagePathSyntax/messagePathsForDatatype";
import { useMessageDataItem } from "@lichtblick/suite-base/components/MessagePathSyntax/useMessageDataItem";
import { usePanelContext } from "@lichtblick/suite-base/components/PanelContext";
import { Topic } from "@lichtblick/suite-base/players/types";

import { PATH_NAME_AGGREGATOR, PREV_MSG_METHOD } from "./constants";
import { NodeExpansion, NodeState } from "./types";
import { dataWithoutWrappingArray, generateDeepKeyPaths, toggleExpansion } from "./utils";

type SharedConfig = {
  topicPath: string;
  diffMethod: "custom" | "previous message";
  diffTopicPath: string;
  diffEnabled: boolean;
  expansion?: NodeExpansion;
};

type SharedConfigActions<T extends SharedConfig> = {
  saveConfig: (config: Partial<T>) => void;
};

type UseSharedRawMessagesLogicProps<T extends SharedConfig> = {
  config: T;
  saveConfig: SharedConfigActions<T>["saveConfig"];
};

export type UseSharedRawMessagesLogicResult = {
  topicRosPath: MessagePath | undefined;
  topic: Topic | undefined;
  rootStructureItem: MessagePathStructureItem | undefined;
  baseItem: ReturnType<typeof useMessageDataItem>[number] | undefined;
  diffItem: ReturnType<typeof useMessageDataItem>[number] | undefined;

  expansion: NodeExpansion | undefined;
  setExpansion: (
    expansion: NodeExpansion | ((old: NodeExpansion | undefined) => NodeExpansion),
  ) => void;
  nodes: Set<string>;
  canExpandAll: boolean;

  onTopicPathChange: (newTopicPath: string) => void;
  onDiffTopicPathChange: (newDiffTopicPath: string) => void;
  onToggleDiff: () => void;
  onToggleExpandAll: () => void;
  onLabelClick: (keypath: (string | number)[]) => void;
};

/**
 * Shared hook that contains all the common logic for both RawMessages and RawMessagesTwo panels.
 * This includes state management, message subscriptions, expansion logic, and common callbacks.
 */
export function useSharedRawMessagesLogic<T extends SharedConfig>({
  config,
  saveConfig,
}: UseSharedRawMessagesLogicProps<T>): UseSharedRawMessagesLogicResult {
  const { topicPath, diffMethod, diffTopicPath, diffEnabled } = config;
  const { topics, datatypes } = useDataSourceInfo();
  const { setMessagePathDropConfig } = usePanelContext();

  useEffect(() => {
    setMessagePathDropConfig({
      getDropStatus(paths) {
        if (paths.length !== 1) {
          return { canDrop: false };
        }
        return { canDrop: true, effect: "replace" };
      },
      handleDrop(paths) {
        const path = paths[0];
        if (path) {
          saveConfig({ topicPath: path.path } as Partial<T>);
          setExpansion("none");
        }
      },
    });
  }, [setMessagePathDropConfig, saveConfig]);

  const topicRosPath: MessagePath | undefined = useMemo(
    () => parseMessagePath(topicPath),
    [topicPath],
  );

  const topic: Topic | undefined = useMemo(
    () => topicRosPath && topics.find(({ name }) => name === topicRosPath.topicName),
    [topicRosPath, topics],
  );

  const structures = useMemo(() => messagePathStructures(datatypes), [datatypes]);

  const rootStructureItem: MessagePathStructureItem | undefined = useMemo(() => {
    if (!topic || !topicRosPath || topic.schemaName == undefined) {
      return;
    }
    return traverseStructure(structures[topic.schemaName], topicRosPath.messagePath).structureItem;
  }, [structures, topic, topicRosPath]);

  const [expansion, setExpansion] = useState(config.expansion);

  const matchedMessages = useMessageDataItem(topic ? topicPath : "", { historySize: 2 });
  const diffMessages = useMessageDataItem(diffEnabled ? diffTopicPath : "");

  const diffTopicObj = diffMessages[0];
  const currTickObj = matchedMessages[matchedMessages.length - 1];
  const prevTickObj = matchedMessages[matchedMessages.length - 2];

  const inTimetickDiffMode = diffEnabled && diffMethod === PREV_MSG_METHOD;
  const baseItem = inTimetickDiffMode ? prevTickObj : currTickObj;
  const diffItem = inTimetickDiffMode ? currTickObj : diffTopicObj;

  const nodes = useMemo(() => {
    if (baseItem) {
      const data = dataWithoutWrappingArray(baseItem.queriedData.map(({ value }) => value));
      return generateDeepKeyPaths(data);
    } else {
      return new Set<string>();
    }
  }, [baseItem]);

  const canExpandAll = useMemo(() => {
    if (expansion === "none") {
      return true;
    }
    if (expansion === "all") {
      return false;
    }
    if (
      typeof expansion === "object" &&
      Object.values(expansion).some((v) => v === NodeState.Collapsed)
    ) {
      return true;
    } else {
      return false;
    }
  }, [expansion]);

  const onTopicPathChange = useCallback(
    (newTopicPath: string) => {
      setExpansion("none");
      saveConfig({ topicPath: newTopicPath } as Partial<T>);
    },
    [saveConfig],
  );

  const onDiffTopicPathChange = useCallback(
    (newDiffTopicPath: string) => {
      saveConfig({ diffTopicPath: newDiffTopicPath } as Partial<T>);
    },
    [saveConfig],
  );

  const onToggleDiff = useCallback(() => {
    saveConfig({ diffEnabled: !diffEnabled } as Partial<T>);
  }, [diffEnabled, saveConfig]);

  const onToggleExpandAll = useCallback(() => {
    setExpansion(canExpandAll ? "all" : "none");
  }, [canExpandAll]);

  const onLabelClick = useCallback(
    (keypath: (string | number)[]) => {
      setExpansion((old) =>
        toggleExpansion(old ?? "none", nodes, keypath.join(PATH_NAME_AGGREGATOR)),
      );
    },
    [nodes],
  );

  useEffect(() => {
    saveConfig({ expansion } as Partial<T>);
  }, [expansion, saveConfig]);

  return {
    topicRosPath,
    topic,
    rootStructureItem,
    baseItem,
    diffItem,
    expansion,
    setExpansion,
    nodes,
    canExpandAll,
    onTopicPathChange,
    onDiffTopicPathChange,
    onToggleDiff,
    onToggleExpandAll,
    onLabelClick,
  };
}
