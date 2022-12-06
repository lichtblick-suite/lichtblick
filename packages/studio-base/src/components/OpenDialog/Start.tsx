// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  Button,
  Checkbox,
  FormControlLabel,
  Link,
  styled as muiStyled,
  SvgIcon,
  Typography,
} from "@mui/material";
import { useMemo } from "react";

import { AppSetting } from "@foxglove/studio-base/AppSetting";
import Stack from "@foxglove/studio-base/components/Stack";
import TextMiddleTruncate from "@foxglove/studio-base/components/TextMiddleTruncate";
import { useAnalytics } from "@foxglove/studio-base/context/AnalyticsContext";
import { usePlayerSelection } from "@foxglove/studio-base/context/PlayerSelectionContext";
import { useAppConfigurationValue } from "@foxglove/studio-base/hooks";
import { AppEvent } from "@foxglove/studio-base/services/IAnalytics";

import ActionList, { ActionListItem } from "./ActionList";
import { OpenDialogViews } from "./types";

const HELP_ITEMS: ActionListItem[] = [
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
  onSelectView: (newValue: OpenDialogViews) => void;
};

const StyledButton = muiStyled(Button)(({ theme }) => ({
  textAlign: "left",
  justifyContent: "flex-start",
  padding: theme.spacing(2, 3),
  gap: theme.spacing(1.5),
  borderColor: theme.palette.divider,

  ".MuiButton-startIcon .MuiSvgIcon-fontSizeLarge": {
    fontSize: 28,
  },
}));

const Grid = muiStyled("div")(({ theme }) => ({
  // See comment below for explanation of grid properties
  display: "grid",
  gap: theme.spacing(2.5, 4),
  gridTemplateRows: "repeat(2, auto) 1fr",
  gridTemplateColumns: `minmax(${(7 / 12) * 100}%, auto) 1fr`,

  "@media(max-width: 800px)": {
    display: "flex",
    flexDirection: "column",
  },
}));

type DataSourceOptionProps = {
  text: string;
  secondaryText: string;
  icon: JSX.Element;
  onClick?: () => void;
  href?: string;
};

function DataSourceOption(props: DataSourceOptionProps): JSX.Element {
  const { icon, onClick, text, secondaryText, href } = props;
  const button = (
    <StyledButton
      fullWidth
      color="inherit"
      variant="outlined"
      size="large"
      startIcon={icon}
      onClick={onClick}
    >
      <Stack flex="auto" zeroMinWidth>
        <Typography component="div" variant="subtitle1" color="text.primary">
          {text}
        </Typography>
        <Typography component="div" variant="body2" color="text.secondary" noWrap>
          {secondaryText}
        </Typography>
      </Stack>
    </StyledButton>
  );

  return href ? (
    <Link href={href} target="_blank" style={{ textDecoration: "none" }}>
      {button}
    </Link>
  ) : (
    button
  );
}

