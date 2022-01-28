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

// Custom formatters for Chrome dev tools. See documentation: http://bit.ly/object-formatters
// Note that the "Enable custom formatters" setting must be turned on in order to use these formatters.

import seedrandom from "seedrandom";

import { isTime } from "@foxglove/rostime";
import { mightActuallyBePartial } from "@foxglove/studio-base/util/mightActuallyBePartial";

type HtmlTemplate = unknown;
type DevtoolFormatterConfig = {
  key: unknown;
};

interface DevtoolFormatter {
  header: (object: Record<string, unknown>, config: DevtoolFormatterConfig) => HtmlTemplate;
  hasBody: (object: unknown) => boolean;
  body?: (object: Record<string, unknown>) => HtmlTemplate;
}

declare global {
  interface Window {
    devtoolsFormatters: DevtoolFormatter[];
  }
}

// eslint-disable-next-line no-restricted-syntax
const USE_DEFAULT_FORMATTER = null;

const timeFormatter: DevtoolFormatter = (() => {
  function groupDigits(str: string) {
    const result = ["span", {}];
    let start = 0;
    let end = str.length % 3;
    if (end === 0) {
      end = 3;
    }
    while (start < str.length) {
      result.push([
        "span",
        { style: end < str.length ? "margin-right: 2px;" : "" },
        str.substring(start, end),
      ]);
      start = end;
      end += 3;
    }
    return result;
  }

  const formatter: DevtoolFormatter = {
    header(obj) {
      const maybeTime = obj as {
        sec: number;
        nsec: number;
      };
      if (
        !isTime(obj) ||
        maybeTime.sec < 0 ||
        maybeTime.nsec < 0 ||
        maybeTime.nsec >= 1e9 ||
        !Number.isInteger(maybeTime.sec) ||
        !Number.isInteger(maybeTime.nsec)
      ) {
        return USE_DEFAULT_FORMATTER;
      }
      const nsec = maybeTime.nsec.toFixed().padStart(9, "0");
      const rng = seedrandom(`${maybeTime.sec}.${nsec}`);
      return [
        "span",
        { style: `color: hsl(${rng() * 360}deg, ${40 + rng() * 60}%, ${20 + rng() * 40}%);` },
        groupDigits(String(maybeTime.sec)),
        ".",
        groupDigits(nsec),
      ];
    },
    hasBody() {
      return false;
    },
  };

  return formatter;
})();

export default function installDevtoolsFormatters(): void {
  window.devtoolsFormatters = mightActuallyBePartial(window).devtoolsFormatters ?? [];
  window.devtoolsFormatters.push(timeFormatter);
}
