// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import CloseIcon from "@mui/icons-material/Close";
import { CardHeader, IconButton, Link, styled as muiStyled } from "@mui/material";

import { AppSetting } from "@foxglove/studio-base/AppSetting";
import { useCurrentUser } from "@foxglove/studio-base/context/CurrentUserContext";
import { useWorkspace } from "@foxglove/studio-base/context/WorkspaceContext";
import { useAppConfigurationValue } from "@foxglove/studio-base/hooks";

type SignInPromptProps = {
  onDismiss?: () => void;
};

const StyledCardHeader = muiStyled(CardHeader)(({ theme }) => ({
  cursor: "pointer",
  backgroundColor: theme.palette.grey[200],
  position: "sticky",
  bottom: 0,

  "& .MuiCardHeader-action": {
    alignSelf: "center",
  },
  "&:hover": {
    backgroundColor: theme.palette.grey[300],
  },
}));

export default function SignInPrompt(props: SignInPromptProps): JSX.Element {
  const { onDismiss } = props;
  const { signIn } = useCurrentUser();
  const { openAccountSettings } = useWorkspace();
  const [topNavEnabled = false] = useAppConfigurationValue<boolean>(AppSetting.ENABLE_NEW_TOPNAV);

  const action = topNavEnabled ? signIn : openAccountSettings;

  return (
    <StyledCardHeader
      onClick={action}
      title={
        <>
          <Link color="inherit" onClick={action} underline="always">
            Sign in
          </Link>{" "}
          to sync layouts across multiple devices, and share them with your organization.
        </>
      }
      titleTypographyProps={{
        variant: "body2",
      }}
      action={
        onDismiss != undefined && (
          <IconButton
            aria-label="Dismiss"
            role="button"
            onClick={(event) => {
              event.stopPropagation();
              onDismiss();
            }}
          >
            <CloseIcon />
          </IconButton>
        )
      }
    />
  );
}
