/** @jest-environment jsdom */
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { renderHook } from "@testing-library/react-hooks";

import { useExtensionCatalog } from "@foxglove/studio-base/context/ExtensionCatalogContext";
import { ExtensionLoader } from "@foxglove/studio-base/services/ExtensionLoader";
import { ExtensionInfo } from "@foxglove/studio-base/types/Extensions";

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

    const { result, waitFor } = renderHook(() => useExtensionCatalog((state) => state), {
      initialProps: {},
      wrapper: ({ children }) => (
        <ExtensionCatalogProvider loaders={[mockPrivateLoader]}>
          {children}
        </ExtensionCatalogProvider>
      ),
    });

    await waitFor(() => expect(loadExtension).toHaveBeenCalledTimes(1));
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

    const { result, waitFor } = renderHook(() => useExtensionCatalog((state) => state), {
      initialProps: {},
      wrapper: ({ children }) => (
        <ExtensionCatalogProvider loaders={[mockPrivateLoader]}>
          {children}
        </ExtensionCatalogProvider>
      ),
    });

    await waitFor(() => expect(loadExtension).toHaveBeenCalledTimes(1));
    expect(result.current.installedMessageConverters).toEqual([
      {
        fromSchemaName: "from.Schema",
        toSchemaName: "to.Schema",
        converter: expect.any(Function),
      },
    ]);
  });
});
