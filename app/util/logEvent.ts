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

// This is a much more complex way of doing a "hook", behavior split between open-source and proprietary.
// We do it this way so that we can change the hook behavior in workers, and so we don't have to include all of the
// javascript from the hooks in each worker.

export type Tags = {
  readonly [key: string]: (string | boolean | number | string[] | number[]) | undefined;
};

let eventNames: { readonly [key: string]: string } | undefined;
let eventTags: { readonly [key: string]: string } | undefined;

// We can't set the event names/tags in a web worker because that would require creating a different worker for every
// proprietary / open source worker. Just throw an error in a worker.

export function getEventNames(): {
  readonly [key: string]: string;
} {
  if (eventNames == undefined) {
    throw new Error(
      "Tried to get event names before they were set or tried to get event names in a web worker",
    );
  }
  return eventNames;
}
export function getEventTags(): {
  readonly [key: string]: string;
} {
  if (eventTags == undefined) {
    throw new Error(
      "Tried to get event tags before they were set or tried to get event tags in a web worker",
    );
  }
  return eventTags;
}

let logEventImpl: ((arg0: { name: string; tags: Tags }) => void) | undefined = undefined;

export function initializeLogEvent(
  initialLogEvent: (arg0: { name: string; tags: Tags }) => void,
  initialEventNames?: Record<string, string>,
  initialEventTags?: Record<string, string>,
) {
  if (logEventImpl && process.env.NODE_ENV !== "test") {
    throw new Error("logEvent has already been set, it can only be set once");
  }
  logEventImpl = initialLogEvent;
  if (initialEventNames) {
    eventNames = initialEventNames;
  }
  if (initialEventTags) {
    eventTags = initialEventTags;
  }
}

export default function logEvent(params: { name: string; tags: Tags }) {
  if (!logEventImpl) {
    throw new Error("logEvent has been called but it has not yet been initialized");
  }
  logEventImpl(params);
}

export function resetLogEventForTests() {
  logEventImpl = () => {
    // no-op
  };
  eventNames = {};
  eventTags = {};
}
