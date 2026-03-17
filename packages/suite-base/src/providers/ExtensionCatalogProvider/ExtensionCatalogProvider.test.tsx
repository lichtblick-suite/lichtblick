/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
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
  ExtensionData,
  InstallExtensionsResult,
  useExtensionCatalog,
} from "@lichtblick/suite-base/context/ExtensionCatalogContext";
import { TopicAliasFunctions } from "@lichtblick/suite-base/players/TopicAliasingPlayer/StateProcessorFactory";
import {
  IExtensionLoader,
  LoadedExtension,
} from "@lichtblick/suite-base/services/extension/IExtensionLoader";
import PanelSetup from "@lichtblick/suite-base/stories/PanelSetup";
import ExtensionBuilder from "@lichtblick/suite-base/testing/builders/ExtensionBuilder";
import { Namespace } from "@lichtblick/suite-base/types";
import { ExtensionInfo } from "@lichtblick/suite-base/types/Extensions";
import { InstalledMessageConverter } from "@lichtblick/suite-base/types/messageConverters";
import isDesktopApp from "@lichtblick/suite-base/util/isDesktopApp";
import { BasicBuilder } from "@lichtblick/test-builders";

import ExtensionCatalogProvider from "./ExtensionCatalogProvider";

jest.mock("@lichtblick/suite-base/util/isDesktopApp", () => jest.fn());

