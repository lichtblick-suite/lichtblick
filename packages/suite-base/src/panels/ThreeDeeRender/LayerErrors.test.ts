// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { LayerErrors } from "./LayerErrors";

describe("LayerErrors", () => {
  let layerErrors: LayerErrors;

  beforeEach(() => {
    layerErrors = new LayerErrors();
    // Clear any existing console.warn mocks and expect them in tests
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Clear console.warn calls after each test to prevent test framework from failing
    (console.warn as jest.Mock).mockClear();
  });

  describe("Error Management", () => {
    it("should emit update event when error is added", () => {
      const updateHandler = jest.fn();
      layerErrors.on("update", updateHandler);

      const path = ["topics", "test_topic"];
      const errorId = "TEST_ERROR";
      const errorMessage = "Test error message";

      layerErrors.add(path, errorId, errorMessage);

      expect(updateHandler).toHaveBeenCalledWith(path, errorId, errorMessage);
      // LayerErrors logs warnings for new errors, which is expected behavior
      expect(console.warn).toHaveBeenCalledWith(`[${path.join(" > ")}] ${errorMessage}`);
      (console.warn as jest.Mock).mockClear();
    });

    it("should emit remove event when error is removed", () => {
      const removeHandler = jest.fn();
      layerErrors.on("remove", removeHandler);

      const path = ["topics", "test_topic"];
      const errorId = "TEST_ERROR";
      const errorMessage = "Test error message";

      // Add error first
      layerErrors.add(path, errorId, errorMessage);
      (console.warn as jest.Mock).mockClear();

      // Then remove it
      layerErrors.remove(path, errorId);

      expect(removeHandler).toHaveBeenCalledWith(path, errorId);
    });

    it("should emit clear event when path is cleared", () => {
      const clearHandler = jest.fn();
      layerErrors.on("clear", clearHandler);

      const path = ["topics", "test_topic"];
      const errorId = "TEST_ERROR";
      const errorMessage = "Test error message";

      // Add error first
      layerErrors.add(path, errorId, errorMessage);
      (console.warn as jest.Mock).mockClear();

      // Then clear the path
      layerErrors.clearPath(path);

      expect(clearHandler).toHaveBeenCalledWith(path);
    });

    it("should handle topic-specific errors", () => {
      const updateHandler = jest.fn();
      layerErrors.on("update", updateHandler);

      const topicId = "test_topic";
      const errorId = "TOPIC_ERROR";
      const errorMessage = "Topic error message";

      layerErrors.addToTopic(topicId, errorId, errorMessage);
      (console.warn as jest.Mock).mockClear();

      expect(updateHandler).toHaveBeenCalledWith(["topics", topicId], errorId, errorMessage);
    });

    it("should check if error exists", () => {
      const path = ["topics", "test_topic"];
      const errorId = "TEST_ERROR";
      const errorMessage = "Test error message";

      expect(layerErrors.hasError(path, errorId)).toBe(false);

      layerErrors.add(path, errorId, errorMessage);
      (console.warn as jest.Mock).mockClear();

      expect(layerErrors.hasError(path, errorId)).toBe(true);
    });

    it("should return error message at path", () => {
      const path = ["topics", "test_topic"];
      const errorId = "TEST_ERROR";
      const errorMessage = "Test error message";

      expect(layerErrors.errors.errorAtPath(path)).toBeUndefined();

      layerErrors.add(path, errorId, errorMessage);
      (console.warn as jest.Mock).mockClear();

      expect(layerErrors.errors.errorAtPath(path)).toBe(errorMessage);
    });

    it("should handle multiple errors at same path", () => {
      const path = ["topics", "test_topic"];
      const errorId1 = "ERROR_1";
      const errorId2 = "ERROR_2";
      const errorMessage1 = "First error";
      const errorMessage2 = "Second error";

      layerErrors.add(path, errorId1, errorMessage1);
      layerErrors.add(path, errorId2, errorMessage2);
      (console.warn as jest.Mock).mockClear();

      const combinedMessage = layerErrors.errors.errorAtPath(path);
      expect(combinedMessage).toContain(errorMessage1);
      expect(combinedMessage).toContain(errorMessage2);
    });
  });

  describe("errorIfFalse utility", () => {
    it("should add error when value is false", () => {
      const updateHandler = jest.fn();
      layerErrors.on("update", updateHandler);

      const path = ["test", "path"];
      const errorId = "VALIDATION_ERROR";
      const errorMessage = "Validation failed";

      layerErrors.errorIfFalse(false, path, errorId, errorMessage);
      (console.warn as jest.Mock).mockClear();

      expect(updateHandler).toHaveBeenCalledWith(path, errorId, errorMessage);
    });

    it("should remove error when value is true", () => {
      const removeHandler = jest.fn();
      layerErrors.on("remove", removeHandler);

      const path = ["test", "path"];
      const errorId = "VALIDATION_ERROR";
      const errorMessage = "Validation failed";

      // Add error first
      layerErrors.add(path, errorId, errorMessage);
      (console.warn as jest.Mock).mockClear();

      // Then call errorIfFalse with true
      layerErrors.errorIfFalse(true, path, errorId, errorMessage);

      expect(removeHandler).toHaveBeenCalledWith(path, errorId);
    });
  });
});
