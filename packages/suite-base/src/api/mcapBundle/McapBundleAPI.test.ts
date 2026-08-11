// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import HttpService from "@lichtblick/suite-base/services/http/HttpService";
import { BasicBuilder } from "@lichtblick/test-builders";

import { McapBundleAPI } from "./McapBundleAPI";

jest.mock("@lichtblick/suite-base/services/http/HttpService");

describe("McapBundleAPI", () => {
  let mcapBundleApi: McapBundleAPI;

  const createMockHttpResponse = <T>(data: T) => ({
    data,
    timestamp: new Date().toISOString(),
    path: "/test",
  });

  beforeEach(() => {
    mcapBundleApi = new McapBundleAPI();
    jest.clearAllMocks();
  });

  describe("getMcapBundle", () => {
    it("should fetch and return session mcap URLs", async () => {
      const mcapBundleId = BasicBuilder.string();
      const mockMcaps = [
        { url: `https://${BasicBuilder.string()}.com/file1.mcap`, metadata: {} },
        { url: `https://${BasicBuilder.string()}.com/file2.mcap`, metadata: { size: 1024 } },
      ];

      const mockHttpService = jest.mocked(HttpService);
      const mockGet = jest.fn().mockResolvedValue(createMockHttpResponse({ mcaps: mockMcaps }));
      mockHttpService.get = mockGet;

      const result = await mcapBundleApi.getMcapBundle(mcapBundleId);

      expect(mockGet).toHaveBeenCalledWith(
        `mcap-bundle/${mcapBundleId}`,
        {},
        { signal: undefined },
      );
      expect(result).toEqual(mockMcaps);
    });

    it("should handle empty mcaps list", async () => {
      const mcapBundleId = BasicBuilder.string();

      const mockHttpService = jest.mocked(HttpService);
      const mockGet = jest.fn().mockResolvedValue(createMockHttpResponse({ mcaps: [] }));
      mockHttpService.get = mockGet;

      const result = await mcapBundleApi.getMcapBundle(mcapBundleId);

      expect(result).toEqual([]);
    });
  });

  describe("error handling", () => {
    it("should propagate HTTP errors", async () => {
      const mcapBundleId = BasicBuilder.string();
      const mockError = new Error("HTTP Error: 404 Not Found");

      const mockHttpService = jest.mocked(HttpService);
      const mockGet = jest.fn().mockRejectedValue(mockError);
      mockHttpService.get = mockGet;

      await expect(mcapBundleApi.getMcapBundle(mcapBundleId)).rejects.toThrow(
        "HTTP Error: 404 Not Found",
      );
    });
  });
});
