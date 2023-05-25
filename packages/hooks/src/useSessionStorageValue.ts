// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useCallback, useEffect, useState } from "react";

/**
 * This provides a convenience wrapper around sessionStorage and triggers
 * a react state change when values change.
 *
 * @param key sessionStorage key to manage.
 * @returns [value, setValue] tuple for that key.
 */
export function useSessionStorageValue(
  key: string,
): [value: string | undefined, setValue: (newValue: string | undefined) => void] {
  const [value, updateValue] = useState<string | undefined>(
    sessionStorage.getItem(key) ?? undefined,
  );

  const setValue = useCallback(
    (newValue: string | undefined) => {
      // Hack a manual event for now. Unfortunately the browser only fires "storage"
      // events when triggered outside our current tab.
      if (newValue) {
        sessionStorage.setItem(key, newValue);
        window.dispatchEvent(
          new StorageEvent("storage", { key, newValue, storageArea: sessionStorage }),
        );
      } else {
        sessionStorage.removeItem(key);
        window.dispatchEvent(
          new StorageEvent("storage", { key, newValue: undefined, storageArea: sessionStorage }),
        );
      }
    },
    [key],
  );

  const changeListener = useCallback(
    (event: StorageEvent) => {
      if (event.key === key) {
        updateValue(event.newValue ?? undefined);
      }
    },
    [key],
  );

  useEffect(() => {
    window.addEventListener("storage", changeListener);
    return () => window.removeEventListener("storage", changeListener);
  }, [changeListener]);

  return [value ?? undefined, setValue];
}
