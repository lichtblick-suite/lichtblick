// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as _ from "lodash-es";

import {
  NotificationItem,
  NotificationManager,
  NOTIFICATION_ID_PRIORITIES,
} from "./NotificationManager";

describe("HUDItemManager", () => {
  let manager: NotificationManager;
  let onChange: jest.Mock;

  beforeEach(() => {
    onChange = jest.fn();
    manager = new NotificationManager(onChange);
  });

  it("addHUDItem", () => {
    const item: NotificationItem = {
      id: "test",
      group: "group1",
      getMessage: () => "test message",
      displayType: "empty",
    };
    manager.addNotificationItem(item);
    expect(manager.getNotificationItems()).toContain(item);
    expect(onChange).toHaveBeenCalled();
  });

  it("addHUDItem won't add duplicates", () => {
    const item: NotificationItem = {
      id: "test",
      group: "group1",
      getMessage: () => "test message",
      displayType: "empty",
    };
    manager.addNotificationItem(item);
    expect(manager.getNotificationItems()).toEqual([item]);
    expect(onChange).toHaveBeenCalledTimes(1);
    manager.addNotificationItem(item);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("getNotificationItems will return in priority order", () => {
    const allPriorityIdItems: NotificationItem[] = NOTIFICATION_ID_PRIORITIES.map((id) => ({
      id,
      group: "group1",
      getMessage: () => "test message",
      displayType: "empty",
    }));
    const nonPriorityItem: NotificationItem = {
      id: "test",
      group: "group1",
      getMessage: () => "test message",
      displayType: "empty",
    };
    allPriorityIdItems.push(nonPriorityItem);
    // want to make sure it's not returning in order of adding
    const shuffledItems = _.shuffle(allPriorityIdItems);
    for (const item of shuffledItems) {
      manager.addNotificationItem(item);
    }
    const notificationItems = manager.getNotificationItems();
    const maybeNonPriorityItem = notificationItems.shift();
    expect(maybeNonPriorityItem).toEqual(nonPriorityItem);
    // priority items should be at the end
    expect(notificationItems).toEqual(allPriorityIdItems.slice(0, -1));
  });

  it("removeHUDItem", () => {
    const item: NotificationItem = {
      id: "test",
      group: "group1",
      getMessage: () => "test message",
      displayType: "empty",
    };
    manager.addNotificationItem(item);
    manager.removeNotificationItem(item.id);
    expect(manager.getNotificationItems()).not.toContain(item);
    expect(onChange).toHaveBeenCalled();
  });

  it("removeGroup", () => {
    const group1Item1: NotificationItem = {
      id: "group1test1",
      group: "group1",
      getMessage: () => "test message 1",
      displayType: "empty",
    };
    const group1Item2: NotificationItem = {
      id: "group1test2",
      group: "group1",
      getMessage: () => "test message 2",
      displayType: "empty",
    };
    const group2Item: NotificationItem = {
      id: "testgroup2",
      group: "group2",
      getMessage: () => "test message group 2",
      displayType: "empty",
    };
    manager.addNotificationItem(group1Item1);
    manager.addNotificationItem(group1Item2);
    manager.addNotificationItem(group2Item);
    manager.removeGroup("group1");
    expect(manager.getNotificationItems()).not.toContain(group1Item1);
    expect(manager.getNotificationItems()).not.toContain(group1Item2);
    expect(manager.getNotificationItems()).toContain(group2Item);
  });

  it("displayIfTrue", () => {
    const item: NotificationItem = {
      id: "test",
      group: "group1",
      getMessage: () => "test message",
      displayType: "empty",
    };
    manager.displayIfTrue(true, item);
    expect(manager.getNotificationItems()).toEqual([item]);
    expect(onChange).toHaveBeenCalledTimes(1);

    manager.displayIfTrue(false, item);
    expect(manager.getNotificationItems()).not.toContain(item);
    expect(onChange).toHaveBeenCalledTimes(2);

    manager.displayIfTrue(false, item);
    expect(manager.getNotificationItems()).not.toContain(item);
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("clear", () => {
    const item: NotificationItem = {
      id: "test",
      group: "group1",
      getMessage: () => "test message",
      displayType: "empty",
    };
    manager.addNotificationItem(item);
    manager.clear();
    expect(manager.getNotificationItems()).toHaveLength(0);
    expect(onChange).toHaveBeenCalled();
  });
});
