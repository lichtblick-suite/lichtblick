// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as _ from "lodash-es";

import { HUDItem, HUDItemManager, HUD_ID_PRIORITIES } from "./HUDItemManager";

describe("HUDItemManager", () => {
  let manager: HUDItemManager;
  let onChange: jest.Mock;

  beforeEach(() => {
    onChange = jest.fn();
    manager = new HUDItemManager(onChange);
  });

  it("addHUDItem", () => {
    const item: HUDItem = {
      id: "test",
      group: "group1",
      getMessage: () => "test message",
      displayType: "empty",
    };
    manager.addHUDItem(item);
    expect(manager.getHUDItems()).toContain(item);
    expect(onChange).toHaveBeenCalled();
  });

  it("addHUDItem won't add duplicates", () => {
    const item: HUDItem = {
      id: "test",
      group: "group1",
      getMessage: () => "test message",
      displayType: "empty",
    };
    manager.addHUDItem(item);
    expect(manager.getHUDItems()).toEqual([item]);
    expect(onChange).toHaveBeenCalledTimes(1);
    manager.addHUDItem(item);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("getHUDItems will return in priority order", () => {
    const allPriorityIdItems: HUDItem[] = HUD_ID_PRIORITIES.map((id) => ({
      id,
      group: "group1",
      getMessage: () => "test message",
      displayType: "empty",
    }));
    const nonPriorityItem: HUDItem = {
      id: "test",
      group: "group1",
      getMessage: () => "test message",
      displayType: "empty",
    };
    allPriorityIdItems.push(nonPriorityItem);
    // want to make sure it's not returning in order of adding
    const shuffledItems = _.shuffle(allPriorityIdItems);
    for (const item of shuffledItems) {
      manager.addHUDItem(item);
    }
    const hudItems = manager.getHUDItems();
    const maybeNonPriorityItem = hudItems.shift();
    expect(maybeNonPriorityItem).toEqual(nonPriorityItem);
    // priority items should be at the end
    expect(hudItems).toEqual(allPriorityIdItems.slice(0, -1));
  });

  it("removeHUDItem", () => {
    const item: HUDItem = {
      id: "test",
      group: "group1",
      getMessage: () => "test message",
      displayType: "empty",
    };
    manager.addHUDItem(item);
    manager.removeHUDItem(item.id);
    expect(manager.getHUDItems()).not.toContain(item);
    expect(onChange).toHaveBeenCalled();
  });

  it("removeGroup", () => {
    const group1Item1: HUDItem = {
      id: "group1test1",
      group: "group1",
      getMessage: () => "test message 1",
      displayType: "empty",
    };
    const group1Item2: HUDItem = {
      id: "group1test2",
      group: "group1",
      getMessage: () => "test message 2",
      displayType: "empty",
    };
    const group2Item: HUDItem = {
      id: "testgroup2",
      group: "group2",
      getMessage: () => "test message group 2",
      displayType: "empty",
    };
    manager.addHUDItem(group1Item1);
    manager.addHUDItem(group1Item2);
    manager.addHUDItem(group2Item);
    manager.removeGroup("group1");
    expect(manager.getHUDItems()).not.toContain(group1Item1);
    expect(manager.getHUDItems()).not.toContain(group1Item2);
    expect(manager.getHUDItems()).toContain(group2Item);
  });

  it("displayIfTrue", () => {
    const item: HUDItem = {
      id: "test",
      group: "group1",
      getMessage: () => "test message",
      displayType: "empty",
    };
    manager.displayIfTrue(true, item);
    expect(manager.getHUDItems()).toEqual([item]);
    expect(onChange).toHaveBeenCalledTimes(1);

    manager.displayIfTrue(false, item);
    expect(manager.getHUDItems()).not.toContain(item);
    expect(onChange).toHaveBeenCalledTimes(2);

    manager.displayIfTrue(false, item);
    expect(manager.getHUDItems()).not.toContain(item);
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("clear", () => {
    const item: HUDItem = {
      id: "test",
      group: "group1",
      getMessage: () => "test message",
      displayType: "empty",
    };
    manager.addHUDItem(item);
    manager.clear();
    expect(manager.getHUDItems()).toHaveLength(0);
    expect(onChange).toHaveBeenCalled();
  });
});
