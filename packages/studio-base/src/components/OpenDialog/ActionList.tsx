// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Link, Typography } from "@mui/material";
import { ReactNode } from "react";

import Stack from "@foxglove/studio-base/components/Stack";

export type ActionListItem = {
  id: string;
  children: ReactNode;
  href?: string;
  target?: string;
  onClick?: () => void;
};

type ActionListProps = {
  title?: ReactNode;
  items: ActionListItem[];
  gridColumn?: number | string;
};

export default function ActionList(props: ActionListProps): JSX.Element {
  const { items, title, gridColumn } = props;
  return (
    <Stack gap={1} style={{ gridColumn }}>
      {title != undefined && (
        <Typography variant="h5" color="text.secondary">
          {title}
        </Typography>
      )}
      <Stack gap={1.25} paddingY={0.5}>
        {items.map(({ id, ...item }) => (
          <Link underline="none" color="primary" key={id} id={id} {...item} />
        ))}
      </Stack>
    </Stack>
  );
}