export default function Start(props: IStartProps): JSX.Element {
  const { supportedLocalFileExtensions = [], onSelectView } = props;
  const { recentSources, selectRecent } = usePlayerSelection();
  const analytics = useAnalytics();

  const [showOnStartup = true, setShowOnStartup] = useAppConfigurationValue<boolean>(
    AppSetting.SHOW_OPEN_DIALOG_ON_STARTUP,
  );

  const startItems = useMemo(() => {
    const formatter = new Intl.ListFormat("en-US", { style: "long" });
    const supportedLocalFiles = formatter.format(
      Array.from(new Set(supportedLocalFileExtensions)).sort(),
    );
    return [
      {
        key: "open-local-file",
        text: "Open local file",
        secondaryText: `Supports ${supportedLocalFiles} files.`,
        icon: (
          <SvgIcon fontSize="large" color="primary" viewBox="0 0 2048 2048">
            <path d="M1955 1533l-163-162v677h-128v-677l-163 162-90-90 317-317 317 317-90 90zM256 1920h1280v128H128V0h1115l549 549v475h-128V640h-512V128H256v1792zM1280 512h293l-293-293v293z" />
          </SvgIcon>
        ),
        onClick: () => {
          onSelectView("file");
          void analytics.logEvent(AppEvent.DIALOG_SELECT_VIEW, { type: "local" });
        },
      },
      {
        key: "open-url",
        text: "Upload and share data",
        secondaryText: "Use Foxglove Data Platform to share data with your team.",
        icon: (
          <SvgIcon fontSize="large" color="primary" viewBox="0 0 2048 2048">
            <path d="M256 1920h512v128H128V0h1115l549 549v91h-640V128H256v1792zM1280 512h293l-293-293v293zm128 256q133 0 249 50t204 137 137 203 50 250q0 133-50 249t-137 204-203 137-250 50q-133 0-249-50t-204-137-137-203-50-250q0-133 50-249t137-204 203-137 250-50zm0 1152q21 0 37-14t28-38 21-53 15-57 9-53 6-41h-230q2 14 5 39t10 53 16 58 21 52 27 39 35 15zm126-384q1-32 1-64t1-64q0-63-3-128h-250q-3 65-3 128 0 64 3 128h251zm-638-128q0 32 4 64t12 64h243q-3-64-3-128 0-63 3-128H912q-8 32-12 64t-4 64zm512-512q-19 0-34 15t-27 39-21 53-15 57-10 53-6 39h225q-2-13-6-37t-11-53-16-58-20-54-27-39-32-15zm253 384q3 65 3 128v64q0 32-2 64h242q8-32 12-64t4-64q0-32-4-64t-12-64h-243zm190-128q-43-75-108-131t-145-88q21 52 32 107t19 112h202zm-637-218q-78 32-142 88t-107 130h200q13-111 49-218zm-249 730q42 73 106 129t142 88q-21-51-31-106t-17-111H965zm642 215q77-32 139-87t105-128h-198q-5 51-15 109t-31 106z" />
          </SvgIcon>
        ),
        iconProps: { iconName: "FileASPX" },
        href: "https://console.foxglove.dev/recordings",
      },
      {
        key: "open-connection",
        text: "Open connection",
        secondaryText: "Connect to a live robot or server.",
        icon: (
          <SvgIcon fontSize="large" color="primary" viewBox="0 0 2048 2048">
            <path d="M1408 256h640v640h-640V640h-120l-449 896H640v256H0v-640h640v256h120l449-896h199V256zM512 1664v-384H128v384h384zm1408-896V384h-384v384h384z" />
          </SvgIcon>
        ),
        onClick: () => {
          onSelectView("connection");
          void analytics.logEvent(AppEvent.DIALOG_SELECT_VIEW, { type: "live" });
        },
      },
      {
        key: "sample-data",
        text: "Explore sample data",
        secondaryText: "New to Foxglove Studio? Start here!",
        icon: (
          <SvgIcon fontSize="large" color="primary" viewBox="0 0 24 24">
            <path d="M10.54 8.6l1.1-2.22c.25-.5.97-.5 1.22 0l1.1 2.23 2.46.36c.56.08.78.76.37 1.15l-1.78 1.74.42 2.45c.1.55-.48.97-.98.71l-2.2-1.15-2.2 1.15a.68.68 0 01-.98-.71l.42-2.45-1.78-1.74a.68.68 0 01.37-1.15l2.46-.36zm1.06.93c-.1.2-.29.34-.51.37l-1.45.21 1.05 1.02c.16.16.23.39.2.6l-.26 1.45 1.3-.68c.2-.1.44-.1.64 0l1.3.68-.25-1.44a.68.68 0 01.2-.6l1.04-1.03-1.45-.21a.68.68 0 01-.51-.37l-.65-1.32-.65 1.32z"></path>
            <path d="M6.5 2A2.5 2.5 0 004 4.5v15A2.5 2.5 0 006.5 22h13.25a.75.75 0 000-1.5H6.5a1 1 0 01-1-1h14.25c.41 0 .75-.34.75-.75V4.5A2.5 2.5 0 0018 2H6.5zM19 18H5.5V4.5a1 1 0 011-1H18a1 1 0 011 1V18z" />
          </SvgIcon>
        ),
        onClick: () => {
          onSelectView("demo");
          void analytics.logEvent(AppEvent.DIALOG_SELECT_VIEW, { type: "demo" });
        },
      },
    ];
  }, [analytics, onSelectView, supportedLocalFileExtensions]);

  const recentItems: ActionListItem[] = useMemo(() => {
    return recentSources.map((recent) => {
      return {
        id: recent.id,
        children: (
          <Stack overflow="hidden" direction="row" gap={1}>
            <Typography variant="body2" color="inherit" component="div" noWrap overflow="hidden">
              <TextMiddleTruncate text={recent.title} />
            </Typography>
            {recent.label && (
              <Typography component="div" variant="body2" color="text.secondary" noWrap>
                {recent.label}
              </Typography>
            )}
          </Stack>
        ),
        onClick: () => selectRecent(recent.id),
      };
    });
  }, [recentSources, selectRecent]);

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
        <Stack flex="1 1 0" gap={2} style={{ gridRow: "1 / 4" }}>
          <Typography variant="h5" color="text.secondary">
            Open data source
          </Typography>
          <Stack gap={1.5}>
            {startItems.map((item) => (
              <DataSourceOption
                key={item.key}
                text={item.text}
                secondaryText={item.secondaryText}
                icon={item.icon}
                onClick={item.onClick}
                href={item.href}
              />
            ))}
          </Stack>
        </Stack>
        <ActionList gridColumn={2} title="Help" items={HELP_ITEMS} />
        <ActionList gridColumn={2} title="Contact" items={CONTACT_ITEMS} />
      </Grid>
      <FormControlLabel
        label="Show on startup"
        control={
          <Checkbox
            color="primary"
            checked={showOnStartup}
            onChange={async (_, checked) => {
              await setShowOnStartup(checked);
            }}
          />
        }
      />
    </Stack>
  );
}
