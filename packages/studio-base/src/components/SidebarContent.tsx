// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import HelpIcon from "@mui/icons-material/Help";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import { IconButton, styled as muiStyled, Typography } from "@mui/material";
import { useState, useMemo, CSSProperties } from "react";

import Stack from "@foxglove/studio-base/components/Stack";
import TextContent from "@foxglove/studio-base/components/TextContent";

export const TOOLBAR_HEIGHT = 56;

const Toolbar = muiStyled(Stack)({
  minHeight: TOOLBAR_HEIGHT,
});

const ContentWrapper = muiStyled("div", {
  shouldForwardProp: (prop) => prop !== "disablePadding",
})<{ disablePadding: boolean }>(({ theme, disablePadding }) => ({
  flexGrow: 1,

  ...(!disablePadding && {
    padding: theme.spacing(0, 2, 2),
  }),
}));

const HelpContent = muiStyled("div")(({ theme }) => ({
  padding: theme.spacing(0, 2, 2),
}));

export function SidebarContent({
  disablePadding = false,
  title,
  children,
  helpContent,
  leadingItems,
  overflow = "auto",
  trailingItems,
}: React.PropsWithChildren<SidebarContentProps>): JSX.Element {
  const [showHelp, setShowHelp] = useState<boolean>(false);

  const trailingItemsWithHelp = useMemo(() => {
    if (helpContent != undefined) {
      return [
        ...(trailingItems ?? []),
        <IconButton
          color={showHelp ? "inherit" : "primary"}
          title={showHelp ? "Hide help" : "Show help"}
          key="help-icon"
          onClick={() => setShowHelp(!showHelp)}
        >
          {showHelp ? <HelpIcon /> : <HelpOutlineIcon />}
        </IconButton>,
      ];
    }
    return trailingItems ?? [];
  }, [helpContent, trailingItems, showHelp]);

  return (
    <Stack overflow={overflow} fullHeight flex="auto" gap={1}>
      <Toolbar flexShrink={0} direction="row" alignItems="center" padding={2}>
        {leadingItems && (
          <Stack direction="row" alignItems="center">
            {leadingItems.map((item, i) => (
              <div key={i}>{item}</div>
            ))}
          </Stack>
        )}
        <Typography component="h2" variant="h4" fontWeight={800} flex="auto">
          {title}
        </Typography>
        {trailingItemsWithHelp.length > 0 && (
          <Stack direction="row" alignItems="center">
            {trailingItemsWithHelp.map((item, i) => (
              <div key={i}>{item}</div>
            ))}
          </Stack>
        )}
      </Toolbar>
      {showHelp && (
        <HelpContent>
          <TextContent allowMarkdownHtml={true}>{helpContent}</TextContent>
        </HelpContent>
      )}
      <ContentWrapper disablePadding={disablePadding}>{children}</ContentWrapper>
    </Stack>
  );
}

type SidebarContentProps = {
  title: string;
  helpContent?: React.ReactNode;
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
