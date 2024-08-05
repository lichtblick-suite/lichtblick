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

import { ReactElement, useCallback, useEffect, useRef } from "react";

// Invoke handler for matching key.
// By default, preventDefault() is invoked on the event. Return false to allow the default.
type KeyHandlers = Record<string, (event: KeyboardEvent) => void | boolean | undefined>;

type Props = {
  global?: boolean;
  keyDownHandlers?: KeyHandlers;
  keyPressHandlers?: KeyHandlers;
  keyUpHandlers?: KeyHandlers;
};

function callHandlers(handlers: KeyHandlers | undefined, event: KeyboardEvent): void {
  if (!handlers) {
    return;
  }

  const handler = handlers[event.key] ?? handlers[event.code];

  if (typeof handler === "function") {
    let preventDefault = true;
    try {
      preventDefault = handler(event) ?? true;
    } finally {
      if (preventDefault) {
        event.preventDefault();
      }
    }
  }
}

export default function KeyListener(props: Props): ReactElement {
  const element = useRef<HTMLDivElement>(ReactNull);

  const handleEvent = useCallback(
    (event: Event) => {
      if (!(event instanceof KeyboardEvent)) {
        return;
      }
      const { target, type } = event;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        // The user is typing in an editable field; ignore the event.
        return;
      }

      switch (type) {
        case "keydown":
          callHandlers(props.keyDownHandlers, event);
          break;
        case "keypress":
          callHandlers(props.keyPressHandlers, event);
          break;
        case "keyup":
          callHandlers(props.keyUpHandlers, event);
          break;
        default:
          break;
      }
    },
    [props.keyDownHandlers, props.keyPressHandlers, props.keyUpHandlers],
  );

  useEffect(() => {
    const target = props.global === true ? document : element.current?.parentElement;

    target?.addEventListener("keydown", handleEvent);
    target?.addEventListener("keypress", handleEvent);
    target?.addEventListener("keyup", handleEvent);

    return () => {
      target?.removeEventListener("keydown", handleEvent);
      target?.removeEventListener("keypress", handleEvent);
      target?.removeEventListener("keyup", handleEvent);
    };
  }, [handleEvent, props.global]);

  return <div style={{ display: "none" }} ref={element} />;
}
