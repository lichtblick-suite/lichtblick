// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import HttpService from "@lichtblick/suite-base/services/http/HttpService";
import { BasicBuilder } from "@lichtblick/test-builders";

import { SourceBundleAPI } from "./SourceBundleAPI";

jest.mock("@lichtblick/suite-base/services/http/HttpService");

describe("SourceBundleAPI", () => {
  let sourceBundleApi: SourceBundleAPI;

  const createMockHttpResponse = <T>(data: T) => ({
    data,
    timestamp: new Date().toISOString(),
    path: "/test",
  });

  beforeEach(() => {
    sourceBundleApi = new SourceBundleAPI();
    jest.clearAllMocks();
  });

  describe("getSourceBundle", () => {
    it("should fetch and return session mcap URLs", async () => {
      const sourceBundleId = BasicBuilder.string();
      const mockMcaps = [
        { url: `https://${BasicBuilder.string()}.com/file1.mcap`, metadata: {} },
        { url: `https://${BasicBuilder.string()}.com/file2.mcap`, metadata: { size: 1024 } },
      ];

      const mockHttpService = jest.mocked(HttpService);
      const mockGet = jest.fn().mockResolvedValue(createMockHttpResponse({ mcaps: mockMcaps }));
      mockHttpService.get = mockGet;

      const result = await sourceBundleApi.getSourceBundle(sourceBundleId);

      expect(mockGet).toHaveBeenCalledWith(
        `source-bundle/${sourceBundleId}`,
        {},
        { signal: undefined },
      );
      expect(result).toEqual({ mcaps: mockMcaps, additionalSources: [] });
    });

    it("should return additional sources when present", async () => {
      const sourceBundleId = BasicBuilder.string();
      const mockMcaps = [{ url: `https://${BasicBuilder.string()}.com/file.mcap`, metadata: {} }];
      const additionalSources = [
        {
          id: "tags",
          topics: [{ name: "Tags", schemaName: "external.tags", messageEncoding: "json" }],
          messages: [],
        },
      ];

      const mockHttpService = jest.mocked(HttpService);
      const mockGet = jest
        .fn()
        .mockResolvedValue(createMockHttpResponse({ mcaps: mockMcaps, additionalSources }));
      mockHttpService.get = mockGet;

      const result = await sourceBundleApi.getSourceBundle(sourceBundleId);

      expect(result).toEqual({ mcaps: mockMcaps, additionalSources });
    });

    it("should handle empty mcaps list", async () => {
      const sourceBundleId = BasicBuilder.string();

      const mockHttpService = jest.mocked(HttpService);
      const mockGet = jest.fn().mockResolvedValue(createMockHttpResponse({ mcaps: [] }));
      mockHttpService.get = mockGet;

      const result = await sourceBundleApi.getSourceBundle(sourceBundleId);

      expect(result).toEqual({ mcaps: [], additionalSources: [] });
    });
  });

  describe("error handling", () => {
    it("should propagate HTTP errors", async () => {
      const sourceBundleId = BasicBuilder.string();
      const mockError = new Error("HTTP Error: 404 Not Found");

      const mockHttpService = jest.mocked(HttpService);
      const mockGet = jest.fn().mockRejectedValue(mockError);
      mockHttpService.get = mockGet;

      await expect(sourceBundleApi.getSourceBundle(sourceBundleId)).rejects.toThrow(
        "HTTP Error: 404 Not Found",
      );
    });
  });
});
