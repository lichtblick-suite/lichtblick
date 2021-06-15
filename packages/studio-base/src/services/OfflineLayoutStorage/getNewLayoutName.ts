// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

/**
 * Determine a name under which to save a new layout. The given name will be used, but if it would
 * conflict with an existing name, a number will be appended.
 */
export default function getNewLayoutName(
  desiredName: string,
  existingNames: ReadonlySet<string>,
): string {
  let namePrefix = desiredName;
  let counter = 0;
  const match = desiredName.match(/^(.+)\s(\d+)$/);
  if (match) {
    namePrefix = match[1]!;
    counter = parseInt(match[2]!);
  }
  let name = desiredName;
  while (existingNames.has(name)) {
    counter++;
    name = `${namePrefix} ${counter}`;
  }
  return name;
}
