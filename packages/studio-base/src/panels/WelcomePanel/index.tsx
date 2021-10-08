// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import { Button, Icon, IIconStyles, Stack, Text, useTheme } from "@fluentui/react";
import { useState } from "react";
import { useAsyncFn } from "react-use";

import Checkbox from "@foxglove/studio-base/components/Checkbox";
import Panel from "@foxglove/studio-base/components/Panel";
import PanelToolbar from "@foxglove/studio-base/components/PanelToolbar";
import TextContent from "@foxglove/studio-base/components/TextContent";
import TextField from "@foxglove/studio-base/components/TextField";
import { useAppConfigurationValue } from "@foxglove/studio-base/hooks/useAppConfigurationValue";
import { useSubscribeContext } from "@foxglove/studio-base/panels/WelcomePanel/SubscribeContext";
import { colors } from "@foxglove/studio-base/util/sharedStyleConstants";
import { isEmail } from "@foxglove/studio-base/util/validators";

function validateEmail(str: string | undefined): string | undefined {
  return isEmail(str) ? undefined : "Enter a valid e-mail address";
}

const iconStyles: IIconStyles = {
  root: {
    svg: {
      fill: "currentColor",
      width: "1em",
      height: "1em",
      marginBottom: "-0.2em",
    },
  },
};

function WelcomePanel() {
  const theme = useTheme();

  const [subscribed = false, setSubscribed] =
    useAppConfigurationValue<boolean>("onboarding.subscribed");
  const [subscribeChecked, setSubscribeChecked] = useState(true);
  const [slackInviteChecked, setSlackInviteChecked] = useState(true);
  const [emailValue, setEmailValue] = useState("");
  const [emailError, setEmailError] = useState<string | undefined>();
  const subscribeToNewsletter = useSubscribeContext();

  const [submitState, submit] = useAsyncFn(async () => {
    if (slackInviteChecked && process.env.SLACK_INVITE_URL != undefined) {
      open(process.env.SLACK_INVITE_URL);
    }
    if (subscribeChecked) {
      await subscribeToNewsletter(emailValue);
    }
    await setSubscribed(true);
  }, [slackInviteChecked, subscribeChecked, setSubscribed, emailValue, subscribeToNewsletter]);

  const loading = submitState.loading;
  const error = submitState.error;

  const submitEnabled =
    (subscribeChecked || slackInviteChecked) &&
    emailValue.length > 0 &&
    emailError == undefined &&
    !loading;

  return (
    <Stack
      data-test="welcome-content"
      styles={{ root: { overflowY: "auto" } }}
      tokens={{ padding: theme.spacing.l1 }}
    >
      <PanelToolbar floating />
      <TextContent>
        <h1>Welcome</h1>
        <p>
          Foxglove Studio is an integrated visualization and debugging tool for robotics. It allows
          you to quickly and easily understand what’s happening in real-time, and provides a unique
          visualization and development experience.
        </p>
        <p>
          The configuration of views and graphs you’re looking at now is called the{" "}
          <b>
            <em>layout</em>
          </b>
          . Each view is a{" "}
          <b>
            <em>panel</em>
          </b>
          . You can rearrange panels to your liking: hover over them and drag the{" "}
          <Icon iconName="Drag" styles={iconStyles} /> icon. Click the{" "}
          <Icon iconName="PlusCircleOutline" styles={iconStyles} /> icon above and try adding a new
          panel. Don’t worry if you make a mistake—you can revert your changes from the Layouts
          sidebar. (This introduction is also a panel! When you’re done reading, hover over it and
          click the <Icon iconName="Cog" styles={iconStyles} /> icon to remove it.)
        </p>
        <p>
          Want to view data from your own ROS bag file? Double-click a bag file to open it with
          Foxglove Studio, or just drag &amp; drop it into the app. Click{" "}
          <Icon iconName="Database" styles={iconStyles} /> in the upper left to select another data
          source.
        </p>
        <Text
          variant="smallPlus"
          styles={{
            root: {
              display: "block",
              margin: `${theme.spacing.l1} 0 ${theme.spacing.s1}`,
              color: theme.semanticColors.bodyText,
            },
          }}
        >
          <b>
            To get in touch with us and learn more tips &amp; tricks, join our Slack community and
            subscribe to our mailing list:
          </b>
        </Text>

        <TextField
          placeholder="me@example.com"
          value={emailValue}
          onChange={setEmailValue}
          onError={setEmailError}
          validator={validateEmail}
        />
        <Checkbox
          label={`Send me updates about Foxglove Studio`}
          checked={subscribeChecked}
          onChange={setSubscribeChecked}
        />
        <Checkbox
          dataTest="slack-invite"
          label={`Invite me to the Slack community`}
          checked={slackInviteChecked}
          onChange={setSlackInviteChecked}
        />
        <Stack horizontalAlign="start" tokens={{ padding: `${theme.spacing.l1} 0 0` }}>
          <Button primary={!subscribed} disabled={!submitEnabled} onClick={submit}>
            {loading ? "Signing Up..." : "Sign Up"}
          </Button>
          &nbsp;
          {error ? (
            <span style={{ color: colors.RED2 }}>{error.toString()}</span>
          ) : subscribed && !submitState.loading ? (
            <span style={{ color: colors.GREEN2 }}>Thanks for signing up!</span>
          ) : undefined}
        </Stack>
      </TextContent>
    </Stack>
  );
}

export default Panel(
  Object.assign(WelcomePanel, {
    panelType: "onboarding.welcome",
    defaultConfig: {},
    supportsStrictMode: false,
  }),
);
