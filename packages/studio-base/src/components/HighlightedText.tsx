// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as _ from "lodash-es";

/**
 * Renders the given text with the span matching highlight wrapped in a
 * <mark> component.
 */
export function HighlightedText({
  text,
  highlight,
}: {
  text: string;
  highlight?: string;
}): JSX.Element {
  if (!highlight?.trim()) {
    return <span>{text}</span>;
  }
  const regex = new RegExp(`(${_.escapeRegExp(highlight)})`, "gi");
  const parts = text.split(regex);
  return (
    <span>
      {parts
        .filter((part) => part)
        .map((part, i) =>
          regex.test(part) ? <mark key={i}>{part}</mark> : <span key={i}>{part}</span>,
        )}
    </span>
  );
}
