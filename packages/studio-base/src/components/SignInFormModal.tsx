// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import CloseIcon from "@mui/icons-material/Close";
import { Dialog, IconButton } from "@mui/material";
import { useState } from "react";

import SigninForm from "@foxglove/studio-base/components/AccountSettingsSidebar/SigninForm";
import Stack from "@foxglove/studio-base/components/Stack";

export function SignInFormModal(): JSX.Element {
  const [open, setOpen] = useState(true);

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
