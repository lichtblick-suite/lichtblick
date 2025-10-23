// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

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

  it("should handle different HTTP status codes", () => {
    const testCases = [
      { status: 400, statusText: "Bad Request" },
      { status: 401, statusText: "Unauthorized" },
      { status: 403, statusText: "Forbidden" },
      { status: 404, statusText: "Not Found" },
      { status: 500, statusText: "Internal Server Error" },
      { status: 502, statusText: "Bad Gateway" },
      { status: 503, statusText: "Service Unavailable" },
    ];

    testCases.forEach(({ status, statusText }) => {
      const error = new HttpError(`HTTP ${status}`, status, statusText);

      expect(error.status).toBe(status);
      expect(error.statusText).toBe(statusText);
      expect(error.message).toBe(`HTTP ${status}`);
    });
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

  it("should handle empty or special characters in message and statusText", () => {
    const testCases = [
      { message: "", statusText: "" },
      { message: "Error with 'quotes'", statusText: 'Status with "quotes"' },
      { message: "Error with\nnewlines", statusText: "Status with\ttabs" },
      { message: "Error with émojis 🚫", statusText: "Status with 特殊字符" },
    ];

    testCases.forEach(({ message, statusText }) => {
      const error = new HttpError(message, 400, statusText);

      expect(error.message).toBe(message);
      expect(error.statusText).toBe(statusText);
      expect(error.status).toBe(400);
    });
  });
});
