// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useRef } from "react";

import Logger from "@foxglove/log";

const log = Logger.getLogger(__filename);

const useMustNotChangeImpl = (value: unknown): void => {
  const valueRef = useRef<unknown>(value);
  if (valueRef.current !== value) {
    log.error("Value must not change", valueRef.current);
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
