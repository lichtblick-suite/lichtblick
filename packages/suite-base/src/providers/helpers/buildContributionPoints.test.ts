// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { TopicAliasFunction, ExtensionPanelRegistration, PanelSettings } from "@lichtblick/suite";
import { MessageConverter } from "@lichtblick/suite-base/context/ExtensionCatalogContext";
import ExtensionBuilder from "@lichtblick/suite-base/testing/builders/ExtensionBuilder";
import { BasicBuilder } from "@lichtblick/test-builders";

import { buildContributionPoints } from "./buildContributionPoints";

describe("buildContributionPoints", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should initialize contribution objects", () => {
    const consoleErrorMock = jest.spyOn(console, "error").mockImplementation(() => {});
    const extensionInfo = ExtensionBuilder.extensionInfo();

    const result = buildContributionPoints(extensionInfo, "");

    expect(result).toHaveProperty("panels", {});
    expect(result).toHaveProperty("messageConverters", []);
    expect(result).toHaveProperty("topicAliasFunctions", []);
    expect(result).toHaveProperty("panelSettings", {});
    consoleErrorMock.mockRestore();
  });

  it("should register a panel", () => {
    const extensionInfo = ExtensionBuilder.extensionInfo();
    const panelName = BasicBuilder.string();
    const panelId = `${extensionInfo.qualifiedName}.${panelName}`;
    const registration: ExtensionPanelRegistration = {
      name: panelName,
      initPanel: jest.fn(),
    };

    (globalThis as any).panel = registration;
    const extensionSource = `
      module.exports = {
        activate: (ctx) => {
          ctx.registerPanel(globalThis.panel);
        }
      };
    `;

    const result = buildContributionPoints(extensionInfo, extensionSource);

    expect(result.panels[panelId]).toBeDefined();
    expect(result.panels[panelId]).toEqual(
      expect.objectContaining({
        extensionId: extensionInfo.id,
        extensionName: extensionInfo.qualifiedName,
        extensionNamespace: extensionInfo.namespace,
        registration: expect.objectContaining({
          name: panelName,
          initPanel: expect.any(Function),
        } as ExtensionPanelRegistration),
      }),
    );
    delete (globalThis as any).panel;
  });

  it("should warn when trying to register a duplicate panel", () => {
    const logWarnMock = jest.spyOn(console, "warn").mockImplementation(() => {});
    const extensionInfo = ExtensionBuilder.extensionInfo();
    const panelName = BasicBuilder.string();
    const panelId = `${extensionInfo.qualifiedName}.${panelName}`;
    const registration: ExtensionPanelRegistration = {
      name: panelName,
      initPanel: jest.fn(),
    };

    (globalThis as any).panel = registration;
    const extensionSource = `
      module.exports = {
        activate: (ctx) => {
          ctx.registerPanel(globalThis.panel);
          ctx.registerPanel(globalThis.panel);
        }
      };
    `;

    const result = buildContributionPoints(extensionInfo, extensionSource);

    expect(result.panels[panelId]).toBeDefined();
    expect(logWarnMock).toHaveBeenCalledWith(
      expect.stringContaining(`Panel ${panelId} is already registered`),
    );
    delete (globalThis as any).panel;
    logWarnMock.mockRestore();
  });

  it("should register a message converter", () => {
    const extensionInfo = ExtensionBuilder.extensionInfo();
    const messageConverter: MessageConverter = {
      fromSchemaName: BasicBuilder.string(),
      toSchemaName: BasicBuilder.string(),
      panelSettings: {},
      extensionId: extensionInfo.id,
      converter: jest.fn(),
    };

    (globalThis as any).messageConverter = messageConverter;
    const extensionSource = `
      module.exports = {
        activate: (ctx) => {
          ctx.registerMessageConverter(globalThis.messageConverter);
        }
      };
    `;

    const result = buildContributionPoints(extensionInfo, extensionSource);

    expect(result.messageConverters).toHaveLength(1);
    expect(result.messageConverters.length).toBe(1);
    expect(result.messageConverters[0]).toEqual({
      ...messageConverter,
      extensionNamespace: extensionInfo.namespace,
      extensionId: extensionInfo.id,
    });
    delete (globalThis as any).messageConverter;
  });

  it("should register a message converter with panel settings", () => {
    const extensionInfo = ExtensionBuilder.extensionInfo();
    const panelSettingsA: PanelSettings<unknown> = {
      defaultConfig: BasicBuilder.genericDictionary(String),
      handler: jest.fn(),
      settings: jest.fn(),
    };
    const panelSettingsB: PanelSettings<unknown> = {
      defaultConfig: BasicBuilder.genericDictionary(String),
      handler: jest.fn(),
      settings: jest.fn(),
    };
    const messageConverter: MessageConverter = {
      fromSchemaName: BasicBuilder.string(),
      toSchemaName: BasicBuilder.string(),
      panelSettings: {
        panelSettingsA,
        panelSettingsB,
      },
      converter: jest.fn(),
    };

    (globalThis as any).messageConverter = messageConverter;
    const extensionSource = `
      module.exports = {
        activate: (ctx) => {
          ctx.registerMessageConverter(globalThis.messageConverter);
        }
      };
    `;

    const result = buildContributionPoints(extensionInfo, extensionSource);

    expect(result.panelSettings).toBeDefined();
    expect(Object.keys(result.panelSettings)).toHaveLength(2);
    expect(result.messageConverters).toHaveLength(1);
    expect(result.messageConverters[0]?.extensionId).toEqual(extensionInfo.id);
    expect(result.panelSettings.panelSettingsA).toHaveProperty(messageConverter.fromSchemaName);
    expect(result.panelSettings.panelSettingsA![messageConverter.fromSchemaName]).toEqual(
      panelSettingsA,
    );
    expect(result.panelSettings.panelSettingsB).toHaveProperty(messageConverter.fromSchemaName);
    expect(result.panelSettings.panelSettingsB![messageConverter.fromSchemaName]).toEqual(
      panelSettingsB,
    );
    delete (globalThis as any).messageConverter;
  });

  it("registers topic aliases correctly", () => {
    const extensionInfo = ExtensionBuilder.extensionInfo();
    const aliasFunction: TopicAliasFunction = jest.fn();

    (globalThis as any).topicAliasFunction = aliasFunction;
    const extensionSource = `
      module.exports = {
        activate: (ctx) => {
          ctx.registerTopicAliases(globalThis.topicAliasFunction);
        }
      };
    `;

    const result = buildContributionPoints(extensionInfo, extensionSource);

    expect(result.topicAliasFunctions).toHaveLength(1);
    expect(result.topicAliasFunctions[0]!.extensionId).toBe(extensionInfo.id);
    expect(result.topicAliasFunctions[0]!.aliasFunction).toBe(aliasFunction);
    delete (globalThis as any).topicAliasFunction;
  });
});
