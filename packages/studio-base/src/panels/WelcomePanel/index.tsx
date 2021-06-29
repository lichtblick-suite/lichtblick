// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import CogIcon from "@mdi/svg/svg/cog.svg";
import DatabaseIcon from "@mdi/svg/svg/database.svg";
import DragIcon from "@mdi/svg/svg/drag.svg";
import PlusCircleOutlineIcon from "@mdi/svg/svg/plus-circle-outline.svg";
import { useState } from "react";
import { useAsyncFn } from "react-use";
import styled from "styled-components";

import OsContextSingleton from "@foxglove/studio-base/OsContextSingleton";
import Button from "@foxglove/studio-base/components/Button";
import Checkbox from "@foxglove/studio-base/components/Checkbox";
import Flex from "@foxglove/studio-base/components/Flex";
import Icon from "@foxglove/studio-base/components/Icon";
import Panel from "@foxglove/studio-base/components/Panel";
import PanelToolbar from "@foxglove/studio-base/components/PanelToolbar";
import TextContent from "@foxglove/studio-base/components/TextContent";
import TextField from "@foxglove/studio-base/components/TextField";
import { useAppConfigurationValue } from "@foxglove/studio-base/hooks/useAppConfigurationValue";
import { useSubscribeContext } from "@foxglove/studio-base/panels/WelcomePanel/SubscribeContext";
import colors from "@foxglove/studio-base/styles/colors.module.scss";
import { isEmail } from "@foxglove/studio-base/util/validators";

const Term = styled.span`
  font-weight: bold;
  font-style: italic;
`;

function validateEmail(str: string | undefined): string | undefined {
  return isEmail(str) ? undefined : "Enter a valid e-mail address";
}

function WelcomePanel() {
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

  // TODO: optional chaining is compiled out (for storybook) if used here; may be a webpack bug
  const commandOrControl =
    (OsContextSingleton && OsContextSingleton.platform === "darwin" && "⌘") ?? "^";

  return (
    <Flex col scroll dataTest="welcome-content">
      <PanelToolbar floating />
      <TextContent style={{ padding: 12 }}>
        <h2 style={{ fontSize: "1.5em", marginBottom: "0.8em" }}>Welcome</h2>
        <p>
          Foxglove Studio is an integrated visualization and debugging tool for robotics. It allows
          you to quickly and easily understand what’s happening in real-time, and provides a unique
          visualization and development experience.
        </p>
        <p>
          The configuration of views and graphs you’re looking at now is called the{" "}
          <Term>layout</Term>. Each view is a <Term>panel</Term>. You can rearrange panels to your
          liking: hover over them and drag the{" "}
          <Icon clickable={false}>
            <DragIcon />
          </Icon>{" "}
          icon. Click the{" "}
          <Icon clickable={false}>
            <PlusCircleOutlineIcon />
          </Icon>{" "}
          icon above and try adding a new panel. Don’t worry if you make a mistake—you can press{" "}
          <code>{commandOrControl}Z</code> to undo your changes. (This introduction is also a panel!
          When you’re done reading, hover over it and click the{" "}
          <Icon clickable={false}>
            <CogIcon />
          </Icon>{" "}
          icon to remove it.)
        </p>
        <p>
          Want to view data from your own ROS bag file? Double-click a bag file to open it with
          Foxglove Studio, or just drag &amp; drop it into the app. Click{" "}
          <Icon clickable={false}>
            <DatabaseIcon />
          </Icon>{" "}
          in the upper left to select another data source.
        </p>
        <p style={{ marginTop: "3em" }}>
          To get in touch with us and learn more tips &amp; tricks, join our Slack community and
          subscribe to our mailing list:
        </p>
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
        <div style={{ marginTop: "0.5em" }}>
          <Button isPrimary={!subscribed} disabled={!submitEnabled} onClick={submit}>
            {loading ? "Signing Up..." : "Sign Up"}
          </Button>
          &nbsp;
          {error ? (
            <span style={{ color: colors.red }}>{error.toString()}</span>
          ) : subscribed && !submitState.loading ? (
            <span style={{ color: colors.green }}>Thanks for signing up!</span>
          ) : undefined}
        </div>
      </TextContent>
    </Flex>
  );
}

export default Panel(
  Object.assign(WelcomePanel, {
    panelType: "onboarding.welcome",
    defaultConfig: {},
    supportsStrictMode: false,
  }),
);
