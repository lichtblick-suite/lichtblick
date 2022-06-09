// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Container, Typography, styled as muiStyled } from "@mui/material";
import { PropsWithChildren } from "react";

import Stack from "@foxglove/studio-base/components/Stack";

const StyledStack = muiStyled(Stack)(({ theme }) => ({
  backgroundColor: theme.palette.background.default,

  code: {
    color: theme.palette.primary.main,
    background: "transparent",
    padding: 0,
  },
}));

export default function EmptyState({ children }: PropsWithChildren<unknown>): JSX.Element {
  return (
    <StyledStack flex="auto" alignItems="center" justifyContent="center" fullWidth>
      <Container maxWidth={false}>
        <Typography
          component="div"
          variant="body2"
          color="text.secondary"
          lineHeight={1.4}
          align="center"
        >
          {children}
        </Typography>
      </Container>
    </StyledStack>
  );
}
