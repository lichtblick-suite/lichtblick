// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Stack, StackItem, Text, makeStyles } from "@fluentui/react";

type DeviceCodePanelProps = {
  userCode: string;
  verificationUrl: string;
};

const useStyles = makeStyles((theme) => {
  return {
    text: {
      textAlign: "center",
      fontWeight: "bold",
      padding: theme.spacing.l1,
    },
  };
});

// Show instructions on opening the browser and entering the device code
export default function DeviceCode(props: DeviceCodePanelProps): JSX.Element {
  const classes = useStyles();
  return (
    <Stack>
      <StackItem>
        <Text variant="large">1. Open the following URL in your browser</Text>
      </StackItem>
      <StackItem className={classes.text}>
        <Text variant="large">
          <a href={props.verificationUrl}>{props.verificationUrl}</a>
        </Text>
      </StackItem>

      <Text variant="large">2. Enter this code</Text>
      <StackItem className={classes.text}>
        <Text variant="xLarge">{props.userCode} </Text>
      </StackItem>

      <Text variant="large">3. Waiting for activation...</Text>
    </Stack>
  );
}
