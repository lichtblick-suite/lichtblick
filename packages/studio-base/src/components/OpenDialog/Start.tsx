// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { CompoundButton, Stack, Text, IButtonProps, useTheme, Checkbox } from "@fluentui/react";
import { useMemo } from "react";

import { AppSetting } from "@foxglove/studio-base/AppSetting";
import { usePlayerSelection } from "@foxglove/studio-base/context/PlayerSelectionContext";
import { useAppConfigurationValue } from "@foxglove/studio-base/hooks";
import TextMiddleTruncate from "@foxglove/studio-base/panels/ThreeDimensionalViz/TopicTree/TextMiddleTruncate";

import ActionList from "./ActionList";
import { OpenDialogViews } from "./types";

const HELP_ITEMS: IButtonProps[] = [
  {
    id: "slack",
    href: "https://foxglove.dev/slack?utm_source=studio&utm_medium=open-dialog",
    target: "_blank",
    children: "Join our Slack community",
  },
  {
    id: "docs",
    href: "https://foxglove.dev/docs?utm_source=studio&utm_medium=open-dialog",
    target: "_blank",
    children: "Browse the documentation",
  },
  {
    id: "github",
    href: "https://github.com/foxglove/studio/issues/",
    target: "_blank",
    children: "Report a bug or request a feature",
  },
];

export type IStartProps = {
  supportedFileExtensions?: string[];
  onSelectView: (newValue: OpenDialogViews) => void;
};

export default function Start(props: IStartProps): JSX.Element {
  const { supportedFileExtensions = [], onSelectView } = props;
  const theme = useTheme();
  const { recentSources, selectRecent } = usePlayerSelection();

  const [showOnStartup = true, setShowOnStartup] = useAppConfigurationValue<boolean>(
    AppSetting.SHOW_OPEN_DIALOG_ON_STARTUP,
  );

  const buttonStyles = useMemo(
    () => ({
      root: {
        width: 340,
        maxWidth: "none",
      },
      rootHovered: { backgroundColor: theme.palette.neutralLighterAlt },
      rootPressed: { backgroundColor: theme.palette.neutralLighter },
      flexContainer: { alignItems: "center" },
      descriptionHovered: { color: theme.semanticColors.bodySubtext },
      icon: {
        marginRight: theme.spacing.m,
        marginLeft: theme.spacing.s1,
        color: theme.palette.themePrimary,

        "> span": { display: "flex" },
        svg: { height: "1em", width: "1em" },
      },
      labelHovered: {
        color: theme.palette.themePrimary,
      },
    }),
    [theme],
  );

  const supportedLocalFiles = useMemo(
    () => Array.from(new Set(supportedFileExtensions)).join(", "),
    [supportedFileExtensions],
  );

  const startItems: IButtonProps[] = useMemo(
    () => [
      {
        id: "open-local-file",
        children: "Open local file",
        secondaryText: `Supports ${supportedLocalFiles} files`,
        iconProps: { iconName: "OpenFile" },
        onClick: () => onSelectView("file"),
      },
      {
        id: "open-url",
        children: "Open file from URL",
        secondaryText: "Load a file via HTTP(S)",
        iconProps: { iconName: "FileASPX" },
        onClick: () => onSelectView("remote"),
      },
      {
        id: "open-connection",
        children: "Open connection",
        secondaryText: "Connect to a live robot or server",
        iconProps: { iconName: "Flow" },
        onClick: () => onSelectView("connection"),
      },
      {
        id: "sample-data",
        children: "Explore sample data",
        secondaryText: "New to Foxglove Studio? Start here!",
        iconProps: { iconName: "BookStar" },
        onClick: () => onSelectView("demo"),
      },
    ],
    [onSelectView, supportedLocalFiles],
  );

  const recentItems: IButtonProps[] = useMemo(() => {
    return recentSources.map((recent) => {
      return {
        id: recent.id,
        children: (
          <Stack
            horizontal
            styles={{
              root: {
                overflow: "hidden",

                ":hover": { color: theme.palette.themeDark },
              },
            }}
          >
            <Text
              variant="small"
              styles={{
                root: {
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  color: "inherit",
                  paddingRight: theme.spacing.s1,
                },
              }}
            >
              <TextMiddleTruncate text={recent.title} />
            </Text>
            {recent.label && (
              <Text
                variant="small"
                styles={{
                  root: {
                    whiteSpace: "nowrap",
                    color: theme.palette.neutralSecondaryAlt,
                  },
                }}
              >
                {recent.label}
              </Text>
            )}
          </Stack>
        ),
        onClick: () => selectRecent(recent.id),
      };
    });
  }, [recentSources, selectRecent, theme]);

  return (
    <Stack tokens={{ childrenGap: theme.spacing.l1 }}>
      <Stack horizontal tokens={{ childrenGap: theme.spacing.l2 }}>
        {/* Left column */}
        <Stack grow tokens={{ childrenGap: theme.spacing.m }}>
          <Text variant="large" styles={{ root: { color: theme.semanticColors.bodySubtext } }}>
            Open data source
          </Text>
          <Stack tokens={{ childrenGap: theme.spacing.s1 }}>
            {startItems.map(({ id, ...item }) => (
              <CompoundButton {...item} key={id} id={id} styles={buttonStyles} />
            ))}
          </Stack>
        </Stack>

        {/* Right column */}
        <Stack grow tokens={{ childrenGap: theme.spacing.l1 }} styles={{ root: { minWidth: 0 } }}>
          {recentItems.length > 0 && <ActionList title="Recent" items={recentItems} />}
          <ActionList title="Help" items={HELP_ITEMS} />
        </Stack>
      </Stack>
      <Checkbox
        label="Show on startup"
        checked={showOnStartup}
        onChange={async (_, checked) => {
          await setShowOnStartup(checked);
        }}
      />
    </Stack>
  );
}
