// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { useCallback, useEffect } from "react";

import { SettingsTreeAction } from "@lichtblick/suite";
import { FONT_SIZE_OPTIONS } from "@lichtblick/suite-base/panels/RawMessagesCommon/constants";
import { usePanelSettingsTreeUpdate } from "@lichtblick/suite-base/providers/PanelStateContextProvider";

/**
 * Hook to manage font size settings in the panel settings tree.
 * Provides a reusable way to handle font size configuration for Raw Messages panels.
 *
 * @param fontSize - Current font size value (undefined for "auto")
 * @param saveConfig - Function to save the font size configuration
 */
export function useFontSizeSettings(
  fontSize: number | undefined,
  saveConfig: (config: { fontSize: number | undefined }) => void,
): void {
  const updatePanelSettingsTree = usePanelSettingsTreeUpdate();

  const actionHandler = useCallback(
    (action: SettingsTreeAction) => {
      if (
        action.action === "update" &&
        action.payload.path[0] === "general" &&
        action.payload.path[1] === "fontSize"
      ) {
        saveConfig({
          fontSize:
            action.payload.value == undefined ? undefined : (action.payload.value as number),
        });
      }
    },
    [saveConfig],
  );

  useEffect(() => {
    updatePanelSettingsTree({
      actionHandler,
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
  }, [actionHandler, fontSize, updatePanelSettingsTree]);
}
