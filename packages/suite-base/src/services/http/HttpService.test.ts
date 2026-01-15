// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { BasicBuilder } from "@lichtblick/test-builders";

import { HttpError } from "./HttpError";
import { HttpService } from "./HttpService";

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock APP_CONFIG
jest.mock("@lichtblick/suite-base/constants/config", () => ({
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
        credentials: "same-origin",
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
        credentials: "same-origin",
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
        credentials: "same-origin",
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
        credentials: "same-origin",
        body: undefined,
      });
    });

    it("should make POST request with FormData", async () => {
      const formData = new FormData();
      formData.append("file", BasicBuilder.string());
      formData.append("name", "test-file.txt");

      const mockResponse = {
        data: { id: 3, filename: "test-file.txt", uploaded: true },
        timestamp: BasicBuilder.string(),
        path: "/upload",
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

      const result = await httpService.post("upload", formData);

      expect(mockFetch).toHaveBeenCalledWith("https://api.example.com/upload", {
        headers: {
          "Api-Version": "1.0",
        },
        method: "POST",
        credentials: "same-origin",
        body: formData,
      });
      expect(result).toEqual(mockResponse);
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
        credentials: "same-origin",
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
        credentials: "same-origin",
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

    it("should handle 400 Bad Request errors", async () => {
      const errorResponse = {
        error: "Bad Request",
        message: "Invalid parameters",
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        headers: {
          get: jest.fn().mockReturnValue("application/json"),
        },
        json: jest.fn().mockResolvedValueOnce(errorResponse),
        text: jest.fn().mockResolvedValueOnce(JSON.stringify(errorResponse)),
      });

      const errorPromise = httpService.get("test");
      await expect(errorPromise).rejects.toThrow(HttpError);

      await expect(errorPromise).rejects.toMatchObject({
        status: 400,
        statusText: "Bad Request",
      });
    });

    it("should handle 401 Unauthorized errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        headers: {
          get: jest.fn().mockReturnValue("application/json"),
        },
        json: jest.fn().mockResolvedValueOnce({ error: "Unauthorized" }),
        text: jest.fn().mockResolvedValueOnce("Unauthorized"),
      });

      await expect(httpService.post("protected-resource")).rejects.toThrow(HttpError);
    });

    it("should handle 403 Forbidden errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: "Forbidden",
        headers: {
          get: jest.fn().mockReturnValue("application/json"),
        },
        json: jest.fn().mockResolvedValueOnce({ error: "Access denied" }),
        text: jest.fn().mockResolvedValueOnce("Access denied"),
      });

      await expect(httpService.delete("forbidden-resource")).rejects.toThrow(HttpError);
    });

    it("should handle 404 Not Found errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        headers: {
          get: jest.fn().mockReturnValue("application/json"),
        },
        json: jest.fn().mockResolvedValueOnce({ error: "Resource not found" }),
        text: jest.fn().mockResolvedValueOnce("Not Found"),
      });

      await expect(httpService.get("nonexistent")).rejects.toThrow(HttpError);
    });

    it("should handle 500 Internal Server Error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        headers: {
          get: jest.fn().mockReturnValue("application/json"),
        },
        json: jest.fn().mockRejectedValueOnce(new Error("Invalid JSON")),
        text: jest.fn().mockResolvedValueOnce("Internal Server Error"),
      });

      await expect(httpService.put("server-error", { data: "test" })).rejects.toThrow(HttpError);
    });

    it("should handle network errors", async () => {
      const networkError = new Error("Network request failed");
      mockFetch.mockRejectedValueOnce(networkError);

      await expect(httpService.get("test")).rejects.toThrow("Network request failed");
    });

    it("should handle timeout errors", async () => {
      const abortError = new Error("The operation was aborted");
      abortError.name = "AbortError";
      mockFetch.mockRejectedValueOnce(abortError);

      await expect(httpService.get("slow-endpoint", {}, { timeout: 1000 })).rejects.toThrow(
        "Network error: The operation was aborted",
      );
    });

    it("should handle AbortController signal timeout", async () => {
      const abortError = new Error("The operation was aborted");
      abortError.name = "AbortError";
      mockFetch.mockRejectedValueOnce(abortError);

      await expect(httpService.get("test", {}, { timeout: 5000 })).rejects.toThrow(
        "The operation was aborted",
      );
    });

    it("should handle non-JSON response content types", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        headers: {
          get: jest.fn().mockReturnValue("text/plain"),
        },
        json: jest.fn().mockRejectedValueOnce(new Error("Not JSON")),
        text: jest.fn().mockResolvedValueOnce("Plain text error message"),
      });

      const errorPromise = httpService.get("test");
      await expect(errorPromise).rejects.toThrow(HttpError);
      await expect(errorPromise).rejects.toMatchObject({
        status: 400,
      });
    });

    it("should handle empty error responses", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: "Service Unavailable",
        headers: {
          get: jest.fn().mockReturnValue("application/json"),
        },
        json: jest.fn().mockRejectedValueOnce(new Error("No content")),
        text: jest.fn().mockResolvedValueOnce(""),
      });

      await expect(httpService.get("unavailable")).rejects.toThrow(HttpError);
    });

    it("should handle malformed JSON in error response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        statusText: "Unprocessable Entity",
        headers: {
          get: jest.fn().mockReturnValue("application/json"),
        },
        json: jest.fn().mockRejectedValueOnce(new Error("Unexpected token")),
        text: jest.fn().mockResolvedValueOnce("{ invalid json"),
      });

      await expect(httpService.post("invalid", { data: "test" })).rejects.toThrow(HttpError);
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
        credentials: "same-origin",
      });
    });

    it("should allow overriding default headers", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: {
          get: jest.fn().mockReturnValue("application/json"),
        },
        json: jest.fn().mockResolvedValueOnce({
          data: "file uploaded",
          timestamp: "2023-01-01",
          path: "/upload",
        }),
      });

      await httpService.post("upload", "file data", {
        headers: {
          "Content-Type": "text/plain",
          "Api-Version": "2.0",
        },
      });

      expect(mockFetch).toHaveBeenCalledWith("https://api.example.com/upload", {
        headers: {
          "Content-Type": "text/plain",
          "Api-Version": "2.0",
        },
        method: "POST",
        body: JSON.stringify("file data"),
        credentials: "same-origin",
      });
    });
  });

  describe("request options", () => {
    it("should handle custom timeout option", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: {
          get: jest.fn().mockReturnValue("application/json"),
        },
        json: jest.fn().mockResolvedValueOnce({ data: "success" }),
      });

      await httpService.get("test", {}, { timeout: 5000 });

      // Verify that fetch was called (timeout logic would be handled internally)
      expect(mockFetch).toHaveBeenCalled();
    });

    it("should handle additional fetch options", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: {
          get: jest.fn().mockReturnValue("application/json"),
        },
        json: jest.fn().mockResolvedValueOnce({ data: "success" }),
      });

      await httpService.get(
        "test",
        {},
        {
          cache: "no-cache",
          redirect: "follow",
          referrer: "client",
        },
      );

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.example.com/test?",
        expect.objectContaining({
          cache: "no-cache",
          redirect: "follow",
          referrer: "client",
        }),
      );
    });

    it("should include credentials: same-origin in all requests", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: {
          get: jest.fn().mockReturnValue("application/json"),
        },
        json: jest.fn().mockResolvedValueOnce({ data: "success" }),
      });

      await httpService.get("test");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.example.com/test?",
        expect.objectContaining({
          credentials: "same-origin",
        }),
      );
    });
  });

  describe("response handling", () => {
    it("should handle successful responses with different status codes", async () => {
      const testCases = [
        { status: 200, statusText: "OK" },
        { status: 201, statusText: "Created" },
        { status: 202, statusText: "Accepted" },
        { status: 204, statusText: "No Content" },
      ];

      for (const testCase of testCases) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: testCase.status,
          statusText: testCase.statusText,
          headers: {
            get: jest.fn().mockReturnValue("application/json"),
          },
          json: jest.fn().mockResolvedValueOnce({
            data: { success: true },
            timestamp: "2023-01-01",
            path: "/test",
          }),
        });

        const result = await httpService.get("test");
        expect(result.data).toEqual({ success: true });
        mockFetch.mockClear();
      }
    });

    it("should handle empty successful responses", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        statusText: "No Content",
        headers: {
          get: jest.fn().mockReturnValue("application/json"),
        },
        json: jest.fn().mockResolvedValueOnce({
          data: undefined,
          timestamp: "2023-01-01",
          path: "/resource",
        }),
      });

      const result = await httpService.delete("resource");
      expect(result.data).toBeUndefined();
    });

    it("should handle responses with different content types", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: {
          get: jest.fn().mockReturnValue("text/plain"),
        },
        text: jest.fn().mockResolvedValueOnce("plain text response"),
      });

      const result = await httpService.get("text-endpoint");
      expect(result.data).toBe("plain text response");
      expect(result.timestamp).toBeDefined();
      expect(result.path).toBe("text-endpoint?");
    });

    it("should handle ArrayBuffer responses", async () => {
      const mockArrayBuffer = new ArrayBuffer(8);
      const view = new Uint8Array(mockArrayBuffer);
      view[0] = 72; // 'H'
      view[1] = 101; // 'e'
      view[2] = 108; // 'l'
      view[3] = 108; // 'l'
      view[4] = 111; // 'o'

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: {
          get: jest.fn().mockReturnValue("application/octet-stream"),
        },
        arrayBuffer: jest.fn().mockResolvedValueOnce(mockArrayBuffer),
      });

      const result = await httpService.get("binary-data", {}, { responseType: "arraybuffer" });

      expect(result.data).toBe(mockArrayBuffer);
      expect(result.timestamp).toBeDefined();
      expect(result.path).toBe("binary-data?");
      expect(result.data).toBeInstanceOf(ArrayBuffer);
      expect((result.data as ArrayBuffer).byteLength).toBe(8);
    });
  });

  describe("URL construction", () => {
    it("should handle endpoints with leading slash", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: {
          get: jest.fn().mockReturnValue("application/json"),
        },
        json: jest.fn().mockResolvedValueOnce({ data: "test" }),
      });

      await httpService.get("/api/users");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.example.com//api/users?",
        expect.any(Object),
      );
    });

    it("should handle empty query parameters", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: {
          get: jest.fn().mockReturnValue("application/json"),
        },
        json: jest.fn().mockResolvedValueOnce({ data: "test" }),
      });

      await httpService.get("test", {});

      expect(mockFetch).toHaveBeenCalledWith("https://api.example.com/test?", expect.any(Object));
    });

    it("should handle undefined query parameters", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: {
          get: jest.fn().mockReturnValue("application/json"),
        },
        json: jest.fn().mockResolvedValueOnce({ data: "test" }),
      });

      await httpService.get("test", undefined);

      expect(mockFetch).toHaveBeenCalledWith("https://api.example.com/test?", expect.any(Object));
    });

    it("should handle special characters in query parameters", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: {
          get: jest.fn().mockReturnValue("application/json"),
        },
        json: jest.fn().mockResolvedValueOnce({ data: "test" }),
      });

      await httpService.get("search", {
        query: "hello world & more",
        filter: "type=user|admin",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.example.com/search?query=hello+world+%26+more&filter=type%3Duser%7Cadmin",
        expect.any(Object),
      );
    });
  });
});
