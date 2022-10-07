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

import { difference, keyBy, uniq, mapValues, xor, isEqual, flatten, omit } from "lodash";
import { useMemo, useCallback, useRef, createContext } from "react";
import { useDebounce } from "use-debounce";

import { filterMap } from "@foxglove/den/collection";
import { useShallowMemo } from "@foxglove/hooks";
import { Color } from "@foxglove/regl-worldview";
import { TOPIC_DISPLAY_MODES } from "@foxglove/studio-base/panels/ThreeDimensionalViz/TopicTree/constants";
import {
  FOXGLOVE_GRID_DATATYPE,
  FOXGLOVE_GRID_TOPIC,
  URDF_TOPIC,
  URDF_DATATYPE,
} from "@foxglove/studio-base/util/globalConstants";

import {
  TreeNode,
  TopicTreeConfig,
  UseTreeInput,
  UseTreeOutput,
  DerivedCustomSettingsByKey,
  OnNamespaceOverrideColorChange,
} from "./types";

const DEFAULT_TOPICS_COUNT_BY_KEY = {};
export function generateNodeKey({
  topicName,
  name,
  namespace,
}: {
  topicName?: string;
  name?: string;
  namespace?: string;
}): string {
  if (namespace) {
    if (topicName) {
      return `ns:${topicName}:${namespace}`;
    }
    throw new Error(
      "Incorrect input for generating the node key. If a namespace is present, then the topicName must be present",
    );
  }
  if (topicName) {
    return `t:${topicName}`;
  }
  if (name) {
    return `name:${name}`;
  }

  throw new Error(
    `Incorrect input for generating the node key. Either topicName or name must be present.`,
  );
}

// Recursive function to generate the tree nodes from config data.
export function generateTreeNode(
  { children = [], topicName, name, description }: TopicTreeConfig,
  {
    availableTopicsNamesSet,
    parentKey,
    datatypesByTopic,
  }: {
    availableTopicsNamesSet: Set<string>;
    datatypesByTopic: {
      [topicName: string]: string;
    };
    parentKey?: string;
  },
): TreeNode {
  const key = generateNodeKey({ name, topicName });
  const providerAvailable = availableTopicsNamesSet.size > 0;

  if (key === `t:${FOXGLOVE_GRID_TOPIC}`) {
    return {
      type: "topic",
      topicName: FOXGLOVE_GRID_TOPIC,
      datatype: FOXGLOVE_GRID_DATATYPE,
      key,
      name,
      available: true,
      providerAvailable: true,
    };
  } else if (key === `t:${URDF_TOPIC}`) {
    return {
      type: "topic",
      topicName: URDF_TOPIC,
      datatype: URDF_DATATYPE,
      key,
      name,
      available: true,
      providerAvailable: true,
    };
  } else if (topicName === "/tf") {
    // Mark transforms as always available, since they can be created and displayed even without any
    // messages or topics present (such as loading from a URDF)
    const datatype = datatypesByTopic[topicName] ?? "tf2_msgs/TFMessage";
    return {
      type: "topic",
      key,
      topicName,
      available: true,
      providerAvailable,
      ...(parentKey ? { parentKey } : undefined),
      ...(name ? { name } : undefined),
      ...(datatype ? { datatype } : undefined),
      ...(description ? { description } : undefined),
    };
  } else if (topicName) {
    const datatype = datatypesByTopic[topicName];
    return {
      type: "topic",
      key,
      topicName,
      available: availableTopicsNamesSet.has(topicName),
      providerAvailable,
      ...(parentKey ? { parentKey } : undefined),
      ...(name ? { name } : undefined),
      ...(datatype ? { datatype } : undefined),
      ...(description ? { description } : undefined),
    };
  }
  if (name) {
    const childrenNodes = children.map((config) =>
      generateTreeNode(config, {
        availableTopicsNamesSet,
        // First level children's parent key is undefined, not `root`.
        parentKey: name === "root" ? undefined : key,
        datatypesByTopic,
      }),
    );
    return {
      key,
      name,
      type: "group",
      // A group node is available when some children nodes are available.
      available: childrenNodes.some((node) => node.available),
      providerAvailable,
      children: childrenNodes,
      parentKey,
    };
  }
  throw new Error(`Incorrect topic tree config. Either topicName or name must be present.`);
}

export function* flattenNode<T extends TreeNode | TopicTreeConfig>(
  node: T,
): Generator<T, void, void> {
  yield node;
  if (node.children) {
    for (const subNode of node.children as T[]) {
      yield* flattenNode(subNode);
    }
  }
}

