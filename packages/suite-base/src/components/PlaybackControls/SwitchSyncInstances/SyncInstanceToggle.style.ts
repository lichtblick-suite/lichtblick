// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { makeStyles } from "tss-react/mui";

type UseStyleProps = {
  syncInstances: boolean;
};

export const useStyles = makeStyles<UseStyleProps>()((theme, { syncInstances }) => ({
  button: {
    padding: theme.spacing(0.3, 0),
    backgroundColor: "transparent",
    color: syncInstances ? "primary" : "inherit",
    ":hover": {
      backgroundColor: theme.palette.action.hover,
    },
  },
  textWrapper: {
    display: "flex",
    alignItems: "end",
  },
  syncText: {
    fontSize: 12,
    fontWeight: 500,
  },
  onOffText: {
    fontSize: 10,
    fontWeight: 400,
    marginTop: "-8px",
  },
}));
