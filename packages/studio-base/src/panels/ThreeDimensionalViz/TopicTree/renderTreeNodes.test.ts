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
import { getNamespaceNodes } from "./renderTreeNodes";
import { TreeNode } from "./types";

const TOPIC_NAME = "/foo";
const UNAVAILABLE_TOPIC_NAME = "/foo_unavailable";
const AVAILABLE_TOPIC_NAME = "/foo_base_feature_available";
const BASE_AVAILABLE_TOPIC_NAME = "/foo_base_available";
const CHECKED_BY_DEFAULT_TOPIC_NAME = "/foo_checked_by_default";
const CHECKED_BY_CHECKED_KEYS_TOPIC_NAME = "/foo_checked_by_checked_keys";
const INVISIBLE_NAMESPACE = "ns_invisible";

const getIsNamespaceCheckedByDefaultMock = (topicName: string) => {
  return (_topic: string) => {
    if (topicName === UNAVAILABLE_TOPIC_NAME) {
      return false;
    }
    if (topicName === BASE_AVAILABLE_TOPIC_NAME) {
      return true;
    }
    if (topicName === CHECKED_BY_DEFAULT_TOPIC_NAME) {
      return true;
    }
    if (topicName === TOPIC_NAME) {
      return true;
    }
    return false;
  };
};

const getIsTreeNodeVisibleInSceneMock = (topicName: string) => {
  return (_node: TreeNode, namespace?: string) => {
    if (topicName === UNAVAILABLE_TOPIC_NAME) {
      return false;
    }
    if (topicName === BASE_AVAILABLE_TOPIC_NAME) {
      return true;
    }
    if (topicName === CHECKED_BY_DEFAULT_TOPIC_NAME) {
      return true;
    }
    if (topicName === CHECKED_BY_CHECKED_KEYS_TOPIC_NAME) {
      return true;
    }
    if (namespace === INVISIBLE_NAMESPACE) {
      return false;
    }
    if (topicName === TOPIC_NAME) {
      return true;
    }
    return false;
  };
};

