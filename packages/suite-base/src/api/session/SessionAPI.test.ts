// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import HttpService from "@lichtblick/suite-base/services/http/HttpService";
import { BasicBuilder } from "@lichtblick/test-builders";

import { SessionAPI } from "./SessionAPI";

jest.mock("@lichtblick/suite-base/services/http/HttpService");

describe("SessionAPI", () => {
  let sessionApi: SessionAPI;

  const createMockHttpResponse = <T>(data: T) => ({
    data,
    timestamp: new Date().toISOString(),
    path: "/test",
  });

  beforeEach(() => {
    sessionApi = new SessionAPI();
    jest.clearAllMocks();
  });

  describe("getSession", () => {
    it("should fetch and return session mcap URLs", async () => {
      const sessionId = BasicBuilder.string();
      const mockMcaps = [
        { url: `https://${BasicBuilder.string()}.com/file1.mcap`, metadata: {} },
        { url: `https://${BasicBuilder.string()}.com/file2.mcap`, metadata: { size: 1024 } },
      ];

      const mockHttpService = jest.mocked(HttpService);
      const mockGet = jest.fn().mockResolvedValue(createMockHttpResponse({ mcaps: mockMcaps }));
      mockHttpService.get = mockGet;

      const result = await sessionApi.getSession(sessionId);

      expect(mockGet).toHaveBeenCalledWith(`session/${sessionId}`, {}, { signal: undefined });
      expect(result).toEqual(mockMcaps);
    });

    it("should handle empty mcaps list", async () => {
      const sessionId = BasicBuilder.string();

      const mockHttpService = jest.mocked(HttpService);
      const mockGet = jest.fn().mockResolvedValue(createMockHttpResponse({ mcaps: [] }));
      mockHttpService.get = mockGet;

      const result = await sessionApi.getSession(sessionId);

      expect(result).toEqual([]);
    });
  });

  describe("error handling", () => {
    it("should propagate HTTP errors", async () => {
      const sessionId = BasicBuilder.string();
      const mockError = new Error("HTTP Error: 404 Not Found");

      const mockHttpService = jest.mocked(HttpService);
      const mockGet = jest.fn().mockRejectedValue(mockError);
      mockHttpService.get = mockGet;

      await expect(sessionApi.getSession(sessionId)).rejects.toThrow("HTTP Error: 404 Not Found");
    });
  });
});
