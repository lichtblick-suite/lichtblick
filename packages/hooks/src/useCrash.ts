// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useReducer } from "react";

// Throwing in a reducer call will make the error catchable by an error boundary.
function reducer(_: unknown, err: Error) {
  throw err;
}

/**
 * useCrash returns a function you can call with an Error instance and it will re-throw the instance
 * within the react loop allowing a react error boundary to handle the error.
 *
 * See: https://reactjs.org/docs/error-boundaries.html#how-about-event-handlers
 */
export function useCrash(): (err: Error) => void {
  const [, dispatch] = useReducer(reducer, undefined);
  return dispatch;
}
