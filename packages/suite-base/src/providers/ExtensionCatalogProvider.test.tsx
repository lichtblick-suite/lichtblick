/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { render, renderHook, waitFor } from "@testing-library/react";
import { useEffect } from "react";

import { PanelSettings } from "@lichtblick/suite";
import { useConfigById } from "@lichtblick/suite-base/PanelAPI";
import Panel from "@lichtblick/suite-base/components/Panel";
import { useExtensionCatalog } from "@lichtblick/suite-base/context/ExtensionCatalogContext";
import { ExtensionLoader } from "@lichtblick/suite-base/services/ExtensionLoader";
import PanelSetup from "@lichtblick/suite-base/stories/PanelSetup";
import { ExtensionInfo } from "@lichtblick/suite-base/types/Extensions";

import ExtensionCatalogProvider from "./ExtensionCatalogProvider";

function fakeExtension(overrides: Partial<ExtensionInfo>): ExtensionInfo {
  return {
    id: "id",
    description: "description",
    displayName: "display name",
    homepage: "homepage",
    keywords: ["keyword1", "keyword2"],
    license: "license",
    name: "name",
    namespace: "local",
    publisher: "publisher",
    qualifiedName: "qualified name",
    version: "1",
    ...overrides,
  };
}

describe("ExtensionCatalogProvider", () => {
  it("should load an extension from the loaders", async () => {
    const source = `
        module.exports = { activate: function() { return 1; } }
    `;

    const loadExtension = jest.fn().mockResolvedValue(source);
    const mockPrivateLoader: ExtensionLoader = {
      namespace: "org",
      getExtensions: jest
        .fn()
        .mockResolvedValue([fakeExtension({ namespace: "org", name: "sample", version: "1" })]),
      loadExtension,
      installExtension: jest.fn(),
      uninstallExtension: jest.fn(),
    };

    const { result } = renderHook(() => useExtensionCatalog((state) => state), {
      initialProps: {},
      wrapper: ({ children }) => (
        <ExtensionCatalogProvider loaders={[mockPrivateLoader]}>
          {children}
        </ExtensionCatalogProvider>
      ),
    });

    await waitFor(() => {
      expect(loadExtension).toHaveBeenCalledTimes(1);
    });
    expect(result.current.installedExtensions).toEqual([
      {
        description: "description",
        displayName: "display name",
        homepage: "homepage",
        id: "id",
        keywords: ["keyword1", "keyword2"],
        license: "license",
        name: "sample",
        namespace: "org",
        publisher: "publisher",
        qualifiedName: "qualified name",
        version: "1",
      },
    ]);
  });

  it("handles extensions with the same id in different loaders", async () => {
    const source1 = `
        module.exports = { activate: function() { return 1; } }
    `;
    const source2 = `
        module.exports = { activate: function() { return 2; } }
    `;

    const loadExtension1 = jest.fn().mockResolvedValue(source1);
    const loadExtension2 = jest.fn().mockResolvedValue(source2);
    const mockPrivateLoader1: ExtensionLoader = {
      namespace: "org",
      getExtensions: jest
        .fn()
        .mockResolvedValue([fakeExtension({ namespace: "org", name: "sample", version: "1" })]),
      loadExtension: loadExtension1,
      installExtension: jest.fn(),
      uninstallExtension: jest.fn(),
    };
    const mockPrivateLoader2: ExtensionLoader = {
      namespace: "org",
      getExtensions: jest
        .fn()
        .mockResolvedValue([fakeExtension({ namespace: "local", name: "sample", version: "2" })]),
      loadExtension: loadExtension2,
      installExtension: jest.fn(),
      uninstallExtension: jest.fn(),
    };

    const { result } = renderHook(() => useExtensionCatalog((state) => state), {
      initialProps: {},
      wrapper: ({ children }) => (
        <ExtensionCatalogProvider loaders={[mockPrivateLoader1, mockPrivateLoader2]}>
          {children}
        </ExtensionCatalogProvider>
      ),
    });

    await waitFor(() => {
      expect(loadExtension1).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(loadExtension2).toHaveBeenCalledTimes(1);
    });
    expect(result.current.installedExtensions).toEqual([
      {
        description: "description",
        displayName: "display name",
        homepage: "homepage",
        id: "id",
        keywords: ["keyword1", "keyword2"],
        license: "license",
        name: "sample",
        namespace: "org",
        publisher: "publisher",
        qualifiedName: "qualified name",
        version: "1",
      },
      {
        description: "description",
        displayName: "display name",
        homepage: "homepage",
        id: "id",
        keywords: ["keyword1", "keyword2"],
        license: "license",
        name: "sample",
        namespace: "local",
        publisher: "publisher",
        qualifiedName: "qualified name",
        version: "2",
      },
    ]);
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
    const mockPrivateLoader: ExtensionLoader = {
      namespace: "org",
      getExtensions: jest
        .fn()
        .mockResolvedValue([fakeExtension({ namespace: "org", name: "sample", version: "1" })]),
      loadExtension,
      installExtension: jest.fn(),
      uninstallExtension: jest.fn(),
    };

    const { result } = renderHook(() => useExtensionCatalog((state) => state), {
      initialProps: {},
      wrapper: ({ children }) => (
        <ExtensionCatalogProvider loaders={[mockPrivateLoader]}>
          {children}
        </ExtensionCatalogProvider>
      ),
    });

    await waitFor(() => {
      expect(loadExtension).toHaveBeenCalledTimes(1);
    });
    expect(result.current.installedMessageConverters).toEqual([
      {
        fromSchemaName: "from.Schema",
        toSchemaName: "to.Schema",
        converter: expect.any(Function),
        extensionNamespace: "org",
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

    const loadExtension = jest.fn().mockResolvedValue(source);
    const mockPrivateLoader: ExtensionLoader = {
      namespace: "org",
      getExtensions: jest
        .fn()
        .mockResolvedValue([fakeExtension({ namespace: "org", name: "sample", version: "1" })]),
      loadExtension,
      installExtension: jest.fn(),
      uninstallExtension: jest.fn(),
    };

    const { result } = renderHook(() => useExtensionCatalog((state) => state), {
      initialProps: {},
      wrapper: ({ children }) => (
        <ExtensionCatalogProvider loaders={[mockPrivateLoader]}>
          {children}
        </ExtensionCatalogProvider>
      ),
    });

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
    const mockPrivateLoader: ExtensionLoader = {
      namespace: "org",
      getExtensions: jest
        .fn()
        .mockResolvedValue([fakeExtension({ namespace: "org", name: "sample", version: "1" })]),
      loadExtension,
      installExtension: jest.fn(),
      uninstallExtension: jest.fn(),
    };

    const { result } = renderHook(() => useExtensionCatalog((state) => state), {
      initialProps: {},
      wrapper: ({ children }) => (
        <ExtensionCatalogProvider loaders={[mockPrivateLoader]}>
          {children}
        </ExtensionCatalogProvider>
      ),
    });

    await waitFor(() => {
      expect(loadExtension).toHaveBeenCalledTimes(1);
    });
    expect(result.current.installedTopicAliasFunctions).toEqual([
      { extensionId: "id", aliasFunction: expect.any(Function) },
    ]);
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
});
