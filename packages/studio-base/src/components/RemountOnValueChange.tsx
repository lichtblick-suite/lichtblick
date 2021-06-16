// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { PropsWithChildren, useCallback } from "react";

/**
 * RemountOnValueChange will unmount and remount the children when _value_ changes.
 * This is used when you want to "reset" the component tree for a specific value change.
 *
 * Note: Use sparingly and prefer hook dependencies to manage state updates. This should be a
 * last resort nuclear option when you think that an entire subtree should be purged.
 */
export default function RemountOnValueChange(
  props: PropsWithChildren<{ value: unknown }>,
): JSX.Element {
  // When the value changes, useCallback will create a new component by returning a new
  // function instance. Since this is a completely new component it will remount its entire tree.
  const Parent = useCallback(
    ({ children }: PropsWithChildren<unknown>) => {
      void props.value; // to suppress eslint complaining about the value in the deps list
      return <>{children}</>;
    },
    [props.value],
  );

  return <Parent>{props.children}</Parent>;
}
