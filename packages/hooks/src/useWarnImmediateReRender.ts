// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import { useLayoutEffect, useRef } from "react";

import Log from "@foxglove/log";

const log = Log.getLogger(__filename);

// useWarnImmediateReRender will warn if the component re-renders before the next animation frame
// This typically indicates that the component state is changing in rapid succession and more
// work is being done than necessary.
//
// Note: This detects state change triggers in useLayoutEffect. It does not detect state changes from
// useEffect which run on the next animation frame.
const useWarnImmediateReRender =
  process.env.NODE_ENV !== "development"
    ? () => {}
    : () => {
        const renderedRef = useRef(false);
        useLayoutEffect(() => {
          if (renderedRef.current) {
            log.warn("Component re-rendered immediately");
          }
          renderedRef.current = true;
          const raf = requestAnimationFrame(() => {
            renderedRef.current = false;
          });
          return () => {
            cancelAnimationFrame(raf);
          };
        });
      };

export default useWarnImmediateReRender;
