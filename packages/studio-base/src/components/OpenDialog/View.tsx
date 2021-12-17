// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ActionButton, DefaultButton, PrimaryButton, Stack, useTheme } from "@fluentui/react";
import { PropsWithChildren } from "react";

type ViewProps = {
  onBack?: () => void;
  onCancel?: () => void;
  onOpen?: () => void;
};

export default function View(props: PropsWithChildren<ViewProps>): JSX.Element {
  const { onCancel, onOpen, onBack } = props;
  const theme = useTheme();

  return (
    <Stack
      grow
      verticalFill
      verticalAlign="space-between"
      tokens={{ childrenGap: theme.spacing.m }}
    >
      {props.children}
      <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
        <ActionButton
          iconProps={{ iconName: "ChevronLeft" }}
          onClick={onBack}
          styles={{
            root: { color: theme.palette.themePrimary, padding: 0 },
            icon: { svg: { height: "1em", width: "1em" } },
          }}
        >
          Back
        </ActionButton>
        <Stack horizontal tokens={{ childrenGap: theme.spacing.m }}>
          <DefaultButton onClick={onCancel}>Cancel</DefaultButton>
          <PrimaryButton onClick={onOpen} disabled={onOpen == undefined}>
            Open
          </PrimaryButton>
        </Stack>
      </Stack>
    </Stack>
  );

  return <>{props.children}</>;
}
