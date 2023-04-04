// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import CloseIcon from "@mui/icons-material/Close";
import { Dialog, IconButton, Stack, Typography } from "@mui/material";
import { useState } from "react";
import { makeStyles } from "tss-react/mui";

import WssErrorModalScreenshot from "./WssErrorModal.png";

const useStyles = makeStyles()({
  image: {
    maxWidth: "24rem",
  },
});

export default function WssErrorModal(props: { onClose?: () => void }): JSX.Element {
  const [open, setOpen] = useState(true);
  const { onClose } = props;

  const { classes } = useStyles();

  const handleClose = () => {
    setOpen(false);
    onClose?.();
  };

  return (
    <Dialog open={open} onClose={handleClose}>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="flex-start"
        paddingX={3}
        paddingTop={2}
      >
        <Typography variant="h3" paddingTop={1}>
          WebSocket SSL Error
        </Typography>
        <IconButton onClick={() => setOpen(false)} edge="end">
          <CloseIcon />
        </IconButton>
      </Stack>
      <Stack paddingX={3} paddingY={2} rowGap={2}>
        <Typography variant="body1" color="text.secondary">
          By default, Chrome prevents a secure <code>https://</code> page from connecting to an
          insecure <code>ws://</code> WebSocket server. To allow the connection, enable &quot;Unsafe
          Scripts&quot; for this page.
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Click the shield icon at the end of your address bar, and then click &quot;Load Unsafe
          Scripts.&quot;
        </Typography>
        <img src={WssErrorModalScreenshot} alt="WSS screenshot" className={classes.image} />
      </Stack>
    </Dialog>
  );
}
