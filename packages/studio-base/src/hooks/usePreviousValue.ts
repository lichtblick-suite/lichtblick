// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2019-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { useContext, useRef } from "react";

import PanelContext from "@foxglove/studio-base/components/PanelContext";

/**
 * @deprecated With React Strict Mode enabled, components' render functions will be called twice in
 * dev mode. This means the value returned by usePreviousValue may not actually be the value from
 * the previous committed render.
 */
export function usePreviousValue<T>(nextValue: T): T | undefined {
  const { supportsStrictMode = false, type } = useContext(PanelContext) ?? {};
  const warned = useRef(false);
  if (supportsStrictMode && !warned.current) {
    warned.current = true;
    console.error(
      `usePreviousValue used in a panel (${type}) with React Strict Mode enabled. This is probably a bug!`,
    );
  }
  const ref = useRef<T | undefined>(undefined);
  const previous = ref.current;
  ref.current = nextValue;
  return previous;
}
