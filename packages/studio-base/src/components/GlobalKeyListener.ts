// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.
import { useCallback, useEffect } from "react";

import { useCurrentLayoutActions } from "@foxglove/studio-base/context/CurrentLayoutContext";

const inNativeUndoRedoElement = (eventTarget?: EventTarget) => {
  if (eventTarget instanceof HTMLTextAreaElement) {
    // eslint-disable-next-line no-restricted-syntax
    let element: Element | null | undefined = eventTarget;
    // It's not always convenient to set the data property on the textarea itself, but we can set
    // it on a nearby ancestor.
    while (element) {
      if (element instanceof HTMLElement && element.dataset.nativeundoredo != undefined) {
        return true;
      }
      element = element.parentElement;
    }
  }
  return false;
};

export default function GlobalKeyListener(): ReactNull {
  const { undoLayoutChange, redoLayoutChange } = useCurrentLayoutActions();
  const keyDownHandler: (arg0: KeyboardEvent) => void = useCallback(
    (e) => {
      const target = e.target;

      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        // The user is typing in an editable field; ignore the event.
        return;
      }

      const lowercaseEventKey = e.key.toLowerCase();

      if (!(e.ctrlKey || e.metaKey)) {
        return;
      }
      if (lowercaseEventKey === "z") {
        // Shortcuts for undo/redo. Note that undo/redo actions are also handled in App.tsx where
        // they can be connected to the Edit menu items.

        // Don't use ctrl-Z for layout history actions inside the Monaco Editor. It isn't
        // controlled, and changes inside it don't result in updates to the layout history. We could
        // consider making the editor controlled, with a separate "unsaved state".
        if (inNativeUndoRedoElement(e.target ?? undefined)) {
          return;
        }

        // Use e.shiftKey instead of e.key to decide between undo and redo because of capslock.
        e.stopPropagation();
        e.preventDefault();
        if (e.shiftKey) {
          redoLayoutChange();
        } else {
          undoLayoutChange();
        }
      }
    },
    [undoLayoutChange, redoLayoutChange],
  );

  // Not using KeyListener because we want to preventDefault on [ctrl+z] but not on [z], and we want
  // to handle events when text areas have focus.
  useEffect(() => {
    document.addEventListener("keydown", keyDownHandler);
    return () => document.removeEventListener("keydown", keyDownHandler);
  }, [keyDownHandler]);

  return ReactNull;
}
