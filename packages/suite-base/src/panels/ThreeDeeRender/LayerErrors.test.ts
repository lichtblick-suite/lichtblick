// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import BasicBuilder from "@lichtblick/suite-base/testing/builders/BasicBuilder";

import { LayerErrors } from "./LayerErrors";

describe("LayerErrors", () => {
  let layerErrors: LayerErrors;
  const errorId = BasicBuilder.string();
  const errorMessage = BasicBuilder.string();
  const topicId = BasicBuilder.string();

  beforeEach(() => {
    layerErrors = new LayerErrors();
    jest.clearAllMocks();
  });

  afterEach(() => {
    (console.warn as jest.Mock).mockClear();
  });

  describe("Error Management", () => {
    it("should emit update event when error is added", () => {
      const updateHandler = jest.fn();
      layerErrors.on("update", updateHandler);

      const path = ["topics", topicId];

      layerErrors.add(path, errorId, errorMessage);

      expect(updateHandler).toHaveBeenCalledWith(path, errorId, errorMessage);

      // LayerErrors logs warnings for new errors
      expect(console.warn).toHaveBeenCalledWith(`[${path.join(" > ")}] ${errorMessage}`);
    });

    it("should emit remove event when error is removed", () => {
      const removeHandler = jest.fn();
      layerErrors.on("remove", removeHandler);

      const path = ["topics", topicId];

      // Add error first
      layerErrors.add(path, errorId, errorMessage);

      // Then remove it
      layerErrors.remove(path, errorId);

      expect(removeHandler).toHaveBeenCalledWith(path, errorId);
    });

    it("should emit clear event when path is cleared", () => {
      const clearHandler = jest.fn();
      layerErrors.on("clear", clearHandler);

      const path = ["topics", topicId];

      layerErrors.add(path, errorId, errorMessage);

      layerErrors.clearPath(path);

      expect(clearHandler).toHaveBeenCalledWith(path);
    });

    it("should handle topic-specific errors", () => {
      const updateHandler = jest.fn();
      layerErrors.on("update", updateHandler);

      layerErrors.addToTopic(topicId, errorId, errorMessage);

      expect(updateHandler).toHaveBeenCalledWith(["topics", topicId], errorId, errorMessage);
    });

    it("should check if error exists", () => {
      const path = ["topics", topicId];

      expect(layerErrors.hasError(path, errorId)).toBe(false);

      layerErrors.add(path, errorId, errorMessage);

      expect(layerErrors.hasError(path, errorId)).toBe(true);
    });

    it("should return error message at path", () => {
      const path = ["topics", topicId];

      expect(layerErrors.errors.errorAtPath(path)).toBeUndefined();

      layerErrors.add(path, errorId, errorMessage);

      expect(layerErrors.errors.errorAtPath(path)).toBe(errorMessage);
    });

    it("should handle multiple errors at same path", () => {
      const path = ["topics", topicId];
      const errorId1 = BasicBuilder.string();
      const errorId2 = BasicBuilder.string();
      const errorMessage1 = BasicBuilder.string();
      const errorMessage2 = BasicBuilder.string();

      layerErrors.add(path, errorId1, errorMessage1);
      layerErrors.add(path, errorId2, errorMessage2);

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

      layerErrors.errorIfFalse(false, path, errorId, errorMessage);

      expect(updateHandler).toHaveBeenCalledWith(path, errorId, errorMessage);
    });

    it("should remove error when value is true", () => {
      const removeHandler = jest.fn();
      layerErrors.on("remove", removeHandler);

      const path = ["test", "path"];

      // Add error first
      layerErrors.add(path, errorId, errorMessage);

      // Then call errorIfFalse with true
      layerErrors.errorIfFalse(true, path, errorId, errorMessage);

      expect(removeHandler).toHaveBeenCalledWith(path, errorId);
    });
  });
});
