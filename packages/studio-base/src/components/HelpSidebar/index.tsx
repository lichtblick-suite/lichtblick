// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Stack, useTheme, Text, Link, ITheme, ITextStyles, ILinkStyles } from "@fluentui/react";
import ChevronLeftIcon from "@mdi/svg/svg/chevron-left.svg";
import { useMemo } from "react";
import { useUnmount } from "react-use";

import Icon from "@foxglove/studio-base/components/Icon";
import KeyboardShortcutHelp from "@foxglove/studio-base/components/KeyboardShortcut.help.md";
import MesssagePathSyntaxHelp from "@foxglove/studio-base/components/MessagePathSyntax/index.help.md";
import { SidebarContent } from "@foxglove/studio-base/components/SidebarContent";
import TextContent from "@foxglove/studio-base/components/TextContent";
import { useHelpInfo, HelpInfo } from "@foxglove/studio-base/context/HelpInfoContext";
import { PanelInfo, usePanelCatalog } from "@foxglove/studio-base/context/PanelCatalogContext";
import { DEFAULT_HELP_INFO } from "@foxglove/studio-base/providers/HelpInfoProvider";
import isDesktopApp from "@foxglove/studio-base/util/isDesktopApp";

export const MESSAGE_PATH_SYNTAX_HELP_INFO = {
  title: "Message path syntax",
  content: MesssagePathSyntaxHelp,
};
const appLinks: HelpInfo[] = [
  MESSAGE_PATH_SYNTAX_HELP_INFO,
  { title: "Keyboard shortcuts", content: KeyboardShortcutHelp },
];

const resourceLinks = [
  ...(isDesktopApp() ? [] : [{ title: "Desktop app", url: "https://foxglove.dev/download" }]),
  { title: "Read docs", url: "https://foxglove.dev/docs" },
  { title: "Join our community", url: "https://foxglove.dev/community" },
];

const productLinks = [
  { title: "Foxglove Studio", url: "https://foxglove.dev/studio" },
  { title: "Foxglove Data Platform", url: "https://foxglove.dev/data-platform" },
];

const legalLinks = [
  { title: "License", url: "https://foxglove.dev/legal/studio-license" },
  { title: "Privacy", url: "https://foxglove.dev/legal/privacy" },
];

const useComponentStyles = (theme: ITheme) =>
  useMemo(
    () => ({
      subheader: {
        root: {
          ...theme.fonts.xSmall,
          display: "block",
          textTransform: "uppercase",
          color: theme.palette.neutralSecondaryAlt,
          letterSpacing: "0.025em",
        },
      } as Partial<ITextStyles>,
      link: {
        root: {
          ...theme.fonts.smallPlus,
          fontSize: 13,
        } as Partial<ILinkStyles>,
      },
    }),
    [theme],
  );

export default function HelpSidebar({
  isHomeViewForTests,
}: React.PropsWithChildren<{
  isHomeViewForTests?: boolean;
}>): JSX.Element {
  const theme = useTheme();
  const styles = useComponentStyles(theme);
  const { helpInfo, setHelpInfo } = useHelpInfo();

  const panelCatalog = usePanelCatalog();

  const sortByTitle = (a: PanelInfo, b: PanelInfo) =>
    a.title.localeCompare(b.title, undefined, { ignorePunctuation: true, sensitivity: "base" });
  const panels = panelCatalog.getPanels();
  const sortedPanels = [...panels].sort(sortByTitle);

  const isHomeView = useMemo(
    () => (isHomeViewForTests != undefined ? isHomeViewForTests : helpInfo.content == undefined),
    [isHomeViewForTests, helpInfo],
  );

  useUnmount(() => {
    // Automatically deselect the panel we were looking at help content for when the help sidebar closes
    if (helpInfo.content != undefined) {
      setHelpInfo(DEFAULT_HELP_INFO);
    }
  });

  return (
    <SidebarContent
      leadingItems={
        helpInfo.content == undefined
          ? undefined
          : [
              <Icon
                key="back-arrow"
                size="small"
                style={{ marginRight: "5px" }}
                onClick={() => setHelpInfo(DEFAULT_HELP_INFO)}
              >
                <ChevronLeftIcon />
              </Icon>,
            ]
      }
      title={isHomeView ? "Help" : helpInfo.title}
    >
      <Stack>
        {isHomeView ? (
          <Stack tokens={{ childrenGap: theme.spacing.m }}>
            <Stack.Item>
              <Text styles={styles.subheader}>App</Text>
              <Stack tokens={{ padding: `${theme.spacing.m} 0`, childrenGap: theme.spacing.s1 }}>
                {appLinks.map(({ title, content }) => (
                  <Link
                    key={title}
                    style={{ color: theme.semanticColors.bodyText }}
                    onClick={() => setHelpInfo({ title, content })}
                    styles={styles.link}
                  >
                    {title}
                  </Link>
                ))}
              </Stack>
            </Stack.Item>
            <Stack.Item>
              <Text styles={styles.subheader}>Panels</Text>
              <Stack tokens={{ padding: `${theme.spacing.m} 0`, childrenGap: theme.spacing.s1 }}>
                {sortedPanels.map(({ title, type, help }) => (
                  <Link
                    key={title}
                    data-test={type}
                    style={{ color: theme.semanticColors.bodyText }}
                    onClick={() => setHelpInfo({ title, content: help })}
                    styles={styles.link}
                  >
                    {title}
                  </Link>
                ))}
              </Stack>
            </Stack.Item>

            <Stack.Item>
              <Text styles={styles.subheader}>External Resources</Text>
              <Stack tokens={{ padding: `${theme.spacing.m} 0`, childrenGap: theme.spacing.s1 }}>
                {resourceLinks.map(({ title, url }) => (
                  <Link
                    key={title}
                    style={{ color: theme.semanticColors.bodyText }}
                    href={url}
                    styles={styles.link}
                  >
                    {title}
                  </Link>
                ))}
              </Stack>
            </Stack.Item>

            <Stack.Item>
              <Text styles={styles.subheader}>Products</Text>
              <Stack tokens={{ padding: `${theme.spacing.m} 0`, childrenGap: theme.spacing.s1 }}>
                {productLinks.map(({ title, url }) => (
                  <Link
                    key={title}
                    style={{ color: theme.semanticColors.bodyText }}
                    href={url}
                    styles={styles.link}
                  >
                    {title}
                  </Link>
                ))}
              </Stack>
            </Stack.Item>

            <Stack.Item>
              <Text styles={styles.subheader}>Legal</Text>
              <Stack tokens={{ padding: `${theme.spacing.m} 0`, childrenGap: theme.spacing.s1 }}>
                {legalLinks.map(({ title, url }) => (
                  <Link
                    key={title}
                    style={{ color: theme.semanticColors.bodyText }}
                    href={url}
                    styles={styles.link}
                  >
                    {title}
                  </Link>
                ))}
              </Stack>
            </Stack.Item>
          </Stack>
        ) : (
          <Stack tokens={{ childrenGap: theme.spacing.s2 }}>
            {helpInfo.content != undefined ? (
              <TextContent allowMarkdownHtml={true}>{helpInfo.content}</TextContent>
            ) : (
              "Panel does not have any documentation details."
            )}
          </Stack>
        )}
      </Stack>
    </SidebarContent>
  );
}
