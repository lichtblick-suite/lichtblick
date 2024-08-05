// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Dismiss20Filled } from "@fluentui/react-icons";
import { CardHeader, CardHeaderProps, IconButton } from "@mui/material";

export const SidebarHeader = ({
  title,
  subheader,
  onClose,
}: {
  title: string;
  subheader?: CardHeaderProps["subheader"];
  onClose: () => void;
}): JSX.Element => (
  <CardHeader
    title={title}
    titleTypographyProps={{
      variant: "subtitle1",
      fontWeight: "600",
    }}
    subheader={subheader}
    subheaderTypographyProps={{
      variant: "body2",
      color: "text.secondary",
    }}
    action={
      <IconButton size="small" onClick={onClose} title="Collapse">
        <Dismiss20Filled />
      </IconButton>
    }
  />
);
