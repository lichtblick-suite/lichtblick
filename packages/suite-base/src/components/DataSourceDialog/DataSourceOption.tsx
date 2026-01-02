// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { Button, Link, Typography } from "@mui/material";

import { useStyles } from "@lichtblick/suite-base/components/DataSourceDialog/index.style";
import { DataSourceOptionProps } from "@lichtblick/suite-base/components/DataSourceDialog/types";
import Stack from "@lichtblick/suite-base/components/Stack";

const DataSourceOption = (props: DataSourceOptionProps): React.JSX.Element => {
  const { icon, onClick, text, secondaryText, href, target } = props;
  const { classes } = useStyles();
  const button = (
    <Button
      className={classes.connectionButton}
      fullWidth
      color="inherit"
      variant="outlined"
      startIcon={icon}
      onClick={onClick}
    >
      <Stack flex="auto" zeroMinWidth>
        <Typography variant="subtitle1" color="text.primary">
          {text}
        </Typography>
        <Typography variant="body2" color="text.secondary" noWrap>
          {secondaryText}
        </Typography>
      </Stack>
    </Button>
  );

  if (href) {
    return (
      <Link href={href} target={target} style={{ textDecoration: "none" }}>
        {button}
      </Link>
    );
  }

  return button;
};

export default DataSourceOption;