const sharedProps = {
  availableNamespacesByTopic: {},
  canEditNamespaceOverrideColor: false,
  checkedKeysSet: new Set(),
  derivedCustomSettingsByKey: {},
  hasFeatureColumn: false,
  showVisible: false,
};
describe("getNamespaceNodes", () => {
  it("returns namespace nodes when topics are not unavailable (for statically available namespaces)", () => {
    const topicName = UNAVAILABLE_TOPIC_NAME;

    expect(
      getNamespaceNodes({
        ...sharedProps,
        availableNamespacesByTopic: { [topicName]: ["ns1", "ns2"] },
        getIsNamespaceCheckedByDefault: getIsNamespaceCheckedByDefaultMock(topicName),
        getIsTreeNodeVisibleInScene: getIsTreeNodeVisibleInSceneMock(topicName),
        node: {
          type: "topic",
          topicName,
          key: `t:/${topicName}`,
          providerAvailable: false,
          available: true,
        },
      } as any),
    ).toEqual([
      {
        available: true,
        checked: false,
        hasNamespaceOverrideColorChanged: false,
        key: "ns:/foo_unavailable:ns1",
        namespace: "ns1",
        overrideColor: undefined,
        visibleInScene: false,
      },
      {
        available: true,
        checked: false,
        hasNamespaceOverrideColorChanged: false,
        key: "ns:/foo_unavailable:ns2",
        namespace: "ns2",
        overrideColor: undefined,
        visibleInScene: false,
      },
    ]);
  });
  it("returns namespace nodes when only base topics are available", () => {
    const topicName = BASE_AVAILABLE_TOPIC_NAME;
    expect(
      getNamespaceNodes({
        availableNamespacesByTopic: { [topicName]: ["ns1", "ns2"] },
        canEditNamespaceOverrideColor: false,
        checkedKeysSet: new Set([`t:${topicName}`]),
        derivedCustomSettingsByKey: {},
        getIsNamespaceCheckedByDefault: getIsNamespaceCheckedByDefaultMock(topicName),
        getIsTreeNodeVisibleInScene: getIsTreeNodeVisibleInSceneMock(topicName),
        node: {
          type: "topic",
          topicName,
          key: `t:${topicName}`,
          providerAvailable: false,
          available: true,
        },
        showVisible: false,
      }),
    ).toEqual([
      {
        available: true,
        checked: true,
        hasNamespaceOverrideColorChanged: false,
        key: "ns:/foo_base_available:ns1",
        namespace: "ns1",
        overrideColor: undefined,
        visibleInScene: true,
      },
      {
        available: true,
        checked: true,
        hasNamespaceOverrideColorChanged: false,
        key: "ns:/foo_base_available:ns2",
        namespace: "ns2",
        overrideColor: undefined,
        visibleInScene: true,
      },
    ]);
  });

  it("returns namespace nodes when base and feature topics are available (only base selected)", () => {
    const topicName = BASE_AVAILABLE_TOPIC_NAME;
    expect(
      getNamespaceNodes({
        ...sharedProps,
        availableNamespacesByTopic: { [topicName]: ["ns1", "ns2"] },
        checkedKeysSet: new Set([`t:${topicName}`]),
        getIsNamespaceCheckedByDefault: getIsNamespaceCheckedByDefaultMock(topicName),
        getIsTreeNodeVisibleInScene: getIsTreeNodeVisibleInSceneMock(topicName),
        node: {
          type: "topic",
          topicName,
          key: `t:${topicName}`,
          providerAvailable: true,
          available: true,
        },
      }),
    ).toEqual([
      {
        available: true,
        checked: true,
        hasNamespaceOverrideColorChanged: false,
        key: "ns:/foo_base_available:ns1",
        namespace: "ns1",
        overrideColor: undefined,
        visibleInScene: true,
      },
      {
        available: true,
        checked: true,
        hasNamespaceOverrideColorChanged: false,
        key: "ns:/foo_base_available:ns2",
        namespace: "ns2",
        overrideColor: undefined,
        visibleInScene: true,
      },
    ]);
  });
  it("does not have duplicates namespace names", () => {
    const topicName = AVAILABLE_TOPIC_NAME;
    const nsNodes = getNamespaceNodes({
      ...sharedProps,
      availableNamespacesByTopic: {
        [topicName]: ["ns1", "ns3"],
      },
      checkedKeysSet: new Set([`t:${topicName}`]),
      getIsNamespaceCheckedByDefault: getIsNamespaceCheckedByDefaultMock(topicName),
      getIsTreeNodeVisibleInScene: getIsTreeNodeVisibleInSceneMock(topicName),
      node: {
        type: "topic",
        topicName,
        key: `t:${topicName}`,
        providerAvailable: true,
        available: true,
      },
    });
    expect(nsNodes.map((node) => node.namespace)).toEqual(["ns1", "ns3"]);
  });

  it("handles namespaces checked by default", () => {
    const topicName = CHECKED_BY_DEFAULT_TOPIC_NAME;
    const nsNodes = getNamespaceNodes({
      ...sharedProps,
      availableNamespacesByTopic: {
        [topicName]: ["ns1", "ns3"],
      },
      checkedKeysSet: new Set([`t:${topicName}`]),
      getIsNamespaceCheckedByDefault: getIsNamespaceCheckedByDefaultMock(topicName),
      getIsTreeNodeVisibleInScene: getIsTreeNodeVisibleInSceneMock(topicName),
      node: {
        type: "topic",
        topicName,
        key: `t:${topicName}`,
        providerAvailable: true,
        available: true,
      },
    });
    expect(nsNodes.map(({ checked, namespace }) => ({ checked, namespace }))).toEqual([
      { checked: true, namespace: "ns1" },
      { checked: true, namespace: "ns3" },
    ]);
  });

  it("handles namespaces checked by checkedKeys", () => {
    const topicName = CHECKED_BY_CHECKED_KEYS_TOPIC_NAME;
    const nsNodes = getNamespaceNodes({
      ...sharedProps,
      availableNamespacesByTopic: {
        [topicName]: ["ns1", "ns3"],
      },
      checkedKeysSet: new Set([`t:${topicName}`, `ns:${topicName}:ns1`]),
      getIsNamespaceCheckedByDefault: getIsNamespaceCheckedByDefaultMock(topicName),
      getIsTreeNodeVisibleInScene: getIsTreeNodeVisibleInSceneMock(topicName),
      node: {
        type: "topic",
        topicName,
        key: `t:${topicName}`,
        providerAvailable: true,
        available: true,
      },
    });

    expect(nsNodes.map(({ checked, namespace }) => ({ checked, namespace }))).toEqual([
      { checked: true, namespace: "ns1" },
      { checked: false, namespace: "ns3" },
    ]);
  });

  it("does not return invisible nodes when showVisible is true", () => {
    const topicName = TOPIC_NAME;
    const nsNodes = getNamespaceNodes({
      ...sharedProps,
      availableNamespacesByTopic: {
        [topicName]: ["ns1", INVISIBLE_NAMESPACE],
      },
      checkedKeysSet: new Set([`t:${topicName}`, `ns:${topicName}:ns1`]),
      getIsNamespaceCheckedByDefault: getIsNamespaceCheckedByDefaultMock(topicName),
      getIsTreeNodeVisibleInScene: getIsTreeNodeVisibleInSceneMock(topicName),
      node: {
        type: "topic",
        topicName,
        key: `t:${topicName}`,
        providerAvailable: true,
        available: true,
      },
      showVisible: true,
    });
    expect(nsNodes.map((node) => node.namespace)).toEqual(["ns1"]);
  });

  it("returns override colors from namespaces and topics", () => {
    const topicName = TOPIC_NAME;
    const nsNodes = getNamespaceNodes({
      ...sharedProps,
      derivedCustomSettingsByKey: {
        [`t:${topicName}`]: {
          isDefaultSettings: false,
          overrideColor: { r: 0.1, g: 0.1, b: 0.1, a: 0.1 },
        },
        [`ns:${topicName}:ns1`]: {
          overrideColor: { r: 0.3, g: 0.3, b: 0.3, a: 0.3 },
        },
        [`ns:${topicName}:ns2`]: {
          overrideColor: undefined,
        },
        [`ns:${topicName}:ns3`]: {
          overrideColor: { r: 0.6, g: 0.6, b: 0.6, a: 0.6 },
        },
      } as any,
      canEditNamespaceOverrideColor: true,
      availableNamespacesByTopic: {
        [topicName]: ["ns1", "ns2", "ns3"],
      },
      getIsNamespaceCheckedByDefault: getIsNamespaceCheckedByDefaultMock(topicName),
      getIsTreeNodeVisibleInScene: getIsTreeNodeVisibleInSceneMock(topicName),
      hasFeatureColumn: true,
      node: {
        type: "topic",
        topicName,
        key: `t:${topicName}`,
        providerAvailable: true,
        available: true,
      },
      showVisible: true,
    } as any);
    expect(nsNodes.map(({ namespace, overrideColor }) => ({ namespace, overrideColor }))).toEqual([
      {
        namespace: "ns1",
        overrideColor: { r: 0.3, g: 0.3, b: 0.3, a: 0.3 },
      },
      {
        namespace: "ns2",
        overrideColor: { r: 0.1, g: 0.1, b: 0.1, a: 0.1 },
      },
      {
        namespace: "ns3",
        overrideColor: { r: 0.6, g: 0.6, b: 0.6, a: 0.6 },
      },
    ]);
  });
});
