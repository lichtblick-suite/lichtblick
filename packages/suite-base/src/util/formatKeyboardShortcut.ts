// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

type ModifierKeys = "Meta" | "Control" | "Alt" | "Shift";

export function formatKeyboardShortcut(key: string, modifiers: ModifierKeys[]): string {
  const isMac = navigator.userAgent.includes("Mac");

  return [
    ...modifiers.map((modifier) => {
      switch (modifier) {
        case "Meta":
          return isMac ? "⌘" : "Ctrl";
        case "Control":
          return isMac ? "⌃" : "Ctrl";
        case "Alt":
          return isMac ? "⌥" : "Alt";
        case "Shift":
          return isMac ? "⇧" : "Shift";
      }
    }),
    key,
  ].join(isMac ? "" : "+");
}
