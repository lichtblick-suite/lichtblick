// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useMemo } from "react";
import { makeStyles } from "tss-react/mui";

type Props = {
  str: string;
  indices: Set<number>;
  offset?: number;
};

const useStyles = makeStyles()({
  root: { whiteSpace: "pre" },
});

/**
 * Renders the given text with the characters highlighted text wrapped in a
 * <mark> component for Fzf results. The indices are the positions of the
 * matched characters in the original string.
 *
 * Optionally, an offset can be provided to account for the fact that the search
 * string may be a substring of the original string.
 */
export function HighlightChars(props: Props): JSX.Element {
  const { str, indices, offset = 0 } = props;
  const { classes } = useStyles();

  const nodes = useMemo(() => {
    return str.split("").map((char, i) => {
      if (indices.has(i + offset)) {
        return <mark key={i}>{char}</mark>;
      }
      return char;
    });
  }, [indices, offset, str]);

  return <span className={classes.root}>{nodes}</span>;
}
