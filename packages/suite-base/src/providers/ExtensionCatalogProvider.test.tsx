/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import { act, render, renderHook, waitFor } from "@testing-library/react";
import { useEffect } from "react";

import { ExtensionPanelRegistration, PanelSettings } from "@lichtblick/suite";
import { useConfigById } from "@lichtblick/suite-base/PanelAPI";
import Panel from "@lichtblick/suite-base/components/Panel";
import {
  ContributionPoints,
  MessageConverter,
  useExtensionCatalog,
} from "@lichtblick/suite-base/context/ExtensionCatalogContext";
import { TopicAliasFunctions } from "@lichtblick/suite-base/players/TopicAliasingPlayer/StateProcessorFactory";
import { ExtensionLoader } from "@lichtblick/suite-base/services/ExtensionLoader";
import PanelSetup from "@lichtblick/suite-base/stories/PanelSetup";
import BasicBuilder from "@lichtblick/suite-base/testing/builders/BasicBuilder";
import ExtensionBuilder from "@lichtblick/suite-base/testing/builders/ExtensionBuilder";
import { ExtensionInfo, ExtensionNamespace } from "@lichtblick/suite-base/types/Extensions";

import ExtensionCatalogProvider from "./ExtensionCatalogProvider";

describe("ExtensionCatalogProvider", () => {
  function setup({ loadersOverride }: { loadersOverride?: ExtensionLoader[] } = {}) {
    const extensionInfo: ExtensionInfo = ExtensionBuilder.extensionInfo();
    const extensions: ExtensionInfo[] = [extensionInfo];

    const loadExtension = jest
      .fn()
      .mockResolvedValue(`module.exports = { activate: function() { return 1; } }`);
    const loaderDefault: ExtensionLoader = {
      namespace: extensionInfo.namespace!,
      getExtension: jest.fn().mockResolvedValue(extensionInfo),
      getExtensions: jest.fn().mockResolvedValue(extensions),
      installExtension: jest.fn().mockResolvedValue(extensionInfo),
      loadExtension,
      uninstallExtension: jest.fn(),
    };
    const loaders = loadersOverride ?? [loaderDefault];

    return {
      ...renderHook(() => useExtensionCatalog((state) => state), {
        initialProps: {},
        wrapper: ({ children }) => (
          <ExtensionCatalogProvider loaders={loaders}>{children}</ExtensionCatalogProvider>
        ),
      }),
      extensionInfo,
      loaders,
      loadExtension,
    };
  }

  it("should load an extension from the loaders", async () => {
    const { loadExtension, result, extensionInfo } = setup();

    await waitFor(() => {
      expect(loadExtension).toHaveBeenCalledTimes(1);
    });
    expect(result.current.installedExtensions).toEqual([extensionInfo]);
  });

  it("handles extensions with the same id in different loaders", async () => {
    const source1 = `module.exports = { activate: function() { return 1; } }`;
    const source2 = `module.exports = { activate: function() { return 2; } }`;
    const extension1 = ExtensionBuilder.extensionInfo({ namespace: "org" });
    const extension2 = ExtensionBuilder.extensionInfo({ namespace: "local" });
    const loadExtension1 = jest.fn().mockResolvedValue(source1);
    const loadExtension2 = jest.fn().mockResolvedValue(source2);
    const loader1: ExtensionLoader = {
      namespace: extension1.namespace!,
      getExtension: jest.fn(),
      getExtensions: jest.fn().mockResolvedValue([extension1]),
      loadExtension: loadExtension1,
      installExtension: jest.fn(),
      uninstallExtension: jest.fn(),
    };
    const loader2: ExtensionLoader = {
      namespace: extension2.namespace!,
      getExtension: jest.fn(),
      getExtensions: jest.fn().mockResolvedValue([extension2]),
      loadExtension: loadExtension2,
      installExtension: jest.fn(),
      uninstallExtension: jest.fn(),
    };
    const { result } = setup({ loadersOverride: [loader1, loader2] });

    await waitFor(() => {
      expect(loadExtension1).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(loadExtension2).toHaveBeenCalledTimes(1);
    });
    expect(result.current.installedExtensions).toEqual([extension1, extension2]);
  });

  it("should register a message converter", async () => {
    const source = `
        module.exports = {
            activate: function(ctx) {
                ctx.registerMessageConverter({
                    fromSchemaName: "from.Schema",
                    toSchemaName: "to.Schema",
                    converter: (msg) => msg,
                })
            }
        }
    `;
    const loadExtension = jest.fn().mockResolvedValue(source);
    const extension = ExtensionBuilder.extensionInfo();
    const loader: ExtensionLoader = {
      namespace: extension.namespace!,
      getExtension: jest.fn(),
      getExtensions: jest.fn().mockResolvedValue([extension]),
      loadExtension,
      installExtension: jest.fn(),
      uninstallExtension: jest.fn(),
    };

    const { result } = setup({ loadersOverride: [loader] });

    await waitFor(() => {
      expect(loadExtension).toHaveBeenCalledTimes(1);
    });
    expect(result.current.installedMessageConverters?.length).toEqual(1);
    expect(result.current.installedMessageConverters).toEqual([
      {
        converter: expect.any(Function),
        extensionId: expect.any(String),
        extensionNamespace: extension.namespace,
        fromSchemaName: "from.Schema",
        toSchemaName: "to.Schema",
      },
    ]);
  });

  it("should register multiple message converters", async () => {
    const schemaName1 = BasicBuilder.string();
    const schemaName2 = BasicBuilder.string();
    const source = `
      module.exports = {
        activate: function(ctx) {
          ctx.registerMessageConverter({
            fromSchemaName: "from.${schemaName1}",
            toSchemaName: "to.${schemaName1}",
            converter: (msg) => msg,
          });
          ctx.registerMessageConverter({
            fromSchemaName: "from.${schemaName2}",
            toSchemaName: "to.${schemaName2}",
            converter: (msg) => msg,
          });
        }
      };
    `;

    const loadExtension = jest.fn().mockResolvedValue(source);
    const extension = ExtensionBuilder.extensionInfo();
    const loader: ExtensionLoader = {
      namespace: extension.namespace!,
      getExtension: jest.fn(),
      getExtensions: jest.fn().mockResolvedValue([extension]),
      loadExtension,
      installExtension: jest.fn(),
      uninstallExtension: jest.fn(),
    };

    const { result } = setup({ loadersOverride: [loader] });

    await waitFor(() => {
      expect(loadExtension).toHaveBeenCalledTimes(1);
    });
    expect(result.current.installedMessageConverters?.length).toBe(2);
    expect(result.current.installedMessageConverters).toEqual([
      {
        converter: expect.any(Function),
        extensionId: expect.any(String),
        extensionNamespace: extension.namespace,
        fromSchemaName: `from.${schemaName1}`,
        toSchemaName: `to.${schemaName1}`,
      },
      {
        converter: expect.any(Function),
        extensionId: expect.any(String),
        extensionNamespace: extension.namespace,
        fromSchemaName: `from.${schemaName2}`,
        toSchemaName: `to.${schemaName2}`,
      },
    ]);
  });

  it("should register panel settings", async () => {
    const source = `
        module.exports = {
            activate: function(ctx) {
              ctx.registerMessageConverter({
              fromSchemaName: "from.Schema",
              toSchemaName: "to.Schema",
              converter: (msg) => msg,
              panelSettings: {
                Dummy: {
                  settings: (config) => ({
                    fields: {
                      test: {
                        input: "boolean",
                        value: config?.test,
                        label: "Nope",
                      },
                    },
                  }),
                  handler: () => {},
                  defaultConfig: {
                    test: true,
                  },
                },
              },
            });
            }
        }
    `;
    const extension = ExtensionBuilder.extensionInfo();
    const loadExtension = jest.fn().mockResolvedValue(source);
    const loader: ExtensionLoader = {
      namespace: extension.namespace!,
      getExtension: jest.fn(),
      getExtensions: jest.fn().mockResolvedValue([extension]),
      installExtension: jest.fn(),
      loadExtension,
      uninstallExtension: jest.fn(),
    };

    const { result } = setup({ loadersOverride: [loader] });

    await waitFor(() => {
      expect(loadExtension).toHaveBeenCalledTimes(1);
    });
    expect(result.current.panelSettings).toEqual({
      Dummy: {
        "from.Schema": {
          defaultConfig: { test: true },
          handler: expect.any(Function),
          settings: expect.any(Function),
        },
      },
    });
  });

  it("should register topic aliases", async () => {
    const source = `
        module.exports = {
            activate: function(ctx) {
                ctx.registerTopicAliases(() => {
                    return [];
                })
            }
        }
    `;
    const loadExtension = jest.fn().mockResolvedValue(source);
    const extension = ExtensionBuilder.extensionInfo();
    const loader: ExtensionLoader = {
      namespace: extension.namespace!,
      getExtension: jest.fn(),
      getExtensions: jest.fn().mockResolvedValue([extension]),
      loadExtension,
      installExtension: jest.fn(),
      uninstallExtension: jest.fn(),
    };

    const { result } = renderHook(() => useExtensionCatalog((state) => state), {
      initialProps: {},
      wrapper: ({ children }) => (
        <ExtensionCatalogProvider loaders={[loader]}>{children}</ExtensionCatalogProvider>
      ),
    });

    await waitFor(() => {
      expect(loadExtension).toHaveBeenCalledTimes(1);
    });
    expect(result.current.installedTopicAliasFunctions?.length).toBe(1);
    expect(result.current.installedTopicAliasFunctions).toEqual([
      { extensionId: extension.id, aliasFunction: expect.any(Function) },
    ]);
  });

  it("should register multiple topic aliases", async () => {
    const source = `
      module.exports = {
        activate: function (ctx) {
          ctx.registerTopicAliases(() => {
            return [];
          });
          ctx.registerTopicAliases(() => {
            return [];
          });
        },
      };
    `;

    const loadExtension = jest.fn().mockResolvedValue(source);
    const extension = ExtensionBuilder.extensionInfo();
    const loader: ExtensionLoader = {
      namespace: extension.namespace!,
      getExtension: jest.fn(),
      getExtensions: jest.fn().mockResolvedValue([extension]),
      loadExtension,
      installExtension: jest.fn(),
      uninstallExtension: jest.fn(),
    };

    const { result } = renderHook(() => useExtensionCatalog((state) => state), {
      initialProps: {},
      wrapper: ({ children }) => (
        <ExtensionCatalogProvider loaders={[loader]}>{children}</ExtensionCatalogProvider>
      ),
    });

    await waitFor(() => {
      expect(loadExtension).toHaveBeenCalledTimes(1);
    });
    expect(result.current.installedTopicAliasFunctions?.length).toBe(2);
    expect(result.current.installedTopicAliasFunctions).toEqual([
      { extensionId: extension.id, aliasFunction: expect.any(Function) },
      { extensionId: extension.id, aliasFunction: expect.any(Function) },
    ]);
  });

  it("should register camera models", async () => {
    const cameraModel1 = "CameraModel1";
    const cameraModel2 = "CameraModel2";

    const source = `
        module.exports = {
            activate: function(ctx) {
                ctx.registerCameraModel({
                    name: "${cameraModel1}",
                    modelBuilder: () => undefined
                })
                ctx.registerCameraModel({
                    name: "${cameraModel2}",
                    modelBuilder: () => undefined
                })
            }
        }
    `;
    const loadExtension = jest.fn().mockResolvedValue(source);
    const extension = ExtensionBuilder.extensionInfo();
    const loader: ExtensionLoader = {
      namespace: extension.namespace!,
      getExtension: jest.fn(),
      getExtensions: jest.fn().mockResolvedValue([extension]),
      loadExtension,
      installExtension: jest.fn(),
      uninstallExtension: jest.fn(),
    };

    const { result } = renderHook(() => useExtensionCatalog((state) => state), {
      initialProps: {},
      wrapper: ({ children }) => (
        <ExtensionCatalogProvider loaders={[loader]}>{children}</ExtensionCatalogProvider>
      ),
    });

    await waitFor(() => {
      expect(loadExtension).toHaveBeenCalledTimes(1);
    });

    expect(result.current.installedCameraModels.size).toEqual(2);
    expect(result.current.installedCameraModels.get(cameraModel1)).toEqual({
      extensionId: extension.id,
      modelBuilder: expect.any(Function),
    });
    expect(result.current.installedCameraModels.get(cameraModel2)).toEqual({
      extensionId: extension.id,
      modelBuilder: expect.any(Function),
    });
  });

  it("should register a default config", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});

    function getDummyPanel(updatedConfig: jest.Mock, childId: string) {
      function DummyComponent(): ReactNull {
        const [config] = useConfigById(childId);

        useEffect(() => updatedConfig(config), [config]);
        return ReactNull;
      }
      DummyComponent.panelType = "Dummy";
      DummyComponent.defaultConfig = { someString: "hello world" };
      return Panel(DummyComponent);
    }

    const updatedConfig = jest.fn();
    const childId = "Dummy!1my2ydk";
    const DummyPanel = getDummyPanel(updatedConfig, childId);
    const generatePanelSettings = <T,>(obj: PanelSettings<T>) => obj as PanelSettings<unknown>;

    render(
      <PanelSetup
        fixture={{
          topics: [{ name: "myTopic", schemaName: "from.Schema" }],
          messageConverters: [
            {
              fromSchemaName: "from.Schema",
              toSchemaName: "to.Schema",
              converter: (msg) => msg,
              panelSettings: {
                Dummy: generatePanelSettings({
                  settings: (config) => ({
                    fields: {
                      test: {
                        input: "boolean",
                        value: config?.test,
                        label: "Nope",
                      },
                    },
                  }),
                  handler: () => {},
                  defaultConfig: {
                    test: true,
                  },
                }),
              },
            },
          ],
        }}
      >
        <DummyPanel childId={childId} />
      </PanelSetup>,
    );

    await waitFor(() => {
      expect(updatedConfig).toHaveBeenCalled();
    });

    expect(updatedConfig.mock.calls.at(-1)).toEqual([
      { someString: "hello world", topics: { myTopic: { test: true } } },
    ]);

    (console.error as jest.Mock).mockRestore();
  });

  describe("isExtensionInstalled", () => {
    it("should check if an extension is installed", async () => {
      const { loadExtension, result, extensionInfo } = setup();

      await waitFor(() => {
        expect(loadExtension).toHaveBeenCalled();
      });

      expect(result.current.isExtensionInstalled(extensionInfo.id)).toBe(true);
    });
  });

  describe("unMarkExtensionAsInstalled", () => {
    it("should unmark an extension as installed", async () => {
      const { loadExtension, result, extensionInfo } = setup();

      await waitFor(() => {
        expect(loadExtension).toHaveBeenCalled();
      });

      expect(result.current.isExtensionInstalled(extensionInfo.id)).toBe(true);
      act(() => {
        result.current.unMarkExtensionAsInstalled(extensionInfo.id);
      });
      expect(result.current.isExtensionInstalled(extensionInfo.id)).toBe(false);
      expect(result.current.loadedExtensions.size).toBe(0);
    });
  });

  describe("installExtensions", () => {
    it("should install an extension", async () => {
      const { result, extensionInfo } = setup();

      await act(async () => {
        const response = await result.current.installExtensions(extensionInfo.namespace!, [
          new Uint8Array(),
        ]);
        expect(response.length).toBe(1);
        expect(response[0]?.success).toBe(true);
        expect(response[0]?.info).toEqual(extensionInfo);
      });
      expect(result.current.isExtensionInstalled(extensionInfo.id)).toBe(true);
    });

    it("should throw an error when install with no registered loader to the namespace", async () => {
      const invalidNamespace = BasicBuilder.string() as ExtensionNamespace;
      const { result } = setup();

      await expect(
        act(async () => {
          await result.current.installExtensions(invalidNamespace, [new Uint8Array()]);
        }),
      ).rejects.toThrow(`No extension loader found for namespace ${invalidNamespace}`);
    });
  });

  describe("uninstallExtension", () => {
    it("should uninstall an extension", async () => {
      const { result, extensionInfo, loaders } = setup();
      // eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain
      const namespace: ExtensionNamespace = loaders[0]?.namespace!;

      await act(async () => {
        await result.current.installExtensions(namespace, [new Uint8Array()]);
        await result.current.uninstallExtension(namespace, extensionInfo.id);
      });

      expect(result.current.isExtensionInstalled(extensionInfo.id)).toBe(false);
      expect(result.current.installedExtensions?.length).toBe(0);
      expect(result.current.installedPanels).toEqual({});
      expect(result.current.installedMessageConverters?.length).toBe(0);
      expect(result.current.installedTopicAliasFunctions?.length).toBe(0);
      expect(result.current.installedCameraModels.size).toBe(0);
    });

    it("should throw an error when uninstall with no registered loader to the namespace", async () => {
      const invalidNamespace = BasicBuilder.string() as ExtensionNamespace;
      const { result } = setup();

      await expect(
        act(async () => {
          await result.current.uninstallExtension(invalidNamespace, "");
        }),
      ).rejects.toThrow(`No extension loader found for namespace ${invalidNamespace}`);
    });
  });

  describe("mergeState", () => {
    it("should merge state correctly using mergeState", async () => {
      const { result, extensionInfo } = setup();
      const panelName = BasicBuilder.string();
      const messageConverter: MessageConverter = {
        fromSchemaName: BasicBuilder.string(),
        toSchemaName: BasicBuilder.string(),
        converter: jest.fn(),
        extensionId: extensionInfo.id,
        extensionNamespace: extensionInfo.namespace,
      };
      const topicAliasFunctions: TopicAliasFunctions = [
        { extensionId: extensionInfo.id, aliasFunction: jest.fn() },
      ];
      const contributionPoints: ContributionPoints = {
        messageConverters: [messageConverter],
        cameraModels: new Map(),
        topicAliasFunctions,
        panelSettings: {
          panelA: {
            schemaA: {
              defaultConfig: {},
              handler: jest.fn(),
              settings: jest.fn(),
            },
          },
        },
        panels: {
          [panelName]: {
            extensionId: extensionInfo.id,
            extensionName: extensionInfo.qualifiedName,
            extensionNamespace: extensionInfo.namespace,
            registration: {} as ExtensionPanelRegistration,
          },
        },
      };

      await act(async () => {
        await result.current.installExtensions(extensionInfo.namespace!, [new Uint8Array()]);
      });

      act(() => {
        result.current.mergeState(extensionInfo, contributionPoints);
      });

      expect(result.current.installedExtensions).toContainEqual(
        expect.objectContaining({ id: extensionInfo.id }),
      );
      expect(result.current.installedMessageConverters).toHaveLength(1);
      expect(result.current.installedMessageConverters![0]).toEqual({
        ...messageConverter,
        converter: expect.any(Function),
      });
      expect(result.current.installedPanels).toEqual({ [panelName]: expect.any(Object) });
      expect(result.current.installedPanels![panelName]).toMatchObject({
        extensionId: extensionInfo.id,
        extensionName: extensionInfo.qualifiedName,
        extensionNamespace: extensionInfo.namespace,
      });
      expect(result.current.installedTopicAliasFunctions).toHaveLength(1);
      expect(result.current.installedTopicAliasFunctions![0]).toMatchObject({
        extensionId: extensionInfo.id,
      });
    });
  });
});
