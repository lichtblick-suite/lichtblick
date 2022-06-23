// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { CompoundButton, IButtonProps, useTheme, Checkbox } from "@fluentui/react";
import { styled as muiStyled, Typography } from "@mui/material";
import { useMemo } from "react";

import { AppSetting } from "@foxglove/studio-base/AppSetting";
import Stack from "@foxglove/studio-base/components/Stack";
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
    children: "Browse docs",
  },
  {
    id: "github",
    href: "https://github.com/foxglove/studio/issues/",
    target: "_blank",
    children: "Report a bug or request a feature",
  },
];

const CONTACT_ITEMS = [
  {
    id: "feedback",
    href: "https://foxglove.dev/contact/",
    target: "_blank",
    children: "Give feedback",
  },
  {
    id: "demo",
    href: "https://foxglove.dev/demo/",
    target: "_blank",
    children: "Schedule a demo",
  },
];

export type IStartProps = {
  supportedLocalFileExtensions?: string[];
  supportedRemoteFileExtensions?: string[];
  onSelectView: (newValue: OpenDialogViews) => void;
};

const RecentStack = muiStyled(Stack)(({ theme }) => ({
  overflow: "hidden",
  "&:hover": { color: theme.palette.primary.dark },
}));

const Grid = muiStyled("div")(({ theme }) => ({
  // See comment below for explanation of grid properties
  display: "grid",
  gap: theme.spacing(2.5, 4),
  gridTemplateRows: "repeat(2, auto) 1fr",
  "@media(max-width: 800px)": {
    display: "flex",
    flexDirection: "column",
  },
}));

export default function Start(props: IStartProps): JSX.Element {
  const {
    supportedLocalFileExtensions = [],
    supportedRemoteFileExtensions = [],
    onSelectView,
  } = props;
  const theme = useTheme();
  const { recentSources, selectRecent } = usePlayerSelection();

  const [showOnStartup = true, setShowOnStartup] = useAppConfigurationValue<boolean>(
    AppSetting.SHOW_OPEN_DIALOG_ON_STARTUP,
  );

  const buttonStyles = useMemo(
    () => ({
      root: {
        width: "100%",
        maxWidth: "none",
      },
      rootHovered: { backgroundColor: theme.palette.neutralLighterAlt },
      rootPressed: { backgroundColor: theme.palette.neutralLighter },
      flexContainer: { alignItems: "center" },
      description: { whiteSpace: "pre-line" },
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

  const startItems: IButtonProps[] = useMemo(() => {
    const formatter = new Intl.ListFormat("en-US", { style: "long" });
    const supportedLocalFiles = formatter.format(
      Array.from(new Set(supportedLocalFileExtensions)).sort(),
    );
    const supportedRemoteFiles = formatter.format(
      Array.from(new Set(supportedRemoteFileExtensions)).sort(),
    );
    return [
      {
        id: "open-local-file",
        children: "Open local file",
        secondaryText: `Supports ${supportedLocalFiles} files.`,
        iconProps: { iconName: "OpenFile" },
        onClick: () => onSelectView("file"),
      },
      {
        id: "open-url",
        children: "Open file from URL",
        secondaryText: `Load a file via HTTP(S).\nSupports ${supportedRemoteFiles} files.`,
        iconProps: { iconName: "FileASPX" },
        onClick: () => onSelectView("remote"),
      },
      {
        id: "open-connection",
        children: "Open connection",
        secondaryText: "Connect to a live robot or server.",
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
    ];
  }, [onSelectView, supportedLocalFileExtensions, supportedRemoteFileExtensions]);

  const recentItems: IButtonProps[] = useMemo(() => {
    return recentSources.map((recent) => {
      return {
        id: recent.id,
        children: (
          <RecentStack direction="row">
            <Typography
              variant="body2"
              color="inherit"
              component="div"
              noWrap
              style={{
                overflow: "hidden",
                paddingRight: theme.spacing.s1,
              }}
            >
              <TextMiddleTruncate text={recent.title} />
            </Typography>
            {recent.label && (
              <Typography component="div" variant="body2" color="text.secondary" noWrap>
                {recent.label}
              </Typography>
            )}
          </RecentStack>
        ),
        onClick: () => selectRecent(recent.id),
      };
    });
  }, [recentSources, selectRecent, theme]);

  // This layout uses `display: grid` at large widths, and `display: flex` at small widths. When
  // using flex, the elements flow in source order within the column.
  //
  // At the larger width (when using grid), `gridColumn: 2` makes the Recent, Help, and Contact
  // items go in the 2nd column, while the larger "Open data source" section occupies the first
  // column. `gridTemplateRows: "repeat(2, auto) 1fr"` and `gridRow: "1 / 4"` makes it so the Open
  // section doesn't affect the heights of the Recent and Help sections.
  return (
    <Stack gap={2.5}>
      <Grid>
        {recentItems.length > 0 && <ActionList gridColumn={2} title="Recent" items={recentItems} />}
        <Stack flex="1 1 0" gap={2} style={{ minWidth: 340, gridRow: "1 / 4" }}>
          <Typography variant="h5" color="text.secondary">
            Open data source
          </Typography>
          <Stack gap={1}>
            {startItems.map(({ id, ...item }) => (
              <CompoundButton {...item} key={id} id={id} styles={buttonStyles} />
            ))}
          </Stack>
        </Stack>
        <ActionList gridColumn={2} title="Help" items={HELP_ITEMS} />
        <ActionList gridColumn={2} title="Contact" items={CONTACT_ITEMS} />
      </Grid>
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
