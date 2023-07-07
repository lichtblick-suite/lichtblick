// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import CloseIcon from "@mui/icons-material/Close";
import { Dialog, IconButton } from "@mui/material";
import { useEffect, useState } from "react";

import SigninForm from "@foxglove/studio-base/components/SigninForm";
import Stack from "@foxglove/studio-base/components/Stack";
import { useCurrentUser } from "@foxglove/studio-base/context/CurrentUserContext";
import { useConfirm } from "@foxglove/studio-base/hooks/useConfirm";

type SignInFormModalProps = { userSwitchRequired: boolean };

export function SignInFormModal({ userSwitchRequired }: SignInFormModalProps): JSX.Element {
  const [open, setOpen] = useState(true);
  const { signOut } = useCurrentUser();
  const [confirm, confirmModal] = useConfirm();

  useEffect(() => {
    if (!userSwitchRequired) {
      return;
    }
    void confirm({
      title:
        "Your data source belongs to a different Foxglove organization. Do you want to sign out?",
      ok: "Sign out",
    }).then((response) => {
      if (response === "ok") {
        void signOut?.();
      }
    });
  }, [confirm, signOut, userSwitchRequired]);

  if (userSwitchRequired) {
    return <>{confirmModal}</>;
  }

  return (
    <Dialog open={open} onClose={() => setOpen(false)}>
      <Stack alignItems="end">
        <IconButton onClick={() => setOpen(false)}>
          <CloseIcon />
        </IconButton>
      </Stack>
      <Stack padding={3}>
        <SigninForm />
      </Stack>
    </Dialog>
  );
}
