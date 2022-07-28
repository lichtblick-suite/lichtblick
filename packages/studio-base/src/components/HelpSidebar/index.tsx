// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import ChevronLeftIcon from "@mdi/svg/svg/chevron-left.svg";
import { Link, Typography } from "@mui/material";
import { useMemo } from "react";
import { useUnmount } from "react-use";

import Icon from "@foxglove/studio-base/components/Icon";
import KeyboardShortcutHelp from "@foxglove/studio-base/components/KeyboardShortcut.help.md";
import MesssagePathSyntaxHelp from "@foxglove/studio-base/components/MessagePathSyntax/index.help.md";
import { SidebarContent } from "@foxglove/studio-base/components/SidebarContent";
import Stack from "@foxglove/studio-base/components/Stack";
import TextContent from "@foxglove/studio-base/components/TextContent";
import { PanelInfo, usePanelCatalog } from "@foxglove/studio-base/context/PanelCatalogContext";
import {
  DEFAULT_HELP_INFO,
  HelpInfo,
  HelpInfoStore,
  useHelpInfo,
} from "@foxglove/studio-base/providers/HelpInfoProvider";
import isDesktopApp from "@foxglove/studio-base/util/isDesktopApp";

export const MESSAGE_PATH_SYNTAX_HELP_INFO = {
  title: "Message path syntax",
  content: MesssagePathSyntaxHelp,
};

type SectionKey = "app" | "panels" | "resources" | "products" | "contact" | "legal";
const helpMenuItems: Map<SectionKey, { subheader: string; links: HelpInfo[] }> = new Map([
  [
    "resources",
    {
      subheader: "External resources",
      links: [
        ...(isDesktopApp() ? [] : [{ title: "Desktop app", url: "https://foxglove.dev/download" }]),
        { title: "Browse docs", url: "https://foxglove.dev/docs" },
        { title: "Join our community", url: "https://foxglove.dev/community" },
      ],
    },
  ],
  [
    "products",
    {
      subheader: "Products",
      links: [
        { title: "Foxglove Studio", url: "https://foxglove.dev/studio" },
        { title: "Foxglove Data Platform", url: "https://foxglove.dev/data-platform" },
      ],
    },
  ],
  [
    "contact",
    {
      subheader: "Contact",
      links: [
        { title: "Give feedback", url: "https://foxglove.dev/contact" },
        { title: "Schedule a demo", url: "https://foxglove.dev/demo" },
      ],
    },
  ],
  [
    "legal",
    {
      subheader: "Legal",
      links: [
        { title: "License terms", url: "https://foxglove.dev/legal/studio-license" },
        { title: "Privacy policy", url: "https://foxglove.dev/legal/privacy" },
      ],
    },
  ],
]);

const selectHelpInfo = (store: HelpInfoStore) => store.helpInfo;
const selectsSetHelpInfo = (store: HelpInfoStore) => store.setHelpInfo;

export default function HelpSidebar({
  isHomeViewForTests,
}: React.PropsWithChildren<{
  isHomeViewForTests?: boolean;
}>): JSX.Element {
  const helpInfo = useHelpInfo(selectHelpInfo);
  const setHelpInfo = useHelpInfo(selectsSetHelpInfo);

  const panelCatalog = usePanelCatalog();

  const sortByTitle = (a: PanelInfo, b: PanelInfo) =>
    a.title.localeCompare(b.title, undefined, { ignorePunctuation: true, sensitivity: "base" });
  const panels = panelCatalog.getPanels();
  const sortedPanelLinks = [...panels]
    .sort(sortByTitle)
    .map(({ title, help }) => ({ title, content: help }));

  const sections: Map<SectionKey, { subheader: string; links: HelpInfo[] } | undefined> = useMemo(
    () =>
      new Map([
        [
          "app",
          {
            subheader: "App",
            links: [
              MESSAGE_PATH_SYNTAX_HELP_INFO,
              { title: "Keyboard shortcuts", content: KeyboardShortcutHelp },
            ],
          },
        ],
        ["panels", { subheader: "Panels", links: sortedPanelLinks }],
        ["resources", helpMenuItems.get("resources")],
        ["products", helpMenuItems.get("products")],
        ["contact", helpMenuItems.get("contact")],
        ["legal", helpMenuItems.get("legal")],
      ]),
    [sortedPanelLinks],
  );
  const sectionKeys = Array.from(sections.keys());

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
          <Stack gap={1.5}>
            {sectionKeys.map((key: SectionKey) => {
              const { subheader, links = [] } = sections.get(key) ?? {};
              return (
                <div key={subheader}>
                  <Typography color="text.secondary" variant="overline" display="block">
                    {subheader}
                  </Typography>
                  <Stack paddingY={2} gap={0.75}>
                    {links.map(({ title, url, content }: HelpInfo) => (
                      <Link
                        color="inherit"
                        variant="body2"
                        underline="hover"
                        key={title}
                        data-testid={title}
                        href={url}
                        target="_blank"
                        onClick={() => (url ? undefined : setHelpInfo({ title, content }))}
                      >
                        {title}
                      </Link>
                    ))}
                  </Stack>
                </div>
              );
            })}
            <Typography variant="caption">
              Foxglove Studio version {FOXGLOVE_STUDIO_VERSION}
            </Typography>
          </Stack>
        ) : (
          <Stack gap={0.5}>
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
