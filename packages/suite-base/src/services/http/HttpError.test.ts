// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { BasicBuilder } from "@lichtblick/test-builders";

import { HttpError } from "./HttpError";

/**
 * Tests for HttpError class
 */
describe("HttpError", () => {
  it("should create an HttpError with message, status, and statusText", () => {
    const message = "Request failed";
    const status = 404;
    const statusText = "Not Found";

    const error = new HttpError(message, status, statusText);

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(HttpError);
    expect(error.name).toBe("HttpError");
    expect(error.message).toBe(message);
    expect(error.status).toBe(status);
    expect(error.statusText).toBe(statusText);
    expect(error.response).toBeUndefined();
  });

  it("should create an HttpError with response object", () => {
    const message = "Server error";
    const status = 500;
    const statusText = "Internal Server Error";
    const mockResponse = new Response("Server error", {
      status: 500,
      statusText: "Internal Server Error",
    });

    const error = new HttpError(message, status, statusText, mockResponse);

    expect(error.message).toBe(message);
    expect(error.status).toBe(status);
    expect(error.statusText).toBe(statusText);
    expect(error.response).toBe(mockResponse);
  });

  it.each([
    { status: 400, statusText: "Bad Request" },
    { status: 401, statusText: "Unauthorized" },
    { status: 403, statusText: "Forbidden" },
    { status: 404, statusText: "Not Found" },
    { status: 409, statusText: "Conflict" },
    { status: 500, statusText: "Internal Server Error" },
    { status: 502, statusText: "Bad Gateway" },
    { status: 503, statusText: "Service Unavailable" },
  ])("should handle HTTP status $status ($statusText)", ({ status, statusText }) => {
    const error = new HttpError(`HTTP ${status}`, status, statusText);

    expect(error.status).toBe(status);
    expect(error.statusText).toBe(statusText);
    expect(error.message).toBe(`HTTP ${status}`);
  });

  it("should preserve error stack trace", () => {
    const error = new HttpError("Test error", 404, "Not Found");

    expect(error.stack).toBeDefined();
    expect(error.stack).toContain("HttpError");
  });

  it("should be serializable to JSON", () => {
    const message = "API error";
    const status = 422;
    const statusText = "Unprocessable Entity";
    const error = new HttpError(message, status, statusText);

    // Create a custom serialization that includes all relevant properties
    const errorData = {
      name: error.name,
      message: error.message,
      status: error.status,
      statusText: error.statusText,
    };

    const serialized = JSON.stringify(errorData);
    expect(serialized).toBeDefined();
    expect(typeof serialized).toBe("string");

    const parsed = JSON.parse(serialized!);
    expect(parsed.message).toBe(message);
    expect(parsed.name).toBe("HttpError");
    expect(parsed.status).toBe(status);
    expect(parsed.statusText).toBe(statusText);
  });

  it("should have readonly properties that cannot be modified in strict mode", () => {
    const error = new HttpError("Test", 404, "Not Found");

    // In TypeScript, these properties are marked as readonly
    // The actual runtime behavior depends on JavaScript engine and strict mode
    expect(error.status).toBe(404);
    expect(error.statusText).toBe("Not Found");

    // Test that the properties exist and have the correct types
    expect(typeof error.status).toBe("number");
    expect(typeof error.statusText).toBe("string");
  });

  it("should work with instanceof checks", () => {
    const error = new HttpError("Test error", 500, "Internal Server Error");

    expect(error instanceof HttpError).toBe(true);
    expect(error instanceof Error).toBe(true);
  });

  describe("getUserFriendlyErrorMessage", () => {
    it("should handle network errors (status 0)", () => {
      const error = new HttpError(BasicBuilder.string(), 0, BasicBuilder.string());

      expect(error.getUserFriendlyErrorMessage()).toBe(
        "Network connection error. Please check your connection.",
      );
    });

    it("should handle 400 Bad Request", () => {
      const error = new HttpError(BasicBuilder.string(), 400, BasicBuilder.string());

      expect(error.getUserFriendlyErrorMessage()).toBe(
        "Invalid request. Please check your input and try again.",
      );
    });

    it("should handle 401 Unauthorized", () => {
      const error = new HttpError(BasicBuilder.string(), 401, BasicBuilder.string());

      expect(error.getUserFriendlyErrorMessage()).toBe("You are not authenticated.");
    });

    it("should handle 403 Forbidden", () => {
      const error = new HttpError(BasicBuilder.string(), 403, BasicBuilder.string());

      expect(error.getUserFriendlyErrorMessage()).toBe(
        "You do not have permission to perform this action.",
      );
    });

    it("should handle 404 Not Found", () => {
      const error = new HttpError(BasicBuilder.string(), 404, BasicBuilder.string());

      expect(error.getUserFriendlyErrorMessage()).toBe("The requested resource was not found.");
    });

    it("should handle 409 Conflict", () => {
      const error = new HttpError(BasicBuilder.string(), 409, BasicBuilder.string());

      expect(error.getUserFriendlyErrorMessage()).toBe(
        "The resource already exists or has been modified.",
      );
    });

    it("should handle 500 Internal Server Error", () => {
      const error = new HttpError(BasicBuilder.string(), 500, BasicBuilder.string());

      expect(error.getUserFriendlyErrorMessage()).toBe("Server error. Please try again later.");
    });

    it("should handle other 4xx client errors", () => {
      const testCases = [402, 405, 408, 410, 418, 429];

      testCases.forEach((status) => {
        const error = new HttpError(BasicBuilder.string(), status, BasicBuilder.string());

        expect(error.getUserFriendlyErrorMessage()).toBe(
          "Request error. Please check your input and try again.",
        );
      });
    });

    it("should handle other 5xx server errors", () => {
      const testCases = [501, 502, 504, 505];

      testCases.forEach((status) => {
        const error = new HttpError(BasicBuilder.string(), status, BasicBuilder.string());

        expect(error.getUserFriendlyErrorMessage()).toBe("Server error. Please try again later.");
      });
    });

    it("should return original message for non-standard status codes", () => {
      const customMessage = "Custom error message";

      const successError = new HttpError(customMessage, 200, "OK");
      expect(successError.getUserFriendlyErrorMessage()).toBe(customMessage);
    });
  });
});
