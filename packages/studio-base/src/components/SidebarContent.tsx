// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Typography } from "@mui/material";
import { CSSProperties, Fragment, PropsWithChildren } from "react";
import { makeStyles } from "tss-react/mui";

import Stack from "@foxglove/studio-base/components/Stack";

const useStyles = makeStyles()((theme) => ({
  leadingItems: {
    display: "flex",
    alignItems: "center",
    marginLeft: theme.spacing(-1),
    gap: theme.spacing(0.5),
  },
  toolbar: {
    minHeight: 56,
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    padding: theme.spacing(2),
    gap: theme.spacing(0.5),
  },
}));

export function SidebarContent({
  disablePadding = false,
  title,
  children,
  leadingItems,
  overflow = "auto",
  trailingItems,
}: PropsWithChildren<SidebarContentProps>): JSX.Element {
  const { classes } = useStyles();

  return (
    <Stack overflow={overflow} fullHeight flex="auto" gap={1}>
      <div className={classes.toolbar}>
        {leadingItems != undefined && (
          <div className={classes.leadingItems}>
            {leadingItems.map((item, i) => (
              <Fragment key={i}>{item}</Fragment>
            ))}
          </div>
        )}
        <Typography component="h2" variant="h4" fontWeight={800} flex="auto">
          {title}
        </Typography>
        {trailingItems != undefined && (
          <Stack direction="row" alignItems="center">
            {trailingItems.map((item, i) => (
              <div key={i}>{item}</div>
            ))}
          </Stack>
        )}
      </div>
      <Stack flex="auto" {...(!disablePadding && { paddingX: 2, paddingBottom: 2 })}>
        {children}
      </Stack>
    </Stack>
  );
}

type SidebarContentProps = {
  title: string;
  disablePadding?: boolean;

  /** Buttons/items to display on the leading (left) side of the header */
  leadingItems?: React.ReactNode[];

  /** Overflow style of root element
   * @default: "auto"
   */
  overflow?: CSSProperties["overflow"];

  /** Buttons/items to display on the trailing (right) side of the header */
  trailingItems?: React.ReactNode[];
};
