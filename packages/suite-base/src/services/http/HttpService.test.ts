// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { HttpError } from "./HttpError";
import { HttpService } from "./HttpService";

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock APP_CONFIG
jest.mock("@lichtblick/suite-base/constants", () => ({
  APP_CONFIG: {
    apiUrl: "https://api.example.com",
  },
}));

/**
 * Tests for HttpService class
 */
describe("HttpService", () => {
  let httpService: HttpService;

  beforeEach(() => {
    httpService = new HttpService();
    mockFetch.mockClear();
    jest.clearAllTimers();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("constructor", () => {
    it("should initialize with base URL from APP_CONFIG", () => {
      expect(httpService).toBeInstanceOf(HttpService);
    });
  });

  describe("GET requests", () => {
    it("should make a successful GET request", async () => {
      const mockResponse = {
        data: { id: 1, name: "Test" },
        timestamp: "2023-01-01",
        path: "/test",
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: {
          get: jest.fn().mockReturnValue("application/json"),
        },
        json: jest.fn().mockResolvedValueOnce(mockResponse),
      });

      const result = await httpService.get("test");

      expect(mockFetch).toHaveBeenCalledWith("https://api.example.com/test?", {
        headers: {
          "Content-Type": "application/json",
          "Api-Version": "1.0",
        },
        method: "GET",
      });
      expect(result).toEqual(mockResponse);
    });

    it("should handle GET request with query parameters", async () => {
      const mockResponse = { data: [], timestamp: "2023-01-01", path: "/users" };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: {
          get: jest.fn().mockReturnValue("application/json"),
        },
        json: jest.fn().mockResolvedValueOnce(mockResponse),
      });

      await httpService.get("users", { page: "1", limit: "10" });

      expect(mockFetch).toHaveBeenCalledWith("https://api.example.com/users?page=1&limit=10", {
        headers: {
          "Content-Type": "application/json",
          "Api-Version": "1.0",
        },
        method: "GET",
      });
    });
  });

  describe("POST requests", () => {
    it("should make a successful POST request with data", async () => {
      const requestData = { name: "New Item" };
      const mockResponse = {
        data: { id: 2, name: "New Item" },
        timestamp: "2023-01-01",
        path: "/items",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        statusText: "Created",
        headers: {
          get: jest.fn().mockReturnValue("application/json"),
        },
        json: jest.fn().mockResolvedValueOnce(mockResponse),
      });

      const result = await httpService.post("items", requestData);

      expect(mockFetch).toHaveBeenCalledWith("https://api.example.com/items", {
        headers: {
          "Content-Type": "application/json",
          "Api-Version": "1.0",
        },
        method: "POST",
        body: JSON.stringify(requestData),
      });
      expect(result).toEqual(mockResponse);
    });

    it("should make POST request without data", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: {
          get: jest.fn().mockReturnValue("application/json"),
        },
        json: jest.fn().mockResolvedValueOnce({ data: "success" }),
      });

      await httpService.post("action");

      expect(mockFetch).toHaveBeenCalledWith("https://api.example.com/action", {
        headers: {
          "Content-Type": "application/json",
          "Api-Version": "1.0",
        },
        method: "POST",
        body: undefined,
      });
    });
  });

  describe("PUT requests", () => {
    it("should make a successful PUT request", async () => {
      const updateData = { id: 1, name: "Updated Item" };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: {
          get: jest.fn().mockReturnValue("application/json"),
        },
        json: jest.fn().mockResolvedValueOnce({ data: updateData }),
      });

      await httpService.put("items/1", updateData);

      expect(mockFetch).toHaveBeenCalledWith("https://api.example.com/items/1", {
        headers: {
          "Content-Type": "application/json",
          "Api-Version": "1.0",
        },
        method: "PUT",
        body: JSON.stringify(updateData),
      });
    });
  });

  describe("DELETE requests", () => {
    it("should make a successful DELETE request", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        statusText: "No Content",
        headers: {
          get: jest.fn().mockReturnValue("application/json"),
        },
        json: jest.fn().mockResolvedValueOnce({}),
      });

      await httpService.delete("items/1");

      expect(mockFetch).toHaveBeenCalledWith("https://api.example.com/items/1", {
        headers: {
          "Content-Type": "application/json",
          "Api-Version": "1.0",
        },
        method: "DELETE",
      });
    });
  });

  describe("error handling", () => {
    it("should handle JSON parsing errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: {
          get: jest.fn().mockReturnValue("application/json"),
        },
        json: jest.fn().mockRejectedValueOnce(new Error("Invalid JSON")),
        text: jest.fn().mockResolvedValueOnce("invalid json"),
      });

      await expect(httpService.get("test")).rejects.toThrow(HttpError);
    });
  });

  describe("custom headers", () => {
    it("should merge custom headers with default headers", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: {
          get: jest.fn().mockReturnValue("application/json"),
        },
        json: jest.fn().mockResolvedValueOnce({ data: "test" }),
      });

      await httpService.get(
        "test",
        {},
        {
          headers: {
            Authorization: "Bearer token123",
            "Custom-Header": "custom-value",
          },
        },
      );

      expect(mockFetch).toHaveBeenCalledWith("https://api.example.com/test?", {
        headers: {
          "Content-Type": "application/json",
          "Api-Version": "1.0",
          Authorization: "Bearer token123",
          "Custom-Header": "custom-value",
        },
        method: "GET",
      });
    });
  });
});
