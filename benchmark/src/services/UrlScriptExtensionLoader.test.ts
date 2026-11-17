// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { PERF_HUD_EXTENSION_INFO, UrlScriptExtensionLoader } from "./UrlScriptExtensionLoader";

describe("UrlScriptExtensionLoader", () => {
  const url = "http://127.0.0.1:8090/perf-hud.js";
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("should list only the configured extension in the local namespace", async () => {
    // Given
    const loader = new UrlScriptExtensionLoader(url, PERF_HUD_EXTENSION_INFO);

    // When
    const extensions = await loader.getExtensions();

    // Then
    expect(extensions).toEqual([{ ...PERF_HUD_EXTENSION_INFO, namespace: "local" }]);
    await expect(loader.getExtension("other")).resolves.toBeUndefined();
  });

  it("should return the fetched script as the raw extension source", async () => {
    // Given
    const source = "module.exports = { activate() {} };";
    global.fetch = jest.fn().mockResolvedValue({ ok: true, text: async () => source });
    const loader = new UrlScriptExtensionLoader(url, PERF_HUD_EXTENSION_INFO);

    // When
    const loaded = await loader.loadExtension(PERF_HUD_EXTENSION_INFO.id);

    // Then
    expect(global.fetch).toHaveBeenCalledWith(url);
    expect(loaded).toEqual({ raw: source });
  });

  it("should throw when the script cannot be fetched", async () => {
    // Given
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404, statusText: "Not Found" });
    const loader = new UrlScriptExtensionLoader(url, PERF_HUD_EXTENSION_INFO);

    // When / Then
    await expect(loader.loadExtension(PERF_HUD_EXTENSION_INFO.id)).rejects.toThrow("404");
  });

  it("should reject installs and uninstalls", async () => {
    // Given
    const loader = new UrlScriptExtensionLoader(url, PERF_HUD_EXTENSION_INFO);

    // When / Then
    await expect(loader.installExtension()).rejects.toThrow("read-only");
    await expect(loader.uninstallExtension()).rejects.toThrow("read-only");
  });
});
