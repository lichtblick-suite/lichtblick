// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ReactNode } from "react";
import tinycolor from "tinycolor2";

import { filterMap } from "@foxglove/den/collection";
import { isTypicalFilterName } from "@foxglove/studio-base/components/MessagePathSyntax/isTypicalFilterName";
import { format, formatDuration } from "@foxglove/studio-base/util/formatTime";
import { quatToEuler } from "@foxglove/studio-base/util/quatToEuler";

const DURATION_20_YEARS_SEC = 20 * 365 * 24 * 60 * 60;

const PRIMITIVE_TYPES = ["string", "number", "bigint", "boolean"];

export function getItemString(
  _nodeType: string,
  data: unknown,
  itemType: ReactNode,
  itemString: string,
  _keyPath: (string | number)[],
  timezone?: string,
): ReactNode {
  if (typeof data !== "object" || data == undefined) {
    return (
      <span>
        {itemType} {itemString}
      </span>
    );
  }

  const keys = Object.keys(data);
  if (keys.length === 2) {
    const { sec, nsec } = data as { sec?: number; nsec?: number };
    if (typeof sec === "number" && typeof nsec === "number") {
      // Values "too small" to be absolute epoch-based times are probably relative durations.
      return sec < DURATION_20_YEARS_SEC ? (
        formatDuration({ sec, nsec })
      ) : (
        <span>{format({ sec, nsec }, timezone)}</span>
      );
    }
  }

  // for vectors/points display length
  if (keys.length === 2) {
    const { x, y } = data as { x?: unknown; y?: unknown };
    if (typeof x === "number" && typeof y === "number") {
      const length = Math.sqrt(x * x + y * y);
      return (
        <span>
          norm = {length.toFixed(2)} {getArrow(x, y)}
        </span>
      );
    }

    const { key, value } = data as { key?: unknown; value?: unknown };
    if (
      key != undefined &&
      value != undefined &&
      PRIMITIVE_TYPES.includes(typeof key) &&
      PRIMITIVE_TYPES.includes(typeof value)
    ) {
      // eslint-disable-next-line @typescript-eslint/no-base-to-string
      return `${key}: ${value}`;
    }
  } else if (keys.length === 3) {
    const { x, y, z } = data as { x?: unknown; y?: unknown; z?: unknown };
    if (typeof x === "number" && typeof y === "number" && typeof z === "number") {
      const length = Math.sqrt(x * x + y * y + z * z);
      return (
        <span>
          norm = {length.toFixed(2)} {z === 0 ? getArrow(x, y) : undefined}
        </span>
      );
    }
  } else if (keys.length === 4) {
    const { x, y, z, w } = data as { x?: unknown; y?: unknown; z?: unknown; w?: unknown };
    if (
      typeof x === "number" &&
      typeof y === "number" &&
      typeof z === "number" &&
      typeof w === "number"
    ) {
      const [roll, pitch, yaw] = quatToEuler(x, y, z, w);
      return (
        <span>
          rpy = [{round(roll)}, {round(pitch)}, {round(yaw)}]
        </span>
      );
    }

    const { r, g, b, a } = data as { r?: unknown; g?: unknown; b?: unknown; a?: unknown };
    if (
      typeof r === "number" &&
      typeof g === "number" &&
      typeof b === "number" &&
      typeof a === "number"
    ) {
      // print the color as hex
      return <span>{tinycolor({ r: r * 255, g: g * 255, b: b * 255, a }).toHex8String()}</span>;
    }
  }

  // Surface typically-used keys directly in the object summary so the user doesn't have to expand it.
  const filterKeys = filterMap(keys, (key) => {
    const value = (data as Record<string, unknown>)[key];
    if (
      isTypicalFilterName(key) &&
      (value == undefined || PRIMITIVE_TYPES.includes(typeof value))
    ) {
      return `${key}: ${value}`;
    }
    return undefined;
  }).join(", ");
  return (
    <span>
      {itemType} {filterKeys.length > 0 ? filterKeys : itemString}
    </span>
  );
}

function getArrow(x: number, y: number) {
  if (x === 0 && y === 0) {
    return;
  }
  return (
    <span style={{ transform: `rotate(${Math.atan2(-y, x)}rad)`, display: "inline-block" }}>→</span>
  );
}

function round(x: number, precision = 2): number {
  return Number(x.toFixed(precision));
}
