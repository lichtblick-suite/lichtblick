// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

const TOPIC_PREFIX_REGEX = /^.+\/(?=.)/;

/**
 * Get a prefix of the given `topic` which can be used to match against related image, calibration, or annotation topics.
 *
 * Matches everything up to the last `/` in a topic name, e.g. `getTopicMatchPrefix("/a/b/c")` returns `"/a/b/"`.
 */
export function getTopicMatchPrefix(topic: string): string | undefined {
  return TOPIC_PREFIX_REGEX.exec(topic)?.[0];
}

/**
 * Sort the given `array` so items for which `key(item)` matches the prefix of the given `imageTopic` are at the beginning.
 */
export function sortPrefixMatchesToFront<T>(
  array: T[],
  imageTopic: string,
  key: (item: T) => string,
): void {
  const prefix = getTopicMatchPrefix(imageTopic);
  if (prefix == undefined) {
    return;
  }
  array.sort((a, b) => {
    const matchesA = key(a).startsWith(prefix);
    const matchesB = key(b).startsWith(prefix);
    return matchesA === matchesB ? 0 : matchesA ? -1 : 1;
  });
}
