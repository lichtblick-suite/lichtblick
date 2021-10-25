// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { IconBase, Link, makeStyles, Stack, Text, useTheme } from "@fluentui/react";

import { useWorkspace } from "@foxglove/studio-base/context/WorkspaceContext";

type SignInPromptProps = {
  onDismiss?: () => void;
};

const useStyles = makeStyles((theme) => ({
  root: {
    backgroundColor: theme.palette.themeLighterAlt,
    position: "sticky",
    bottom: 0,
  },
  text: {
    lineHeight: "1.4",
  },
  link: {
    color: "inherit",
    textDecoration: "underline",
  },
  dismiss: {
    cursor: "pointer",
    fontSize: theme.fonts.small.fontSize,
    marginRight: theme.spacing.s2,
  },
}));

export default function SignInPrompt(props: SignInPromptProps): JSX.Element {
  const { onDismiss } = props;
  const { openAccountSettings } = useWorkspace();
  const theme = useTheme();
  const classes = useStyles();

  return (
    <Stack
      className={classes.root}
      horizontal
      verticalAlign="center"
      tokens={{
        padding: theme.spacing.m,
        childrenGap: theme.spacing.m,
      }}
    >
      <Text className={classes.text} variant="smallPlus">
        <Link onClick={openAccountSettings} className={classes.link}>
          Sign in
        </Link>{" "}
        to sync layouts across multiple devices, and share them with team members.
      </Text>
      {onDismiss != undefined && (
        <IconBase
          className={classes.dismiss}
          aria-label="Dismiss"
          role="button"
          onClick={(event) => {
            event.stopPropagation();
            onDismiss();
          }}
          iconName="Clear"
        />
      )}
    </Stack>
  );
}
