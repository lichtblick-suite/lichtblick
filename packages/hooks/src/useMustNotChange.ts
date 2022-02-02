// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useRef } from "react";

const useMustNotChangeImpl = (value: unknown): void => {
  const valueRef = useRef<unknown | undefined>(value);
  if (valueRef.current !== value) {
    throw new Error("Value must not change");
  }
  valueRef.current = value;
};

const noOpImpl = () => {};

/**
 * useMustNotChange throws if the value provided as the first argument ever changes.
 *
 * Note: In production builds this hook is a no-op.
 *
 */
const useMustNotChange = process.env.NODE_ENV !== "development" ? noOpImpl : useMustNotChangeImpl;

export default useMustNotChange;

// for tests
export { useMustNotChangeImpl };
