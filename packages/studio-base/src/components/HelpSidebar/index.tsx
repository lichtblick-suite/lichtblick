// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Stack, useTheme, Text, Link, ITheme, ITextStyles, ILinkStyles } from "@fluentui/react";
import ChevronLeftIcon from "@mdi/svg/svg/chevron-left.svg";
import { useMemo, useState, useEffect } from "react";
import { useUnmount } from "react-use";

import Icon from "@foxglove/studio-base/components/Icon";
import { SidebarContent } from "@foxglove/studio-base/components/SidebarContent";
import TextContent from "@foxglove/studio-base/components/TextContent";
import { useSelectedPanels } from "@foxglove/studio-base/context/CurrentLayoutContext";
import { PanelInfo, usePanelCatalog } from "@foxglove/studio-base/context/PanelCatalogContext";
import isDesktopApp from "@foxglove/studio-base/util/isDesktopApp";

const productLinks = [
  { text: "Foxglove Studio", url: "https://foxglove.dev/studio" },
  { text: "Foxglove Data Platform", url: "https://foxglove.dev/data-platform" },
];

const resourceLinks = [
  ...(isDesktopApp() ? [] : [{ text: "Desktop app", url: "https://foxglove.dev/download" }]),
  { text: "Read docs", url: "https://foxglove.dev/docs" },
  { text: "Join our community", url: "https://foxglove.dev/community" },
];

const legalLinks = [
  { text: "License", url: "https://foxglove.dev/legal/studio-license" },
  { text: "Privacy", url: "https://foxglove.dev/legal/privacy" },
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
  panelTypeForTests = "",
}: React.PropsWithChildren<{
  isHomeViewForTests?: boolean;
  panelTypeForTests?: string;
}>): JSX.Element {
  const theme = useTheme();
  const styles = useComponentStyles(theme);
  const [isHomeView, setIsHomeView] = useState(
    isHomeViewForTests == undefined ? true : isHomeViewForTests,
  );
  const { panelDocToDisplay: panelType, setPanelDocToDisplay } = useSelectedPanels();

  const panelCatalog = usePanelCatalog();
  const panelInfo = useMemo(
    () =>
      (panelType ? panelType : panelTypeForTests) != undefined
        ? panelCatalog.getPanelByType(panelType ? panelType : panelTypeForTests)
        : undefined,
    [panelCatalog, panelType, panelTypeForTests],
  );
  const sortByTitle = (a: PanelInfo, b: PanelInfo) =>
    a.title.localeCompare(b.title, undefined, { ignorePunctuation: true, sensitivity: "base" });
  const panels = panelCatalog.getPanels();
  const sortedPanels = [...panels].sort(sortByTitle);

  useEffect(() => setIsHomeView(!panelInfo), [setIsHomeView, panelInfo]);

  useUnmount(() => {
    // Automatically deselect the panel we were looking at help content for when the help sidebar closes
    if (panelType != undefined) {
      setPanelDocToDisplay("");
    }
  });

  return (
    <SidebarContent
      leadingItems={
        isHomeView
          ? undefined
          : [
              <Icon
                key="back-arrow"
                size="small"
                style={{ marginRight: "5px" }}
                onClick={() => setIsHomeView(true)}
              >
                <ChevronLeftIcon />
              </Icon>,
            ]
      }
      title={isHomeView ? "Help" : panelInfo?.title ? panelInfo.title : ""}
    >
      <Stack>
        {!isHomeView && (
          <Stack tokens={{ childrenGap: theme.spacing.s2 }}>
            {panelInfo?.help != undefined ? (
              <TextContent allowMarkdownHtml={true}>{panelInfo?.help}</TextContent>
            ) : (
              "Panel does not have any documentation details."
            )}
          </Stack>
        )}
        {isHomeView && (
          <Stack tokens={{ childrenGap: theme.spacing.m }}>
            <Stack.Item>
              <Text styles={styles.subheader}>Panels</Text>
              <Stack tokens={{ padding: `${theme.spacing.m} 0`, childrenGap: theme.spacing.s1 }}>
                {sortedPanels.map(({ title, type }) => (
                  <Link
                    key={title}
                    style={{ color: theme.semanticColors.bodyText }}
                    onClick={() => setPanelDocToDisplay(type)}
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
                {resourceLinks.map((link) => (
                  <Link
                    key={link.text}
                    style={{ color: theme.semanticColors.bodyText }}
                    href={link.url}
                    styles={styles.link}
                  >
                    {link.text}
                  </Link>
                ))}
              </Stack>
            </Stack.Item>

            <Stack.Item>
              <Text styles={styles.subheader}>Products</Text>
              <Stack tokens={{ padding: `${theme.spacing.m} 0`, childrenGap: theme.spacing.s1 }}>
                {productLinks.map((link) => (
                  <Link
                    key={link.text}
                    style={{ color: theme.semanticColors.bodyText }}
                    href={link.url}
                    styles={styles.link}
                  >
                    {link.text}
                  </Link>
                ))}
              </Stack>
            </Stack.Item>

            <Stack.Item>
              <Text styles={styles.subheader}>Legal</Text>
              <Stack tokens={{ padding: `${theme.spacing.m} 0`, childrenGap: theme.spacing.s1 }}>
                {legalLinks.map((link) => (
                  <Link
                    key={link.text}
                    style={{ color: theme.semanticColors.bodyText }}
                    href={link.url}
                    styles={styles.link}
                  >
                    {link.text}
                  </Link>
                ))}
              </Stack>
            </Stack.Item>
          </Stack>
        )}
      </Stack>
    </SidebarContent>
  );
}