describe("ExtensionCatalogProvider", () => {
  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    (console.error as jest.Mock).mockRestore();
  });

  // Helper functions for test initialization
  const defaultSource = `module.exports = { activate: function() { return 1; } }`;

  function createMockLoader(
    overrides: Partial<IExtensionLoader> & {
      namespace: Namespace;
      type: IExtensionLoader["type"];
    },
  ): IExtensionLoader {
    return {
      getExtension: jest.fn(),
      getExtensions: jest.fn().mockResolvedValue([]),
      loadExtension: jest.fn().mockResolvedValue({ raw: defaultSource } as LoadedExtension),
      installExtension: jest.fn(),
      uninstallExtension: jest.fn(),
      ...overrides,
    };
  }

  function createLocalLoader(
    extension: ExtensionInfo,
    options?: {
      source?: string;
      loadExtensionMock?: jest.Mock;
    },
  ): IExtensionLoader {
    return createMockLoader({
      type: "browser",
      namespace: "local",
      getExtensions: jest.fn().mockResolvedValue([extension]),
      loadExtension:
        options?.loadExtensionMock ??
        jest.fn().mockResolvedValue({ raw: options?.source ?? defaultSource } as LoadedExtension),
    });
  }

  function createOrgCacheLoader(
    cachedExtension: ExtensionInfo | undefined,
    options?: {
      source?: string;
      loadExtensionMock?: jest.Mock;
      installExtensionMock?: jest.Mock;
    },
  ): IExtensionLoader {
    return createMockLoader({
      type: "browser",
      namespace: "org",
      getExtension: jest.fn().mockResolvedValue(cachedExtension),
      loadExtension:
        options?.loadExtensionMock ??
        jest.fn().mockResolvedValue({ raw: options?.source ?? defaultSource } as LoadedExtension),
      installExtension: options?.installExtensionMock ?? jest.fn(),
    });
  }

  function createOrgServerLoader(
    remoteExtension: ExtensionInfo,
    options?: {
      source?: string;
      buffer?: Uint8Array;
      loadExtensionMock?: jest.Mock;
    },
  ): IExtensionLoader {
    const loadResponse: LoadedExtension = {
      raw: options?.source ?? defaultSource,
      ...(options?.buffer && { buffer: options.buffer }),
    };

    return createMockLoader({
      type: "server",
      namespace: "org",
      getExtensions: jest.fn().mockResolvedValue([remoteExtension]),
      loadExtension: options?.loadExtensionMock ?? jest.fn().mockResolvedValue(loadResponse),
    });
  }

  async function setup({ loadersOverride }: { loadersOverride?: IExtensionLoader[] } = {}) {
    const namespace: Namespace = "local";
    const extensionInfo: ExtensionInfo = ExtensionBuilder.extensionInfo({ namespace });
    const extensions: ExtensionInfo[] = [extensionInfo];

    const loadExtension = jest.fn().mockResolvedValue({
      raw: `module.exports = { activate: function() { return 1; } }`,
    } as LoadedExtension);
    const loaderDefault: IExtensionLoader = {
      type: extensionInfo.namespace === "local" ? "browser" : "server",
      namespace: extensionInfo.namespace!,
      getExtension: jest.fn().mockResolvedValue(extensionInfo),
      getExtensions: jest.fn().mockResolvedValue(extensions),
      installExtension: jest.fn().mockResolvedValue(extensionInfo),
      loadExtension,
      uninstallExtension: jest.fn(),
    };
    const loaders = loadersOverride ?? [loaderDefault];

    const { result } = renderHook(() => useExtensionCatalog((state) => state), {
      initialProps: {},
      wrapper: ({ children }) => (
        <ExtensionCatalogProvider loaders={loaders}>{children}</ExtensionCatalogProvider>
      ),
    });

    // Wait for refreshAllExtensions (triggered by useEffect on mount) to complete.
    // installedExtensions is undefined until the first refresh finishes.
    await waitFor(() => {
      expect(result.current.installedExtensions).toBeDefined();
    });

    return { result, extensionInfo, loadExtension };
  }

  it("should load an extension from the loaders", async () => {
    const { loadExtension, result, extensionInfo } = await setup();

    await waitFor(() => {
      expect(loadExtension).toHaveBeenCalledTimes(1);
    });
    expect(result.current.installedExtensions).toEqual([extensionInfo]);
  });

  it("handles extensions with the same id in different loaders", async () => {
    const source1 = `module.exports = { activate: function() { return 1; } }`;
    const source2 = `module.exports = { activate: function() { return 2; } }`;
    const extension1 = ExtensionBuilder.extensionInfo({ namespace: "local" });
    const extension2 = ExtensionBuilder.extensionInfo({ namespace: "local" });
    const loadExtension1 = jest.fn().mockResolvedValue({ raw: source1 } as LoadedExtension);
    const loadExtension2 = jest.fn().mockResolvedValue({ raw: source2 } as LoadedExtension);

    const loader1: IExtensionLoader = {
      type: "browser",
      namespace: extension1.namespace!,
      getExtension: jest.fn(),
      getExtensions: jest.fn().mockResolvedValue([extension1]),
      loadExtension: loadExtension1,
      installExtension: jest.fn(),
      uninstallExtension: jest.fn(),
    };
    const loader2: IExtensionLoader = {
      type: "browser",
      namespace: extension2.namespace!,
      getExtension: jest.fn(),
      getExtensions: jest.fn().mockResolvedValue([extension2]),
      loadExtension: loadExtension2,
      installExtension: jest.fn(),
      uninstallExtension: jest.fn(),
    };
    const { result } = await setup({ loadersOverride: [loader1, loader2] });

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
                    converter: function(msg) { return msg; },
                })
            }
        }
    `;
    const loadExtension = jest.fn().mockResolvedValue({ raw: source } as LoadedExtension);
    const extension = ExtensionBuilder.extensionInfo({ namespace: "local" });
    const loader: IExtensionLoader = {
      type: "browser",
      namespace: extension.namespace!,
      getExtension: jest.fn(),
      getExtensions: jest.fn().mockResolvedValue([extension]),
      loadExtension,
      installExtension: jest.fn(),
      uninstallExtension: jest.fn(),
    };

    const { result } = await setup({ loadersOverride: [loader] });

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
            converter: function(msg) { return msg; },
          });
          ctx.registerMessageConverter({
            fromSchemaName: "from.${schemaName2}",
            toSchemaName: "to.${schemaName2}",
            converter: function(msg) { return msg; },
          });
        }
      };
    `;

    const loadExtension = jest.fn().mockResolvedValue({ raw: source } as LoadedExtension);
    const extension = ExtensionBuilder.extensionInfo({ namespace: "local" });
    const loader: IExtensionLoader = {
      type: "browser",
      namespace: extension.namespace!,
      getExtension: jest.fn(),
      getExtensions: jest.fn().mockResolvedValue([extension]),
      loadExtension,
      installExtension: jest.fn(),
      uninstallExtension: jest.fn(),
    };

    const { result } = await setup({ loadersOverride: [loader] });

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
              converter: function(msg) { return msg; },
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
    const extension = ExtensionBuilder.extensionInfo({ namespace: "local" });
    const loadExtension = jest.fn().mockResolvedValue({ raw: source } as LoadedExtension);
    const loader: IExtensionLoader = {
      type: "browser",
      namespace: extension.namespace!,
      getExtension: jest.fn(),
      getExtensions: jest.fn().mockResolvedValue([extension]),
      installExtension: jest.fn(),
      loadExtension,
      uninstallExtension: jest.fn(),
    };

    const { result } = await setup({ loadersOverride: [loader] });

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
    const loadExtension = jest.fn().mockResolvedValue({ raw: source } as LoadedExtension);
    const extension = ExtensionBuilder.extensionInfo({ namespace: "local" });
    const loader: IExtensionLoader = {
      type: "browser",
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

    const loadExtension = jest.fn().mockResolvedValue({ raw: source } as LoadedExtension);
    const extension = ExtensionBuilder.extensionInfo({ namespace: "local" });
    const loader: IExtensionLoader = {
      type: "browser",
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
    const loadExtension = jest.fn().mockResolvedValue({ raw: source } as LoadedExtension);
    const extension = ExtensionBuilder.extensionInfo({ namespace: "local" });
    const loader: IExtensionLoader = {
      type: "browser",
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
      const { loadExtension, result, extensionInfo } = await setup();

      await waitFor(() => {
        expect(loadExtension).toHaveBeenCalled();
      });

      expect(result.current.isExtensionInstalled(extensionInfo.id)).toBe(true);
    });
  });

  describe("unMarkExtensionAsInstalled", () => {
    it("should unmark an extension as installed", async () => {
      const { loadExtension, result, extensionInfo } = await setup();

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
      const { result, extensionInfo } = await setup();
      const extensionData: ExtensionData[] = [{ buffer: new Uint8Array() }];

      await act(async () => {
        const response = await result.current.installExtensions(
          extensionInfo.namespace!,
          extensionData,
        );
        expect(response.length).toBe(1);
        expect(response[0]?.success).toBe(true);
        expect(response[0]?.info).toEqual(extensionInfo);
      });
      expect(result.current.isExtensionInstalled(extensionInfo.id)).toBe(true);
    });

    it("should throw an error when install with no registered loader to the namespace", async () => {
      const invalidNamespace = BasicBuilder.string() as Namespace;
      const { result } = await setup();
      const extensionData: ExtensionData[] = [{ buffer: new Uint8Array() }];

      await expect(
        act(async () => {
          await result.current.installExtensions(invalidNamespace, extensionData);
        }),
      ).rejects.toThrow(`No extension loader found for namespace ${invalidNamespace}`);
    });

    it("should return a failure result when all loaders fail to install the extension", async () => {
      // Given: a loader whose installExtension always rejects
      (isDesktopApp as jest.Mock).mockReturnValue(false);
      const loader = createMockLoader({
        namespace: "local",
        type: "browser",
        installExtension: jest.fn().mockRejectedValue(new Error("install failed")),
      });
      const { result } = await setup({ loadersOverride: [loader] });
      const extensionData: ExtensionData[] = [{ buffer: new Uint8Array() }];

      // When: installExtensions is called
      let response: InstallExtensionsResult[] | undefined;
      await act(async () => {
        response = await result.current.installExtensions("local", extensionData);
      });

      // Then: result reports failure with "All loaders failed"
      expect(response).toHaveLength(1);
      expect(response![0]!.success).toBe(false);
      expect((response![0]!.error as Error).message).toBe("All loaders failed");
    });
  });

  describe("uninstallExtension", () => {
    it("should uninstall an extension", async () => {
      const { result, extensionInfo } = await setup();
      const extensionData: ExtensionData[] = [{ buffer: new Uint8Array() }];

      const namespace: Namespace = extensionInfo.namespace!;

      await act(async () => {
        await result.current.installExtensions(namespace, extensionData);
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
      const invalidNamespace = BasicBuilder.string() as Namespace;
      const { result } = await setup();

      await expect(
        act(async () => {
          await result.current.uninstallExtension(invalidNamespace, "");
        }),
      ).rejects.toThrow(`No extension loader found for namespace ${invalidNamespace}`);
    });

    it.each([
      {
        description: "browser loader (local namespace)",
        isDesktop: false,
        loaderType: "browser" as const,
        namespace: "local" as Namespace,
        useExternalId: false,
      },
      {
        description: "filesystem loader (local namespace)",
        isDesktop: true,
        loaderType: "filesystem" as const,
        namespace: "local" as Namespace,
        useExternalId: false,
      },
      {
        description: "server loader (org namespace)",
        isDesktop: false,
        loaderType: "server" as const,
        namespace: "org" as Namespace,
        useExternalId: true,
      },
    ])(
      "should call uninstallExtension with correct parameter for $description",
      async ({ isDesktop, loaderType, namespace, useExternalId }) => {
        (isDesktopApp as jest.Mock).mockReturnValue(isDesktop);

        const externalId = useExternalId ? BasicBuilder.string() : undefined;
        const extensionInfo = ExtensionBuilder.extensionInfo({
          namespace,
          ...(externalId && { externalId }),
        });
        const uninstallFn = jest.fn().mockResolvedValue(undefined);
        const loader: IExtensionLoader = {
          type: loaderType,
          namespace,
          getExtension: jest.fn(),
          getExtensions: jest.fn().mockResolvedValue([extensionInfo]),
          installExtension: jest.fn().mockResolvedValue(extensionInfo),
          loadExtension: jest.fn(),
          uninstallExtension: uninstallFn,
        };

        const { result } = await setup({ loadersOverride: [loader] });

        await waitFor(() => {
          expect(result.current.installedExtensions).toHaveLength(1);
        });

        await act(async () => {
          await result.current.uninstallExtension(namespace, extensionInfo.id);
        });

        expect(uninstallFn).toHaveBeenCalledWith(useExternalId ? externalId : extensionInfo.id);
      },
    );

    it("should log a warning and still remove extension data from state when uninstallExtension throws", async () => {
      (isDesktopApp as jest.Mock).mockReturnValue(false);
      jest.spyOn(console, "warn").mockImplementation(() => {});

      const extensionInfo = ExtensionBuilder.extensionInfo({ namespace: "local" });
      const uninstallFn = jest.fn().mockRejectedValue(new Error("Uninstall failed"));
      const loader: IExtensionLoader = {
        type: "browser",
        namespace: "local",
        getExtension: jest.fn(),
        getExtensions: jest.fn().mockResolvedValue([extensionInfo]),
        installExtension: jest.fn().mockResolvedValue(extensionInfo),
        loadExtension: jest.fn(),
        uninstallExtension: uninstallFn,
      };

      const { result } = await setup({ loadersOverride: [loader] });

      await waitFor(() => {
        expect(result.current.installedExtensions).toHaveLength(1);
      });

      await act(async () => {
        await result.current.uninstallExtension("local", extensionInfo.id);
      });

      // Extension is removed from state despite the error
      expect(result.current.installedExtensions).toHaveLength(0);
      expect(result.current.isExtensionInstalled(extensionInfo.id)).toBe(false);

      (console.warn as jest.Mock).mockRestore();
    });

    it("should only remove the org entry when the same extension is installed in both local and org", async () => {
      (isDesktopApp as jest.Mock).mockReturnValue(false);

      const sharedId = BasicBuilder.string();
      const localExtension = ExtensionBuilder.extensionInfo({ id: sharedId, namespace: "local" });
      const orgExtension = ExtensionBuilder.extensionInfo({ id: sharedId, namespace: "org" });

      const localLoader = createLocalLoader(localExtension, { source: "" });
      const orgLoader = createOrgServerLoader(orgExtension, { source: "" });

      const { result } = await setup({ loadersOverride: [localLoader, orgLoader] });

      await waitFor(() => {
        expect(result.current.installedExtensions).toHaveLength(2);
      });

      // Uninstall only the org copy
      await act(async () => {
        await result.current.uninstallExtension("org", sharedId);
      });

      // Local copy must still be present
      expect(result.current.installedExtensions).toHaveLength(1);
      expect(result.current.installedExtensions).toContainEqual(
        expect.objectContaining({ id: sharedId, namespace: "local" }),
      );
      // Extension is still considered installed (local copy remains)
      expect(result.current.isExtensionInstalled(sharedId)).toBe(true);
    });

    it("should remove contribution points only when the last namespace copy is uninstalled", async () => {
      (isDesktopApp as jest.Mock).mockReturnValue(false);

      const sharedId = BasicBuilder.string();
      const panelName = BasicBuilder.string();
      const source = `
        module.exports = {
          activate: function(ctx) {
            ctx.registerPanel({ name: "${panelName}", initPanel: () => ({ renderToolbar: () => null }) });
          }
        }
      `;

      const localExtension = ExtensionBuilder.extensionInfo({ id: sharedId, namespace: "local" });
      const orgExtension = ExtensionBuilder.extensionInfo({ id: sharedId, namespace: "org" });

      const localLoader = createLocalLoader(localExtension, { source });
      const orgLoader = createOrgServerLoader(orgExtension, { source });

      const { result } = await setup({ loadersOverride: [localLoader, orgLoader] });

      await waitFor(() => {
        expect(result.current.installedExtensions).toHaveLength(2);
      });

      // Uninstall org copy — panels should still be registered (local copy remains)
      await act(async () => {
        await result.current.uninstallExtension("org", sharedId);
      });

      expect(result.current.installedExtensions).toHaveLength(1);
      const panelKey = Object.keys(result.current.installedPanels ?? {}).find((k) =>
        k.includes(panelName),
      );
      expect(panelKey).toBeDefined();

      // Uninstall local copy — now panels must be cleaned up
      await act(async () => {
        await result.current.uninstallExtension("local", sharedId);
      });

      expect(result.current.installedExtensions).toHaveLength(0);
      expect(result.current.installedPanels).toEqual({});
      expect(result.current.isExtensionInstalled(sharedId)).toBe(false);
    });

    it("should do nothing when the extension id is not found in installedExtensions", async () => {
      // Given: a loader with no extensions, so installedExtensions is empty after mount
      (isDesktopApp as jest.Mock).mockReturnValue(false);
      const uninstallFn = jest.fn();
      const loader = createMockLoader({
        namespace: "local",
        type: "browser",
        getExtensions: jest.fn().mockResolvedValue([]),
        uninstallExtension: uninstallFn,
      });
      const { result } = await setup({ loadersOverride: [loader] });
      const nonExistentId = BasicBuilder.string();

      // When: uninstall is called with an id not in installedExtensions
      await act(async () => {
        await result.current.uninstallExtension("local", nonExistentId);
      });

      // Then: the loader's uninstallExtension is never called, state is unchanged
      expect(uninstallFn).not.toHaveBeenCalled();
      expect(result.current.installedExtensions).toEqual([]);
    });
  });

  describe("mergeState", () => {
    it("should merge state correctly using mergeState", async () => {
      const { result, extensionInfo } = await setup();
      const panelName = BasicBuilder.string();
      const messageConverter: InstalledMessageConverter = {
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
      const extensionData: ExtensionData[] = [{ buffer: new Uint8Array() }];

      await act(async () => {
        await result.current.installExtensions(extensionInfo.namespace!, extensionData);
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

    it("should add an entry for the same extension id installed in a different namespace", async () => {
      // Setup with the extension installed in "local" namespace
      const { result, extensionInfo } = await setup();

      // The same extension id, but now installed in "org" namespace
      const orgExtensionInfo = ExtensionBuilder.extensionInfo({
        id: extensionInfo.id,
        namespace: "org",
      });
      const emptyContributionPoints: ContributionPoints = {
        messageConverters: [],
        cameraModels: new Map(),
        topicAliasFunctions: [],
        panelSettings: {},
        panels: {},
      };

      act(() => {
        result.current.mergeState(orgExtensionInfo, emptyContributionPoints);
      });

      // Both local and org entries must be present
      expect(result.current.installedExtensions).toHaveLength(2);
      expect(result.current.installedExtensions).toContainEqual(
        expect.objectContaining({ id: extensionInfo.id, namespace: "local" }),
      );
      expect(result.current.installedExtensions).toContainEqual(
        expect.objectContaining({ id: extensionInfo.id, namespace: "org" }),
      );
    });

    it("should replace the existing entry when the same extension id+namespace is merged again (update takes precedence)", async () => {
      // Given: an extension is installed and merged into state
      const { result, extensionInfo } = await setup();

      await waitFor(() => {
        expect(result.current.installedExtensions).toHaveLength(1);
      });

      const updatedExtensionInfo: ExtensionInfo = {
        ...extensionInfo,
        version: "999.0.0",
        displayName: "Updated Display Name",
      };
      const emptyContributionPoints: ContributionPoints = {
        messageConverters: [],
        cameraModels: new Map(),
        topicAliasFunctions: [],
        panelSettings: {},
        panels: {},
      };

      // When
      act(() => {
        result.current.mergeState(updatedExtensionInfo, emptyContributionPoints);
      });

      // Then: list still has exactly one entry and it reflects the new version
      expect(result.current.installedExtensions).toHaveLength(1);
      expect(result.current.installedExtensions).toContainEqual(
        expect.objectContaining({
          id: extensionInfo.id,
          namespace: extensionInfo.namespace,
          version: "999.0.0",
          displayName: "Updated Display Name",
        }),
      );
    });
  });

  describe("markExtensionAsInstalled", () => {
    it("should mark an extension as installed", async () => {
      // Given
      const { result } = await setup();
      const extensionId = BasicBuilder.string();
      expect(result.current.isExtensionInstalled(extensionId)).toBe(false);

      // When
      act(() => {
        result.current.markExtensionAsInstalled(extensionId);
      });

      // Then
      expect(result.current.isExtensionInstalled(extensionId)).toBe(true);
      expect(result.current.loadedExtensions.has(extensionId)).toBe(true);
    });
  });

  describe("downloadExtension", () => {
    it("should download an extension and return a Uint8Array", async () => {
      // Given
      const bytes = new Uint8Array([BasicBuilder.number(), BasicBuilder.number()]);
      const url = BasicBuilder.string();
      global.fetch = jest.fn().mockResolvedValue({
        arrayBuffer: jest.fn().mockResolvedValue(bytes.buffer),
      });
      const { result } = await setup();

      // When
      let downloaded: Uint8Array | undefined;
      await act(async () => {
        downloaded = await result.current.downloadExtension(url);
      });

      // Then
      expect(global.fetch).toHaveBeenCalledWith(url);
      expect(downloaded).toEqual(bytes);
    });
  });

  describe("refreshAllExtensions", () => {
    it("should reload all extensions from loaders", async () => {
      // Given
      const extension = ExtensionBuilder.extensionInfo({ namespace: "local" });
      const loadExtensionMock = jest
        .fn()
        .mockResolvedValue({ raw: defaultSource } as LoadedExtension);
      const loader = createLocalLoader(extension, { loadExtensionMock });
      const { result } = await setup({ loadersOverride: [loader] });
      loadExtensionMock.mockClear();

      // When
      await act(async () => {
        await result.current.refreshAllExtensions();
      });

      // Then
      expect(loadExtensionMock).toHaveBeenCalledWith(extension.id);
      expect(result.current.installedExtensions).toEqual([extension]);
    });

    it("should skip a duplicate camera model and log a warning when the same name is already registered", async () => {
      // Given: two extensions that both register a camera model with the same name
      jest.spyOn(console, "warn").mockImplementation(() => {});
      const cameraModelName = BasicBuilder.string();
      const source = `
        module.exports = {
          activate: function(ctx) {
            ctx.registerCameraModel({
              name: "${cameraModelName}",
              modelBuilder: () => undefined
            })
          }
        }
      `;
      const extension1 = ExtensionBuilder.extensionInfo({ namespace: "local" });
      const extension2 = ExtensionBuilder.extensionInfo({ namespace: "local" });
      const loader = createMockLoader({
        namespace: "local",
        type: "browser",
        getExtensions: jest.fn().mockResolvedValue([extension1, extension2]),
        loadExtension: jest.fn().mockResolvedValue({ raw: source } as LoadedExtension),
      });

      // When: mount triggers refreshAllExtensions
      const { result } = await setup({ loadersOverride: [loader] });

      // Then: only one camera model registered (second duplicate was skipped)
      expect(result.current.installedCameraModels.size).toBe(1);
      expect(result.current.installedCameraModels.has(cameraModelName)).toBe(true);

      (console.warn as jest.Mock).mockRestore();
    });

    it("should continue loading other extensions when a loader getExtensions throws", async () => {
      // Given: a loader whose getExtensions rejects
      const loader = createMockLoader({
        namespace: "local",
        type: "browser",
        getExtensions: jest.fn().mockRejectedValue(new Error("getExtensions failed")),
      });

      // When: mount triggers refreshAllExtensions
      const { result } = await setup({ loadersOverride: [loader] });

      // Then: refreshAllExtensions completed gracefully with an empty list
      expect(result.current.installedExtensions).toEqual([]);
    });
  });

  describe("loadSingleExtension", () => {
    function setupLoaders(overrides?: {
      extensionId?: string;
      externalId?: string;
      cachedVersion?: string;
      remoteVersion?: string;
      buffer?: Uint8Array;
      cachedExtension?: ExtensionInfo | undefined;
      loadCachedMock?: jest.Mock;
      loadRemoteMock?: jest.Mock;
      installMock?: jest.Mock;
    }) {
      const extensionId = overrides?.extensionId ?? BasicBuilder.string();
      const externalId = overrides?.externalId ?? BasicBuilder.string();
      const remoteVersion = overrides?.remoteVersion ?? "1.2.3";
      const cachedVersion = overrides?.cachedVersion;

      const remoteExtension = ExtensionBuilder.extensionInfo({
        namespace: "org",
        id: extensionId,
        version: remoteVersion,
        externalId,
      });

      const cachedExtension =
        overrides?.cachedExtension ??
        (cachedVersion ? { ...remoteExtension, version: cachedVersion } : undefined);

      const loadCachedMock =
        overrides?.loadCachedMock ??
        jest.fn().mockResolvedValue({ raw: defaultSource } as LoadedExtension);
      const loadRemoteMock =
        overrides?.loadRemoteMock ??
        jest.fn().mockResolvedValue({
          raw: defaultSource,
          ...(overrides?.buffer && { buffer: overrides.buffer }),
        } as LoadedExtension);
      const cacheInstallMock = overrides?.installMock ?? jest.fn();

      const cacheLoader = createOrgCacheLoader(cachedExtension, {
        loadExtensionMock: loadCachedMock,
        installExtensionMock: cacheInstallMock,
      });

      const serverLoader = createOrgServerLoader(remoteExtension, {
        loadExtensionMock: loadRemoteMock,
      });

      return {
        extensionId,
        externalId,
        remoteExtension,
        cachedExtension,
        loadCachedMock,
        loadRemoteMock,
        cacheInstallMock,
        cacheLoader,
        serverLoader,
      };
    }

    it("should load from local loader", async () => {
      // Given
      const extension = ExtensionBuilder.extensionInfo({ namespace: "local" });
      const loadExtensionMock = jest
        .fn()
        .mockResolvedValue({ raw: defaultSource } as LoadedExtension);
      const loader = createLocalLoader(extension, { loadExtensionMock });

      // When
      const { result } = await setup({ loadersOverride: [loader] });

      // Then
      await waitFor(() => {
        expect(loadExtensionMock).toHaveBeenCalledWith(extension.id);
      });
      expect(result.current.installedExtensions).toEqual([extension]);
    });

    it("should use cached version when cache version is equal to remote", async () => {
      // Given
      const version = "1.2.3";
      const {
        loadCachedMock,
        cacheInstallMock,
        loadRemoteMock,
        extensionId,
        cacheLoader,
        serverLoader,
        cachedExtension,
      } = setupLoaders({
        cachedVersion: version,
        remoteVersion: version,
      });

      // When
      const { result } = await setup({ loadersOverride: [cacheLoader, serverLoader] });

      // Then
      await waitFor(() => {
        expect(loadCachedMock).toHaveBeenCalledWith(extensionId);
      });
      expect(loadRemoteMock).not.toHaveBeenCalled();
      expect(cacheInstallMock).not.toHaveBeenCalled();
      expect(result.current.installedExtensions).toEqual([cachedExtension]);
    });

    it("should use remote version when cache version differs from remote", async () => {
      // Given
      const remoteVersion = "1.2.3";
      const cachedVersion = "1.2.4";
      const buffer = new Uint8Array([BasicBuilder.number()]);
      const {
        loadCachedMock,
        cacheInstallMock,
        loadRemoteMock,
        externalId,
        cacheLoader,
        serverLoader,
        remoteExtension,
      } = setupLoaders({
        cachedVersion,
        remoteVersion,
        buffer,
      });

      // When
      const { result } = await setup({ loadersOverride: [cacheLoader, serverLoader] });

      // Then
      await waitFor(() => {
        expect(loadRemoteMock).toHaveBeenCalledWith(externalId);
      });
      await waitFor(() => {
        expect(cacheInstallMock).toHaveBeenCalledWith({ foxeFileData: buffer });
      });
      expect(loadCachedMock).not.toHaveBeenCalled();
      // When versions differ, use remote version regardless of which is newer
      expect(result.current.installedExtensions).toEqual([remoteExtension]);
    });

    it("should load from remote and update cache when cached version is outdated", async () => {
      // Given
      const remoteVersion = "1.2.4";
      const cachedVersion = "1.2.3";
      const buffer = new Uint8Array([BasicBuilder.number()]);
      const {
        loadCachedMock,
        cacheInstallMock,
        remoteExtension,
        loadRemoteMock,
        externalId,
        cacheLoader,
        serverLoader,
      } = setupLoaders({
        cachedVersion,
        remoteVersion,
        buffer,
      });

      const { result } = await setup({ loadersOverride: [cacheLoader, serverLoader] });

      await waitFor(() => {
        expect(loadRemoteMock).toHaveBeenCalledWith(externalId);
      });
      await waitFor(() => {
        expect(cacheInstallMock).toHaveBeenCalledWith({ foxeFileData: buffer });
      });
      expect(loadCachedMock).not.toHaveBeenCalled();
      expect(result.current.installedExtensions).toEqual([remoteExtension]);
    });

    it("should load from remote when no cached version exists", async () => {
      // Given
      const buffer = new Uint8Array([BasicBuilder.number()]);

      const {
        cacheInstallMock,
        remoteExtension,
        loadRemoteMock,
        externalId,
        cacheLoader,
        serverLoader,
      } = setupLoaders({
        cachedExtension: undefined,
        buffer,
      });

      // when
      const { result } = await setup({ loadersOverride: [cacheLoader, serverLoader] });

      // Then
      await waitFor(() => {
        expect(loadRemoteMock).toHaveBeenCalledWith(externalId);
      });
      await waitFor(() => {
        expect(cacheInstallMock).toHaveBeenCalledWith({ foxeFileData: buffer });
      });
      expect(result.current.installedExtensions).toEqual([remoteExtension]);
    });
  });

  describe("ExtensionCatalogProvider mount — refreshAllExtensions rejects", () => {
    it("should handle error gracefully when refreshAllExtensions rejects on mount", async () => {
      // Given: a getExtensions promise
      let resolveGetExtensions!: (value: ExtensionInfo[]) => void;
      const pendingGetExtensions = new Promise<ExtensionInfo[]>((resolve) => {
        resolveGetExtensions = resolve;
      });
      let shouldThrowOnPerfNow = false;
      const performanceNowSpy = jest.spyOn(performance, "now").mockImplementation(() => {
        if (shouldThrowOnPerfNow) {
          shouldThrowOnPerfNow = false; // only throw once
          throw new Error("test error");
        }
        return 0;
      });
      const loader = createMockLoader({
        namespace: "local",
        type: "browser",
        getExtensions: jest.fn().mockReturnValue(pendingGetExtensions),
      });

      const { result } = renderHook(() => useExtensionCatalog((state) => state), {
        wrapper: ({ children }) => (
          <ExtensionCatalogProvider loaders={[loader]}>{children}</ExtensionCatalogProvider>
        ),
      });

      // When: the getExtensions promise rejects
      shouldThrowOnPerfNow = true;
      resolveGetExtensions([]);

      await act(async () => {
        await new Promise<void>((resolve) => setTimeout(resolve, 50));
      });

      // Then: installedExtensions remains undefined because refreshAllExtensions never
      // reached set({...}) — the error was caught by the useEffect's .catch
      expect(result.current.installedExtensions).toBeUndefined();

      performanceNowSpy.mockRestore();
    });
  });
});
