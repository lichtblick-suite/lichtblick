/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { renderHook } from "@testing-library/react";

import { SettingsTreeAction } from "@lichtblick/suite";
import { FONT_SIZE_OPTIONS } from "@lichtblick/suite-base/panels/RawMessagesCommon/constants";
import { useFontSizeSettings } from "@lichtblick/suite-base/panels/RawMessagesCommon/useFontSizeSettings";
import { usePanelSettingsTreeUpdate } from "@lichtblick/suite-base/providers/PanelStateContextProvider";

jest.mock("@lichtblick/suite-base/providers/PanelStateContextProvider", () => ({
  usePanelSettingsTreeUpdate: jest.fn(),
}));

describe("useFontSizeSettings", () => {
  const mockUpdatePanelSettingsTree = jest.fn();
  const mockSaveConfig = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (usePanelSettingsTreeUpdate as jest.Mock).mockReturnValue(mockUpdatePanelSettingsTree);
  });

  describe("when initializing the hook", () => {
    it("should call updatePanelSettingsTree with correct structure", () => {
      // Given
      const fontSize = 14;

      // When
      renderHook(() => {
        useFontSizeSettings(fontSize, mockSaveConfig);
      });

      // Then
      expect(mockUpdatePanelSettingsTree).toHaveBeenCalledWith({
        actionHandler: expect.any(Function),
        nodes: {
          general: {
            label: "General",
            fields: {
              fontSize: {
                label: "Font size",
                input: "select",
                options: [
                  { label: "auto", value: undefined },
                  ...FONT_SIZE_OPTIONS.map((value) => ({
                    label: `${value} px`,
                    value,
                  })),
                ],
                value: fontSize,
              },
            },
          },
        },
      });
    });

    it("should handle undefined fontSize (auto)", () => {
      // Given
      const fontSize = undefined;

      // When
      renderHook(() => {
        useFontSizeSettings(fontSize, mockSaveConfig);
      });

      // Then
      expect(mockUpdatePanelSettingsTree).toHaveBeenCalledWith(
        expect.objectContaining({
          nodes: {
            general: {
              label: "General",
              fields: {
                fontSize: expect.objectContaining({
                  value: undefined,
                }),
              },
            },
          },
        }),
      );
    });
  });

  describe("when handling actions", () => {
    it("should save fontSize when update action is received", () => {
      // Given
      const fontSize = 12;
      renderHook(() => {
        useFontSizeSettings(fontSize, mockSaveConfig);
      });
      const actionHandler = mockUpdatePanelSettingsTree.mock.calls[0]?.[0]?.actionHandler as (
        action: SettingsTreeAction,
      ) => void;

      const action = {
        action: "update",
        payload: {
          path: ["general", "fontSize"],
          value: 16,
          input: "select",
        },
      } as SettingsTreeAction;

      // When
      actionHandler(action);

      // Then
      expect(mockSaveConfig).toHaveBeenCalledWith({ fontSize: 16 });
    });

    it("should save undefined fontSize when value is undefined (auto)", () => {
      // Given
      const fontSize = 14;
      renderHook(() => {
        useFontSizeSettings(fontSize, mockSaveConfig);
      });
      const actionHandler = mockUpdatePanelSettingsTree.mock.calls[0]?.[0]?.actionHandler as (
        action: SettingsTreeAction,
      ) => void;

      const action = {
        action: "update",
        payload: {
          path: ["general", "fontSize"],
          value: undefined,
          input: "select",
        },
      } as SettingsTreeAction;

      // When
      actionHandler(action);

      // Then
      expect(mockSaveConfig).toHaveBeenCalledWith({ fontSize: undefined });
    });

    it("should not save fontSize for non-general paths", () => {
      // Given
      const fontSize = 14;
      renderHook(() => {
        useFontSizeSettings(fontSize, mockSaveConfig);
      });
      const actionHandler = mockUpdatePanelSettingsTree.mock.calls[0]?.[0]?.actionHandler as (
        action: SettingsTreeAction,
      ) => void;

      const action = {
        action: "update",
        payload: {
          path: ["other", "fontSize"],
          value: 16,
          input: "select",
        },
      } as SettingsTreeAction;

      // When
      actionHandler(action);

      // Then
      expect(mockSaveConfig).not.toHaveBeenCalled();
    });

    it("should not save fontSize for non-fontSize fields", () => {
      // Given
      const fontSize = 14;
      renderHook(() => {
        useFontSizeSettings(fontSize, mockSaveConfig);
      });
      const actionHandler = mockUpdatePanelSettingsTree.mock.calls[0]?.[0]?.actionHandler as (
        action: SettingsTreeAction,
      ) => void;

      const action = {
        action: "update",
        payload: {
          path: ["general", "otherField"],
          value: "test",
          input: "string",
        },
      } as SettingsTreeAction;

      // When
      actionHandler(action);

      // Then
      expect(mockSaveConfig).not.toHaveBeenCalled();
    });

    it("should not handle non-update actions", () => {
      // Given
      const fontSize = 14;
      renderHook(() => {
        useFontSizeSettings(fontSize, mockSaveConfig);
      });
      const actionHandler = mockUpdatePanelSettingsTree.mock.calls[0]?.[0]?.actionHandler as (
        action: SettingsTreeAction,
      ) => void;

      const action = {
        action: "perform-node-action",
        payload: {
          id: "test",
          path: ["general", "fontSize"],
        },
      } as SettingsTreeAction;

      // When
      actionHandler(action);

      // Then
      expect(mockSaveConfig).not.toHaveBeenCalled();
    });
  });

  describe("when fontSize changes", () => {
    it("should update settings tree with new fontSize value", () => {
      // Given
      const { rerender } = renderHook<void, { fontSize: number | undefined }>(
        ({ fontSize }) => {
          useFontSizeSettings(fontSize, mockSaveConfig);
        },
        {
          initialProps: { fontSize: 12 },
        },
      );

      expect(mockUpdatePanelSettingsTree).toHaveBeenCalledTimes(1);

      // When
      rerender({ fontSize: 16 });

      // Then
      expect(mockUpdatePanelSettingsTree).toHaveBeenCalledTimes(2);
      expect(mockUpdatePanelSettingsTree).toHaveBeenLastCalledWith(
        expect.objectContaining({
          nodes: {
            general: {
              label: "General",
              fields: {
                fontSize: expect.objectContaining({
                  value: 16,
                }),
              },
            },
          },
        }),
      );
    });
  });
});
