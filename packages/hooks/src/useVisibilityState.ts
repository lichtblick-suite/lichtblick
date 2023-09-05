// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import { useState, useEffect } from "react";

/** Returns the value of `document.visibilityState` and tracks changes. */
export default function useVisibilityState(): DocumentVisibilityState {
  const [visibility, setVisibility] = useState(document.visibilityState);
  useEffect(() => {
    // Update if state changed between the initial call and this effect
    setVisibility(document.visibilityState);

    const listener = () => {
      setVisibility(document.visibilityState);
    };
    document.addEventListener("visibilitychange", listener);
    return () => {
      document.removeEventListener("visibilitychange", listener);
    };
  }, []);
  return visibility;
}
