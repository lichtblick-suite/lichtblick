// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { MutableRefObject, useCallback, useEffect, useState } from "react";

import { PANEL_ROOT_CLASS_NAME } from "@foxglove/studio-base/components/PanelRoot";

/**
 * Tracks the presence of the mouse in the parent panel.
 *
 * @param ref The element to hide and show on panel hove
 * @returns True if the mouse is currently within the parent panel.
 */
export function usePanelMousePresence(ref: MutableRefObject<HTMLElement | ReactNull>): boolean {
  const [present, setPresent] = useState(false);

  const listener = useCallback(
    (ev: MouseEvent) => {
      if (!ref.current) {
        return;
      }

      if (ev.type === "mouseenter") {
        setPresent(true);
      } else {
        setPresent(false);
      }
    },
    [ref],
  );

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    const parent: HTMLElement | ReactNull = element.closest(`.${PANEL_ROOT_CLASS_NAME}`);
    parent?.addEventListener("mouseenter", listener);
    parent?.addEventListener("mouseleave", listener);

    return () => {
      parent?.removeEventListener("mouseenter", listener);
      parent?.removeEventListener("mouseleave", listener);
    };
  }, [ref, listener]);

  return present;
}
