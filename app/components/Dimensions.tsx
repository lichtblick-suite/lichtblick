// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import React, { useEffect, useState, useCallback, ReactElement } from "react";

type DimensionsParams = { height: number; width: number };
type Props =
  | {
      children: (arg0: DimensionsParams) => ReactElement;
    }
  | {
      onChange: (arg0: DimensionsParams) => void;
    };

// Jest does not include ResizeObserver.
class ResizeObserverMock {
  _callback: (arg0: ResizeObserverEntry[]) => void;
  constructor(callback: any) {
    this._callback = callback;
  }

  observe() {
    const entry: any = { contentRect: { width: 150, height: 150 } };
    this._callback([entry]);
  }
  unobserve() {
    // no-op
  }
}
const ResizeObserverImpl =
  process.env.NODE_ENV === "test" ? (ResizeObserverMock as any) : ResizeObserver;

// Calculates the dimensions of the parent element, and passes those dimensions to the child function.
// Uses resizeObserver, which is very performant.
// Works by rendering an empty div, getting the parent element, and then once we know the dimensions of the parent
// element, rendering the children. After the initial render it just observes the parent element.
// We expect the parent element to never change.
// Pass either a children function to automatically re-render when the size changes,
// or an onChange handler to manually handle changes.
export default function Dimensions(props: Props): React.ReactElement | null {
  const [parentElement, setParentElement] = useState<HTMLDivElement | null>(null);
  const [dimensions, setDimensions] = useState<DimensionsParams | undefined>();
  // This resizeObserver should never change.
  const [resizeObserver] = useState<ResizeObserver>(
    () =>
      new ResizeObserverImpl((entries: any) => {
        if (!entries || !entries.length) {
          return;
        }

        // We only observe a single element, so just use the first entry.
        // We have to round because these could be sub-pixel values.
        const width = Math.round(entries[0].contentRect.width);
        const height = Math.round(entries[0].contentRect.height);
        if ("onChange" in props) {
          props.onChange({ width, height });
        } else {
          setDimensions({ width, height });
        }
      }),
  );

  // This should only fire once, because `dimensions` should only be undefined at the beginning.
  const setParentElementRef = useCallback((element) => {
    if (element) {
      setParentElement(element.parentElement);
    }
  }, []);

  useEffect(() => {
    if (!parentElement) {
      return;
    }
    resizeObserver.observe(parentElement);
    // Make sure to unobserve when we unmount the component.
    return () => resizeObserver.unobserve(parentElement);
  }, [parentElement, resizeObserver]);

  // This only happens during the first render - we use it to grab the parentElement of this div.
  if (dimensions == undefined) {
    return <div ref={setParentElementRef} />;
  }
  if ("children" in props && typeof props.children === "function") {
    return props.children(dimensions);
  }
  return null;
}
