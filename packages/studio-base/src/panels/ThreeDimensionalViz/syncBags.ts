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

import { TopicSettingsCollection } from "@foxglove/studio-base/panels/ThreeDimensionalViz/SceneBuilder";
import { SECOND_SOURCE_PREFIX } from "@foxglove/studio-base/util/globalConstants";

export const SYNC_OPTIONS = {
  bag1ToBag2: "bag1ToBag2",
  bag2ToBag1: "bag2ToBag1",
  swapBag1AndBag2: "swapBag1AndBag2",
} as const;
type SyncOption = keyof typeof SYNC_OPTIONS;

type BagSyncData = { checkedKeys: string[]; settingsByKey: TopicSettingsCollection };
type Keys = { bag1: string[]; bag2: string[] };

function partitionKeys(keys: string[]): {
  groupKeys: Keys;
  topicKeys: Keys;
  namespaceKeys: Keys;
} {
  const result = {
    groupKeys: { bag1: [], bag2: [] } as Keys,
    topicKeys: { bag1: [], bag2: [] } as Keys,
    namespaceKeys: { bag1: [], bag2: [] } as Keys,
  };
  keys.forEach((key) => {
    if (key.startsWith(`t:${SECOND_SOURCE_PREFIX}`)) {
      result.topicKeys.bag2.push(key);
    } else if (key.startsWith("t:")) {
      result.topicKeys.bag1.push(key);
    } else if (key.startsWith("name_2:")) {
      result.groupKeys.bag2.push(key);
    } else if (key.startsWith("name:")) {
      result.groupKeys.bag1.push(key);
    } else if (key.startsWith(`ns:${SECOND_SOURCE_PREFIX}`)) {
      result.namespaceKeys.bag2.push(key);
    } else if (key.startsWith("ns:")) {
      result.namespaceKeys.bag1.push(key);
    }
  });
  return result;
}

function bag2KeyToBag1Key(bag2Key: string) {
  if (bag2Key.startsWith(`t:${SECOND_SOURCE_PREFIX}`)) {
    return bag2Key.replace(`t:${SECOND_SOURCE_PREFIX}`, "t:");
  }
  if (bag2Key.startsWith("name_2:")) {
    return bag2Key.replace("name_2:", "name:");
  }
  return bag2Key.replace(`ns:${SECOND_SOURCE_PREFIX}`, "ns:");
}
function bag1KeyToBag2Key(bag1Key: string) {
  if (bag1Key.startsWith("t:")) {
    return bag1Key.replace("t:", `t:${SECOND_SOURCE_PREFIX}`);
  }
  if (bag1Key.startsWith("name:")) {
    return bag1Key.replace("name:", "name_2:");
  }
  return bag1Key.replace("ns:", `ns:${SECOND_SOURCE_PREFIX}`);
}

export function syncBags(
  { checkedKeys, settingsByKey }: BagSyncData,
  syncOption: SyncOption,
): BagSyncData {
  const { groupKeys, topicKeys, namespaceKeys } = partitionKeys(checkedKeys);
  const bag1CheckedKeys = [...groupKeys.bag1, ...topicKeys.bag1, ...namespaceKeys.bag1];
  const bag2CheckedKeys = [...groupKeys.bag2, ...topicKeys.bag2, ...namespaceKeys.bag2];
  const settingKeys = Object.keys(settingsByKey);
  const { topicKeys: topicKeys1, namespaceKeys: namespaceKeys1 } = partitionKeys(settingKeys);
  const bag1SettingKeys = [...topicKeys1.bag1, ...namespaceKeys1.bag1];
  const bag2SettingKeys = [...topicKeys1.bag2, ...namespaceKeys1.bag2];

  const result: { checkedKeys: Keys; settingsByKey: TopicSettingsCollection } = {
    checkedKeys: { bag1: [], bag2: [] },
    settingsByKey: {},
  };
  const newSettingsByKey: TopicSettingsCollection = {};

  switch (syncOption) {
    case "bag1ToBag2":
      result.checkedKeys = { bag1: bag1CheckedKeys, bag2: bag1CheckedKeys.map(bag1KeyToBag2Key) };
      bag1SettingKeys.forEach((bag1Key) => (newSettingsByKey[bag1Key] = settingsByKey[bag1Key]!));
      bag1SettingKeys.forEach(
        (bag1Key) => (newSettingsByKey[bag1KeyToBag2Key(bag1Key)] = settingsByKey[bag1Key]!),
      );
      break;
    case "bag2ToBag1":
      result.checkedKeys = { bag1: bag2CheckedKeys.map(bag2KeyToBag1Key), bag2: bag2CheckedKeys };
      bag2SettingKeys.forEach((bag2Key) => (newSettingsByKey[bag2Key] = settingsByKey[bag2Key]!));
      bag2SettingKeys.forEach(
        (bag2Key) => (newSettingsByKey[bag2KeyToBag1Key(bag2Key)] = settingsByKey[bag2Key]!),
      );
      break;
    case "swapBag1AndBag2":
      result.checkedKeys = {
        bag1: bag2CheckedKeys.map(bag2KeyToBag1Key),
        bag2: bag1CheckedKeys.map(bag1KeyToBag2Key),
      };
      bag2SettingKeys.forEach(
        (bag2Key) => (newSettingsByKey[bag2KeyToBag1Key(bag2Key)] = settingsByKey[bag2Key]!),
      );
      bag1SettingKeys.forEach(
        (bag1Key) => (newSettingsByKey[bag1KeyToBag2Key(bag1Key)] = settingsByKey[bag1Key]!),
      );
      break;
    default:
      throw new Error(`Unsupported sync option ${syncOption}`);
  }

  return {
    checkedKeys: [...result.checkedKeys.bag1, ...result.checkedKeys.bag2],
    settingsByKey: newSettingsByKey,
  };
}
