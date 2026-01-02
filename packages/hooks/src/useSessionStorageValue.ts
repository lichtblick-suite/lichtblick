// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useCallback, useEffect, useState } from "react";

type SessionStorageValue = [
  value: string | undefined,
  setValue: (newValue: string | undefined) => void,
];

/**
 * This provides a convenience wrapper around sessionStorage and triggers
 * a react state change when values change.
 *
 * @param key sessionStorage key to manage.
 * @returns [value, setValue] tuple for that key.
 */
export function useSessionStorageValue(key: string): SessionStorageValue {
  const prefix: string = process.env.DEV_WORKSPACE ? `${process.env.DEV_WORKSPACE}.` : "";
  const prefixedKey = `${prefix}${key}`;
  const [value, updateValue] = useState<string | undefined>(
    sessionStorage.getItem(prefixedKey) ?? undefined,
  );

  const setValue = useCallback(
    (newValue: string | undefined) => {
      // Hack a manual event for now. Unfortunately the browser only fires "storage"
      // events when triggered outside our current tab.
      if (newValue) {
        sessionStorage.setItem(prefixedKey, newValue);
        window.dispatchEvent(
          new StorageEvent("storage", { key: prefixedKey, newValue, storageArea: sessionStorage }),
        );
      } else {
        sessionStorage.removeItem(prefixedKey);
        window.dispatchEvent(
          new StorageEvent("storage", {
            key: prefixedKey,
            newValue: undefined,
            storageArea: sessionStorage,
          }),
        );
      }
    },
    [prefixedKey],
  );

  const changeListener = useCallback(
    (event: StorageEvent) => {
      if (event.key === prefixedKey) {
        updateValue(event.newValue ?? undefined);
      }
    },
    [prefixedKey],
  );

  useEffect(() => {
    window.addEventListener("storage", changeListener);
    return () => {
      window.removeEventListener("storage", changeListener);
    };
  }, [changeListener]);

  return [value ?? undefined, setValue];
}