export default function useTopicTree({
  availableNamespacesByTopic,
  checkedKeys,
  defaultTopicSettings,
  expandedKeys,
  filterText,
  modifiedNamespaceTopics,
  providerTopics,
  saveConfig,
  sceneErrorsByTopicKey,
  topicDisplayMode,
  settingsByKey,
  topicTreeConfig,
  uncategorizedGroupName,
}: UseTreeInput): UseTreeOutput {
  const topicTreeTopics = useMemo(
    () =>
      Array.from(flattenNode(topicTreeConfig))
        .map((node) =>
          node.topicName && (node as { namespace?: unknown }).namespace == undefined
            ? node.topicName
            : undefined,
        )
        .filter(Boolean),
    [topicTreeConfig],
  );

  const rootTreeNode = useMemo((): TreeNode => {
    const topicNames = providerTopics.map((topic) => topic.name);
    const availableTopicsNamesSet = new Set(topicNames);

    // Precompute uncategorized topics to add to the transformedTreeConfig before generating the TreeNodes.
    const uncategorizedTopicNames = difference([...availableTopicsNamesSet], topicTreeTopics);
    const datatypesByTopic = mapValues(keyBy(providerTopics, "name"), (item) => item.schemaName);

    const newChildren = [...(topicTreeConfig.children ?? [])];
    if (uncategorizedTopicNames.length > 0) {
      // Add uncategorized group node to root config.
      newChildren.push({
        name: uncategorizedGroupName,
        children: uncategorizedTopicNames.map((topicName) => ({ topicName })),
      });
    }
    // Generate the rootTreeNode. Don't mutate the original treeConfig, just make a copy with newChildren.
    return generateTreeNode(
      { ...topicTreeConfig, children: newChildren },
      { parentKey: undefined, datatypesByTopic, availableTopicsNamesSet },
    );
  }, [providerTopics, topicTreeConfig, topicTreeTopics, uncategorizedGroupName]);

  const nodesByKey: {
    [key: string]: TreeNode;
  } = useMemo(() => {
    const flattenNodes = Array.from(flattenNode(rootTreeNode));
    return keyBy(flattenNodes, "key");
  }, [rootTreeNode]);

  const selections = useMemo(() => {
    const checkedKeysSet = new Set(checkedKeys);
    // Memoize node selections for extracting topic/namespace selections and checking node's visibility state.
    const isSelectedMemo: { [key: string]: boolean } = {};

    // Check if a node is selected and fill in the isSelectedMemo cache for future access.
    function isSelected(baseKey: string | undefined): boolean {
      // Only topic node or top level group node may not have parentKey, and if we reached this level,
      // the descendants nodes should already been selected. Specifically, if a node key is included in the checkedKeys
      // and it doesn't have any parent node, it's considered to be selected.
      if (!baseKey) {
        return true;
      }

      const node = nodesByKey[baseKey];
      const result = (isSelectedMemo[baseKey] ??=
        checkedKeysSet.has(baseKey) &&
        (node ? isSelected(node.parentKey) : checkedKeysSet.has(`name:${uncategorizedGroupName}`)));
      return result;
    }

    const selectedTopicNamesSet = new Set(
      filterMap(checkedKeys, (key) => {
        if (!key.startsWith("t:") || !isSelected(key)) {
          return;
        }
        return key.substr("t:".length);
      }),
    );

    // Add namespace selections if a topic has any namespaces modified. Any topics that don't have
    // the namespaces set in selectedNamespacesByTopic will have the namespaces turned on by default.
    const selectedNamespacesByTopic: {
      [topicName: string]: string[];
    } = modifiedNamespaceTopics.reduce((memo, topicName) => ({ ...memo, [topicName]: [] }), {});

    // Go through the checked namespace keys, split the key to topicName + namespace, and
    // collect the namespaces if the topic is selected.
    checkedKeys.forEach((key) => {
      if (!key.startsWith("ns:")) {
        return;
      }
      const [_, topicName, namespace] = key.split(":");
      if (!topicName || !namespace) {
        throw new Error(`Incorrect checkedNode in panelConfig: ${key}`);
      }
      if (selectedTopicNamesSet.has(topicName)) {
        if (!selectedNamespacesByTopic[topicName]) {
          selectedNamespacesByTopic[topicName] = [];
        }
        selectedNamespacesByTopic[topicName]?.push(namespace);
      }
    });

    const selectedTopicNames = Array.from(selectedTopicNamesSet);

    // If any selectedNamespaces is empty, fill in all available namespaces as default if
    // the topic for the namespace is not modified.
    difference(selectedTopicNames, modifiedNamespaceTopics).forEach((topicName) => {
      const namespaces = availableNamespacesByTopic[topicName];
      if (namespaces) {
        selectedNamespacesByTopic[topicName] ??= namespaces;
      }
    });

    // Returns whether a node/namespace is rendered in the 3d scene. Keep it inside useMemo since it needs to access the same isSelectedMemo.
    // A node is visible if it's available, itself and all ancestor nodes are selected.
    function getIsTreeNodeVisibleInScene(node: TreeNode | undefined, namespace?: string): boolean {
      if (!node) {
        return false;
      }
      const baseKey = node.key;
      if (namespace && node.type === "topic") {
        const prefixedTopicName = node.topicName;
        if (!prefixedTopicName) {
          return false;
        }
        if (!(selectedNamespacesByTopic[prefixedTopicName] || []).includes(namespace)) {
          return false;
        }
        // A namespace node is visible if the parent topic node is visible.
        return getIsTreeNodeVisibleInScene(node);
      }
      return node.available && isSelected(baseKey);
    }
    return {
      selectedTopicNames,
      selectedNamespacesByTopic,
      getIsTreeNodeVisibleInScene,
    };
  }, [
    availableNamespacesByTopic,
    checkedKeys,
    modifiedNamespaceTopics,
    nodesByKey,
    uncategorizedGroupName,
  ]);

  const { selectedTopicNames, selectedNamespacesByTopic, getIsTreeNodeVisibleInScene } = selections;

  const visibleTopicsCountByKey = useMemo(() => {
    // No need to update if topics are unavailable.
    if (providerTopics.length === 0) {
      return DEFAULT_TOPICS_COUNT_BY_KEY;
    }
    const ret: Record<string, number> = {};

    selectedTopicNames.forEach((topicName) => {
      const topicKey = generateNodeKey({ topicName });
      const node = nodesByKey[topicKey];
      const isTopicNodeVisible = getIsTreeNodeVisibleInScene(node);
      if (!isTopicNodeVisible) {
        return;
      }
      // The topic node is visible, now traverse up the tree and update all parent's visibleTopicsCount.
      const parentKey = nodesByKey[topicKey]?.parentKey;
      let parentNode = parentKey ? nodesByKey[parentKey] : undefined;
      while (parentNode) {
        ret[parentNode.key] = (ret[parentNode.key] ?? 0) + 1;
        parentNode = parentNode.parentKey ? nodesByKey[parentNode.parentKey] : undefined;
      }
    });
    return ret;
  }, [getIsTreeNodeVisibleInScene, nodesByKey, providerTopics.length, selectedTopicNames]);

  // Memoize topic names to prevent subscription update when expanding/collapsing nodes.
  const memoizedSelectedTopicNames = useShallowMemo(selectedTopicNames);

  const derivedCustomSettingsByKey = useMemo((): DerivedCustomSettingsByKey => {
    const result: DerivedCustomSettingsByKey = {};
    for (const [topicKeyOrNamespaceKey, settings] of Object.entries(settingsByKey)) {
      let key;
      if (topicKeyOrNamespaceKey.startsWith("ns:")) {
        // Settings for namespace. Currently only handle overrideColor and there are no defaultTopicSettings for namespaces.
        key = topicKeyOrNamespaceKey;
        if (!result[key]) {
          result[key] = {};
        }
      } else if (topicKeyOrNamespaceKey.startsWith("t:")) {
        // Settings for topic.
        const topicName = topicKeyOrNamespaceKey.substr("t:".length);
        const baseTopicName = topicName;
        key = generateNodeKey({ topicName: baseTopicName });
        // If any topic has default settings, compare settings with default settings to determine if settings has changed.
        const isDefaultSettings = defaultTopicSettings[topicName]
          ? isEqual(settings, defaultTopicSettings[topicName])
          : false;

        result[key] = !result[key]
          ? { isDefaultSettings } // Both base and feature have to be default settings for `isDefaultSettings` to be true.
          : {
              ...result[key],
              isDefaultSettings: isDefaultSettings && result[key]?.isDefaultSettings === true,
            };
      }
      if (!key) {
        console.error(`Key ${topicKeyOrNamespaceKey} in settingsByKey is not a valid key.`);
        continue;
      }

      if (settings.overrideColor != undefined) {
        if (!result[key]!.overrideColor) {
          result[key]!.overrideColor = undefined;
        }
        result[key]!.overrideColor = settings.overrideColor as Color | undefined;
      }
    }
    return result;
  }, [defaultTopicSettings, settingsByKey]);

  const onNamespaceOverrideColorChange: OnNamespaceOverrideColorChange = useCallback(
    (newColor: Color | undefined, prefixedNamespaceKey: string) => {
      const newSettingsByKey = newColor
        ? { ...settingsByKey, [prefixedNamespaceKey]: { overrideColor: newColor } }
        : omit(settingsByKey, prefixedNamespaceKey);
      saveConfig({ settingsByKey: newSettingsByKey });
    },
    [saveConfig, settingsByKey],
  );

  const checkedNamespacesByTopicName = useMemo(() => {
    const checkedNamespaces = filterMap(checkedKeys, (item) => {
      if (item.startsWith("ns:")) {
        const [_, topicName, namespace] = item.split(":");
        return { topicName, namespace };
      }
      return undefined;
    });
    return keyBy(checkedNamespaces, "topicName");
  }, [checkedKeys]);

  // A namespace is checked by default if none of the namespaces are in the checkedKeys and the selection is not modified.
  const getIsNamespaceCheckedByDefault = useCallback(
    (topicName: string) =>
      !modifiedNamespaceTopics.includes(topicName) && !checkedNamespacesByTopicName[topicName],
    [checkedNamespacesByTopicName, modifiedNamespaceTopics],
  );

  const toggleNamespaceChecked = useCallback(
    ({ topicName, namespace }: { topicName: string; namespace: string }) => {
      const prefixedNamespaceKey = generateNodeKey({ topicName, namespace });

      const isNamespaceCheckedByDefault = getIsNamespaceCheckedByDefault(topicName);

      let newCheckedKeys;
      if (isNamespaceCheckedByDefault) {
        // Add all other namespaces under the topic to the checked keys.
        const allNsKeys = (availableNamespacesByTopic[topicName] ?? []).map((ns) =>
          generateNodeKey({ topicName, namespace: ns }),
        );
        const otherNamespaceKeys = difference(allNsKeys, [prefixedNamespaceKey]);
        newCheckedKeys = [...checkedKeys, ...otherNamespaceKeys];
      } else {
        newCheckedKeys = xor(checkedKeys, [prefixedNamespaceKey]);
      }

      saveConfig({
        checkedKeys: newCheckedKeys,
        modifiedNamespaceTopics: uniq([...modifiedNamespaceTopics, topicName]),
      });
    },
    [
      availableNamespacesByTopic,
      checkedKeys,
      getIsNamespaceCheckedByDefault,
      modifiedNamespaceTopics,
      saveConfig,
    ],
  );

  const toggleNodeChecked = useCallback(
    (nodeKey: string) => {
      saveConfig({ checkedKeys: xor(checkedKeys, [nodeKey]) });
    },
    [checkedKeys, saveConfig],
  );

  const toggleCheckAllDescendants = useCallback(
    (nodeKey: string) => {
      const node = nodesByKey[nodeKey];
      if (!node) {
        return;
      }
      const keyWithPrefix = nodeKey;
      const isNowChecked = !checkedKeys.includes(keyWithPrefix);
      const nodeAndChildren = Array.from(flattenNode(node));
      const nodeAndChildrenKeys = nodeAndChildren.map((item) => item.key);
      const topicNames = filterMap(nodeAndChildren, (item) =>
        item.type === "topic" ? item.topicName : undefined,
      );

      const namespaceChildrenKeys = flatten(
        topicNames.map((topicName) =>
          (availableNamespacesByTopic[topicName] ?? []).map((namespace) =>
            generateNodeKey({ topicName, namespace }),
          ),
        ),
      );

      let newModififiedNamespaceTopics = [...modifiedNamespaceTopics];
      topicNames.forEach((topicName) => {
        if (availableNamespacesByTopic[topicName]) {
          newModififiedNamespaceTopics.push(topicName);
        }
      });
      newModififiedNamespaceTopics = isEqual(newModififiedNamespaceTopics, modifiedNamespaceTopics)
        ? modifiedNamespaceTopics
        : uniq(newModififiedNamespaceTopics);

      const nodeKeysToToggle = [...nodeAndChildrenKeys, ...namespaceChildrenKeys];
      // Toggle all children nodes' checked state to be the same as the new checked state for the node.
      saveConfig({
        modifiedNamespaceTopics: newModififiedNamespaceTopics,
        checkedKeys: isNowChecked
          ? uniq([...checkedKeys, ...nodeKeysToToggle])
          : difference(checkedKeys, nodeKeysToToggle),
      });
    },
    [availableNamespacesByTopic, checkedKeys, modifiedNamespaceTopics, nodesByKey, saveConfig],
  );

  const toggleCheckAllAncestors = useCallback(
    (nodeKey: string, namespaceParentTopicName?: string) => {
      const node = nodesByKey[nodeKey];
      let keyWithPrefix = nodeKey;
      const prefixedTopicName = namespaceParentTopicName;

      let newModififiedNamespaceTopics = modifiedNamespaceTopics;
      if (namespaceParentTopicName && prefixedTopicName) {
        if (!modifiedNamespaceTopics.includes(prefixedTopicName)) {
          newModififiedNamespaceTopics = [...modifiedNamespaceTopics, prefixedTopicName];
        }
        const namespace = nodeKey.split(":").pop();
        keyWithPrefix = generateNodeKey({
          topicName: namespaceParentTopicName,
          namespace,
        });
      }

      let prevChecked = checkedKeys.includes(keyWithPrefix);
      let newCheckedKeys = [...checkedKeys];
      if (!prevChecked && namespaceParentTopicName) {
        prevChecked = getIsNamespaceCheckedByDefault(namespaceParentTopicName);
        if (prevChecked && prefixedTopicName) {
          // Add all namespaces under the topic if it's checked by default.
          const allNsKeys = (availableNamespacesByTopic[prefixedTopicName] ?? []).map((ns) =>
            generateNodeKey({
              topicName: namespaceParentTopicName,
              namespace: ns,
            }),
          );
          newCheckedKeys = [...checkedKeys, ...allNsKeys];
        }
      }
      const isNowChecked = !prevChecked;

      const nodeAndAncestorKeys: string[] = [keyWithPrefix];
      let parentKey = namespaceParentTopicName
        ? generateNodeKey({ topicName: namespaceParentTopicName })
        : node?.parentKey;

      while (parentKey) {
        nodeAndAncestorKeys.push(parentKey);
        parentKey = nodesByKey[parentKey]?.parentKey;
      }
      // Toggle all ancestor nodes' checked state to be the same as the new checked state for the node.
      saveConfig({
        modifiedNamespaceTopics: newModififiedNamespaceTopics,
        checkedKeys: isNowChecked
          ? uniq([...newCheckedKeys, ...nodeAndAncestorKeys])
          : difference(newCheckedKeys, nodeAndAncestorKeys),
      });
    },
    [
      availableNamespacesByTopic,
      checkedKeys,
      getIsNamespaceCheckedByDefault,
      modifiedNamespaceTopics,
      nodesByKey,
      saveConfig,
    ],
  );

  const filterTextRef = useRef(filterText);
  filterTextRef.current = filterText;
  const toggleNodeExpanded = useCallback(
    (nodeKey: string) => {
      // Don't allow any toggling expansion when filtering because we automatically expand all nodes.
      if (filterTextRef.current.length === 0) {
        saveConfig({ expandedKeys: xor(expandedKeys, [nodeKey]) });
      }
    },
    [expandedKeys, saveConfig],
  );

  const sceneErrorsByKey = useMemo(() => {
    const result: Record<string, string[]> = {};

    function collectGroupErrors(groupKey: string | undefined, errors: string[]) {
      if (!groupKey) {
        return;
      }
      let nodeKey: string | undefined = groupKey;
      while (nodeKey && nodesByKey[nodeKey]) {
        if (!result[nodeKey]) {
          result[nodeKey] = [];
        }
        result[nodeKey]!.push(...errors);
        nodeKey = nodesByKey[nodeKey]?.parentKey;
      }
    }

    for (const [topicKey, errors] of Object.entries(sceneErrorsByTopicKey)) {
      const baseKey = topicKey;
      if (!result[baseKey]) {
        result[baseKey] = [];
      }
      const errorsWithTopicName = errors.map((err) => `${topicKey.substr("t:".length)}: ${err}`);
      result[baseKey]!.push(...errors);
      const topicNode = nodesByKey[baseKey];
      collectGroupErrors(topicNode?.parentKey, errorsWithTopicName);
    }
    return result;
  }, [nodesByKey, sceneErrorsByTopicKey]);

  const [debouncedFilterText] = useDebounce(filterText, 150);
  const { getIsTreeNodeVisibleInTree } = useMemo(() => {
    const showVisible = topicDisplayMode === TOPIC_DISPLAY_MODES.SHOW_SELECTED.value;
    const showAvailable = topicDisplayMode === TOPIC_DISPLAY_MODES.SHOW_AVAILABLE.value;
    const providerAvailable = providerTopics.length > 0;

    let hasCalculatedVisibility = false;
    // This stores whether the row has been marked as visible, so that we don't do extra work.
    const isVisibleByKey: {
      [key: string]: boolean;
    } = {};

    const searchText = debouncedFilterText.toLowerCase().trim();
    function getIfTextMatches(node: TreeNode): boolean {
      // Never match the root node.
      if (node.name === "root") {
        return false;
      } else if (node.type === "group") {
        // Group node
        return node.name.toLowerCase().includes(searchText);
      }
      // Topic node, without namespace
      return (
        node.topicName.toLowerCase().includes(searchText) ||
        node.name?.toLowerCase().includes(searchText) === true
      );
    }

    // Calculates whether a node is visible. This is a recursive function intended to be run on the root node.
    // eslint-disable-next-line @foxglove/no-boolean-parameters
    function calculateIsVisible(node: TreeNode, isAncestorVisible: boolean): boolean {
      // When the user is viewing available/visible nodes, we can skip setting the visibility for the children of
      // unavailable/invisible nodes since they are not going to be rendered.
      if (providerAvailable && node.name !== "root") {
        const unavailable = !node.available;
        const invisibleInScene = !getIsTreeNodeVisibleInScene(node);

        if ((showAvailable && unavailable) || (showVisible && invisibleInScene)) {
          isVisibleByKey[node.key] = false;
          return false;
        }
      }
      // Whether the ancestor is visible, or the current node matches the search text.
      const isAncestorOrCurrentVisible = isAncestorVisible || getIfTextMatches(node);
      let isChildVisible = false;

      if (node.type === "topic") {
        // Topic node: check if any namespace matches.
        const namespaces = availableNamespacesByTopic[node.topicName] ?? [];

        for (const namespace of namespaces) {
          const thisNamespacesMatches = namespace.toLowerCase().includes(searchText);
          isVisibleByKey[generateNodeKey({ topicName: node.topicName, namespace })] =
            isAncestorOrCurrentVisible || thisNamespacesMatches;
          isChildVisible = thisNamespacesMatches || isChildVisible;
        }
      } else {
        // Group node: recurse and check if any children are visible.
        for (const child of node.children) {
          isChildVisible = calculateIsVisible(child, isAncestorOrCurrentVisible) || isChildVisible;
        }
      }
      const isVisible = isAncestorOrCurrentVisible || isChildVisible;
      isVisibleByKey[node.key] = isVisible;
      return isVisible;
    }

    function getIsTreeNodeVisible(key: string): boolean {
      if (!searchText) {
        return true;
      }

      // Calculate the row visibility for all rows if we don't already have it stored.
      if (!hasCalculatedVisibility) {
        calculateIsVisible(rootTreeNode, false);
        hasCalculatedVisibility = true;
      }

      return isVisibleByKey[key] ?? false;
    }

    return { getIsTreeNodeVisibleInTree: getIsTreeNodeVisible };
  }, [
    topicDisplayMode,
    providerTopics.length,
    debouncedFilterText,
    getIsTreeNodeVisibleInScene,
    availableNamespacesByTopic,
    rootTreeNode,
  ]);

  const { allKeys, shouldExpandAllKeys } = useMemo(() => {
    return {
      allKeys: Object.keys(nodesByKey),
      shouldExpandAllKeys: !!debouncedFilterText,
    };
  }, [debouncedFilterText, nodesByKey]);

  return {
    allKeys,
    derivedCustomSettingsByKey,
    getIsNamespaceCheckedByDefault,
    getIsTreeNodeVisibleInScene,
    getIsTreeNodeVisibleInTree,
    nodesByKey, // For testing.
    onNamespaceOverrideColorChange,
    rootTreeNode,
    sceneErrorsByKey,
    selectedNamespacesByTopic,
    selectedTopicNames: memoizedSelectedTopicNames,
    shouldExpandAllKeys,
    toggleCheckAllAncestors,
    toggleCheckAllDescendants,
    toggleNamespaceChecked,
    toggleNodeChecked,
    toggleNodeExpanded,
    visibleTopicsCountByKey,
  };
}

export const TopicTreeContext = createContext<UseTreeOutput | undefined>(undefined);
TopicTreeContext.displayName = "TopicTreeContext";
