// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import CloseIcon from "@mui/icons-material/Close";
import { ButtonBase, IconButton, Link, Typography } from "@mui/material";

import { AppSetting } from "@lichtblick/suite-base/AppSetting";
import { SignInPromptProps } from "@lichtblick/suite-base/components/LayoutBrowser/types";
import { useCurrentUser } from "@lichtblick/suite-base/context/CurrentUserContext";
import { useWorkspaceActions } from "@lichtblick/suite-base/context/Workspace/useWorkspaceActions";
import { useAppConfigurationValue } from "@lichtblick/suite-base/hooks";

import { useStyles } from "./SignInPrompt.style";

export default function SignInPrompt(props: Readonly<SignInPromptProps>): React.JSX.Element {
  const { onDismiss } = props;
  const { signIn } = useCurrentUser();
  const { classes } = useStyles();
  const { openAccountSettings } = useWorkspaceActions();
  const [topNavEnabled = false] = useAppConfigurationValue<boolean>(AppSetting.ENABLE_NEW_TOPNAV);

  const action = topNavEnabled ? signIn : openAccountSettings;

  return (
    <ButtonBase className={classes.root} onClick={action}>
      <Typography align="left" className={classes.title} variant="body2">
        <Link color="inherit" onClick={action} underline="always">
          Sign in
        </Link>{" "}
        to sync layouts across multiple devices, and share them with your organization.
      </Typography>
      {onDismiss != undefined && (
        <IconButton
          aria-label="Dismiss"
          size="small"
          role="button"
          onClick={(event) => {
            event.stopPropagation();
            onDismiss();
          }}
        >
          <CloseIcon />
        </IconButton>
      )}
    </ButtonBase>
  );
}
