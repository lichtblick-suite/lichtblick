// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import { Button, styled as muiStyled } from "@mui/material";
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

  return (
    <>
      <ViewStack flexGrow={1} fullHeight justifyContent="space-between" gap={2}>
        {props.children}
      </ViewStack>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Button startIcon={<ChevronLeftIcon fontSize="large" />} onClick={onBack} size="large">
          Back
        </Button>

        <Stack direction="row" gap={2}>
          <Button size="large" color="inherit" variant="outlined" onClick={onCancel}>
            Cancel
          </Button>
          <Button size="large" variant="contained" onClick={onOpen} disabled={onOpen == undefined}>
            Open
          </Button>
        </Stack>
      </Stack>
    </>
  );

  return <>{props.children}</>;
}
