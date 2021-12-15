// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { CompoundButton, Stack, Text, IButtonProps, useTheme } from "@fluentui/react";
import { useMemo } from "react";

import { usePlayerSelection } from "@foxglove/studio-base/context/PlayerSelectionContext";

import ActionList from "./ActionList";
import { OpenDialogViews } from "./types";

const HELP_ITEMS: IButtonProps[] = [
  {
    id: "slack",
    href: "https://join.slack.com/t/foxglove/shared_invite/zt-n60289dv-jb2WxEesFUT1k56AHGNaug",
    target: "_blank",
    children: "Join our Slack community",
  },
  {
    id: "docs",
    href: "https://foxglove.dev/docs",
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

  const startItems: IButtonProps[] = useMemo(
    () => [
      {
        id: "open-local-file",
        children: "Open local file",
        secondaryText: `Supports ${supportedFileExtensions.join(", ")} files`,
        iconProps: { iconName: "OpenFile" },
        onClick: () => onSelectView("file"),
      },
      {
        id: "open-url",
        children: "Open file from URL",
        secondaryText: "Load a file via HTTP/HTTPS",
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
        secondaryText: "New to Studio? View some sample data",
        iconProps: { iconName: "BookStar" },
        onClick: () => onSelectView("demo"),
      },
    ],
    [onSelectView, supportedFileExtensions],
  );

  const recentItems: IButtonProps[] = useMemo(() => {
    return recentSources.map((recent) => {
      const fullTitle = recent.label ? `${recent.title} · ${recent.label}` : recent.title;
      return {
        id: recent.id,
        children: fullTitle,
        onClick: () => selectRecent(recent.id),
      };
    });
  }, [recentSources, selectRecent]);

  return (
    <>
      <Stack horizontal tokens={{ childrenGap: theme.spacing.l2 }}>
        {/* Left column */}
        <Stack grow tokens={{ childrenGap: theme.spacing.m }}>
          <Text variant="large" styles={{ root: { color: theme.semanticColors.bodySubtext } }}>
            Start
          </Text>
          <Stack tokens={{ childrenGap: theme.spacing.s1 }}>
            {startItems.map(({ id, ...item }) => (
              <CompoundButton
                {...item}
                key={id}
                id={id}
                styles={{
                  root: {
                    width: 340,
                    maxWidth: "none",
                  },
                  flexContainer: {
                    alignItems: "center",
                  },
                  icon: {
                    marginRight: theme.spacing.m,
                    marginLeft: theme.spacing.s1,
                    color: theme.palette.themePrimary,

                    svg: { height: "1em", width: "1em" },
                  },
                  labelHovered: {
                    color: theme.palette.themePrimary,
                  },
                }}
              />
            ))}
          </Stack>
        </Stack>

        {/* Right column */}
        <Stack grow tokens={{ childrenGap: theme.spacing.l1 }} styles={{ root: { minWidth: 0 } }}>
          <ActionList title="Recent" items={recentItems} />
          <ActionList title="Help" items={HELP_ITEMS} />
        </Stack>
      </Stack>
    </>
  );
}
