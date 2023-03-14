// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import Logger from "@foxglove/log";

const log = Logger.getLogger(__filename);

type RendererArgTypes = {
  deepLinks: string[];
};

/**
 * Encode arguments passed from main to renderer process using base64,
 * to avoid breaking on Windows when the values contain special characters like ":".
 *
 * https://github.com/foxglove/studio/issues/4896
 * https://github.com/electron/electron/issues/32064
 * https://github.com/electron/electron/issues/31168
 */
export function encodeRendererArg<K extends keyof RendererArgTypes>(
  argName: K,
  value: RendererArgTypes[K],
): string {
  return `--${argName}=${btoa(JSON.stringify(value)!)}`;
}

export function decodeRendererArg<K extends keyof RendererArgTypes>(
  argName: K,
  args: string[],
): RendererArgTypes[K] | undefined {
  const argPrefix = `--${argName}=`;
  const argValue = args.find((str) => str.startsWith(argPrefix))?.substring(argPrefix.length);
  try {
    return argValue ? JSON.parse(atob(argValue)) : undefined;
  } catch (error) {
    log.error(error);
    return undefined;
  }
}
