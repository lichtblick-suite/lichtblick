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

import { makeStyles } from "@fluentui/react";
import cx from "classnames";

type Props = React.PropsWithChildren<{
  className?: string;
  style?: React.CSSProperties;
}>;

const useStyles = makeStyles((theme) => ({
  container: {
    backgroundColor: theme.semanticColors.menuBackground,
    borderRadius: 4,
    padding: 0,
    boxShadow: theme.effects.elevation64,
    overflow: "hidden",
    pointerEvents: "auto",
    flexShrink: 0,
    minWidth: 50,
    flex: "0 0 auto",
    overflowY: "auto",
    maxHeight: "100%",

    hr: {
      padding: 0,
      backgroundColor: theme.semanticColors.bodyDivider,
    },
    a: {
      textDecoration: "none",
    },
  },
}));

// a small component which wraps its children in menu styles
// and provides a helper { Item } component which can be used
// to render typical menu items with text & an icon
export default function Menu({
  className,
  style,
  children,
}: React.PropsWithChildren<Props>): JSX.Element {
  const styles = useStyles();
  return (
    <div className={cx(styles.container, className)} style={style}>
      {children}
    </div>
  );
}
