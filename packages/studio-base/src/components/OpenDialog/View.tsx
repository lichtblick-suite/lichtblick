// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ActionButton, DefaultButton, PrimaryButton, useTheme } from "@fluentui/react";
import { styled as muiStyled } from "@mui/material";
import { PropsWithChildren } from "react";

import Stack from "@foxglove/studio-base/components/Stack";

type ViewProps = {
  onBack?: () => void;
  onCancel?: () => void;
  onOpen?: () => void;
};

const ViewStack = muiStyled(Stack)({
  "@media (min-height: 512px)": { overflow: "hidden" },
});

export default function View(props: PropsWithChildren<ViewProps>): JSX.Element {
  const { onCancel, onOpen, onBack } = props;
  const theme = useTheme();

  return (
    <>
      <ViewStack flexGrow={1} fullHeight justifyContent="space-between" gap={2}>
        {props.children}
      </ViewStack>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <ActionButton
          iconProps={{ iconName: "ChevronLeft" }}
          onClick={onBack}
          styles={{
            root: { color: theme.palette.themePrimary, padding: 0 },
            icon: { svg: { height: "1em", width: "1em" }, "> span": { display: "flex" } },
          }}
        >
          Back
        </ActionButton>
        <Stack direction="row" gap={2}>
          <DefaultButton onClick={onCancel}>Cancel</DefaultButton>
          <PrimaryButton onClick={onOpen} disabled={onOpen == undefined}>
            Open
          </PrimaryButton>
        </Stack>
      </Stack>
    </>
  );

  return <>{props.children}</>;
}
