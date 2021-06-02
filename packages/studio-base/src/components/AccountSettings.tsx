// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { DefaultButton, PrimaryButton, Stack, useTheme } from "@fluentui/react";
import { useState } from "react";
import { useToasts } from "react-toast-notifications";

import { SidebarContent } from "@foxglove/studio-base/components/SidebarContent";
import { useTooltip } from "@foxglove/studio-base/components/Tooltip";
import { useAuth } from "@foxglove/studio-base/context/AuthContext";
import { usePrompt } from "@foxglove/studio-base/hooks/usePrompt";

export default function AccountSettings(): JSX.Element {
  const { currentUser, login: loginWithGoogle, loginWithCredential } = useAuth();
  const [loginAttempted, setLoginAttempted] = useState(false);
  const prompt = usePrompt();
  const { ref: tooltipRef, tooltip } = useTooltip({
    contents: "Use this if the login page didn't automatically redirect you back to Studio.",
  });
  const { addToast } = useToasts();

  const theme = useTheme();
  let content: JSX.Element;
  if (currentUser) {
    content = (
      <Stack tokens={{ childrenGap: theme.spacing.s1 }}>
        <div>Signed in as: {currentUser.email ?? "(no email address)"}</div>
        <DefaultButton text="Sign out" onClick={() => currentUser.logout()} />
      </Stack>
    );
  } else {
    content = (
      <Stack tokens={{ childrenGap: theme.spacing.s1 }}>
        <div>Sign in to access collaboration features like shared layouts.</div>
        <PrimaryButton
          text="Sign in with Google"
          onClick={() => {
            loginWithGoogle();
            setLoginAttempted(true);
          }}
        />
        {loginAttempted && (
          <DefaultButton
            elementRef={tooltipRef}
            text="Paste authentication token"
            onClick={async () => {
              try {
                const token = await prompt({
                  title: "Paste authentication token",
                  transformer: atob,
                });
                if (token != undefined) {
                  await loginWithCredential(token);
                }
              } catch (error) {
                addToast(`Login failed: ${error.toString()}`, { appearance: "error" });
              }
            }}
          />
        )}
        {tooltip}
      </Stack>
    );
  }
  return <SidebarContent title="Account">{content}</SidebarContent>;
}
