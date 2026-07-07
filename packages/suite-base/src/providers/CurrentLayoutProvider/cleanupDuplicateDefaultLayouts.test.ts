// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { cleanupDuplicateDefaultLayouts } from "@lichtblick/suite-base/providers/CurrentLayoutProvider/cleanupDuplicateDefaultLayouts";
import { DEFAULT_LAYOUT } from "@lichtblick/suite-base/providers/CurrentLayoutProvider/constants";
import MockLayoutManager from "@lichtblick/suite-base/services/LayoutManager/MockLayoutManager";
import LayoutBuilder from "@lichtblick/suite-base/testing/builders/LayoutBuilder";
import { BasicBuilder } from "@lichtblick/test-builders";

describe("cleanupDuplicateDefaultLayouts", () => {
  const layoutManager = new MockLayoutManager();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("does nothing when there are no Default layouts", async () => {
    // Given a list without any "Default" layout
    const layouts = [
      LayoutBuilder.layout({ name: BasicBuilder.string() }),
      LayoutBuilder.layout({ name: BasicBuilder.string() }),
    ];

    // When cleaning up
    await cleanupDuplicateDefaultLayouts(layouts, layoutManager);

    // Then nothing is deleted
    expect(layoutManager.deleteLayout).not.toHaveBeenCalled();
  });

  it("does nothing when there is a single default layout", async () => {
    // Given exactly one candidate "Default" layout
    const layouts = [
      LayoutBuilder.layout({
        name: DEFAULT_LAYOUT.name,
        permission: DEFAULT_LAYOUT.permission,
      }),
      LayoutBuilder.layout({ name: BasicBuilder.string() }),
    ];

    // When cleaning up
    await cleanupDuplicateDefaultLayouts(layouts, layoutManager);

    // Then nothing is deleted
    expect(layoutManager.deleteLayout).not.toHaveBeenCalled();
  });

  it("keeps the first default layout and deletes the duplicates", async () => {
    // Given two candidate "Default" layouts
    const first = LayoutBuilder.layout({
      id: LayoutBuilder.layoutId("first"),
      name: DEFAULT_LAYOUT.name,
      permission: DEFAULT_LAYOUT.permission,
    });
    const second = LayoutBuilder.layout({
      id: LayoutBuilder.layoutId("second"),
      name: DEFAULT_LAYOUT.name,
      permission: DEFAULT_LAYOUT.permission,
    });

    // When cleaning up
    await cleanupDuplicateDefaultLayouts([first, second], layoutManager);

    // Then the first one is kept and the rest deleted
    expect(layoutManager.deleteLayout).toHaveBeenCalledTimes(1);
    expect(layoutManager.deleteLayout).toHaveBeenCalledWith({ id: second.id });
  });

  it("ignores default-named layouts that do not have the default permission", async () => {
    // Given one candidate Default layout and one Default-named layout with another permission
    const layoutToKeep = LayoutBuilder.layout({
      id: LayoutBuilder.layoutId("keep"),
      name: DEFAULT_LAYOUT.name,
      permission: DEFAULT_LAYOUT.permission,
    });
    const orgLayout = LayoutBuilder.layout({
      id: LayoutBuilder.layoutId("org"),
      name: DEFAULT_LAYOUT.name,
      permission: "ORG_READ",
    });

    // When cleaning up
    await cleanupDuplicateDefaultLayouts([layoutToKeep, orgLayout], layoutManager);

    // Then nothing is deleted because only one candidate matches the permission filter
    expect(layoutManager.deleteLayout).not.toHaveBeenCalled();
  });

  it("only considers layouts named Default with the default permission", async () => {
    // Given duplicate Default candidates plus an unrelated layout
    const keep = LayoutBuilder.layout({
      id: LayoutBuilder.layoutId("keep"),
      name: DEFAULT_LAYOUT.name,
      permission: DEFAULT_LAYOUT.permission,
    });
    const toDelete = LayoutBuilder.layout({
      id: LayoutBuilder.layoutId("delete"),
      name: DEFAULT_LAYOUT.name,
      permission: DEFAULT_LAYOUT.permission,
    });
    const unrelated = LayoutBuilder.layout({ name: BasicBuilder.string() });

    // When cleaning up
    await cleanupDuplicateDefaultLayouts([keep, toDelete, unrelated], layoutManager);

    // Then only the duplicate Default is deleted, never the unrelated layout
    expect(layoutManager.deleteLayout).toHaveBeenCalledTimes(1);
    expect(layoutManager.deleteLayout).toHaveBeenCalledWith({ id: toDelete.id });
  });
});
