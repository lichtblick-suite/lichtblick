// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import ErrorIcon from "@mui/icons-material/Error";
import HelpIcon from "@mui/icons-material/Help";
import InfoIcon from "@mui/icons-material/Info";
import WarningIcon from "@mui/icons-material/Warning";
import {
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Typography,
  styled as muiStyled,
} from "@mui/material";
import { invert } from "lodash";
import { ReactElement } from "react";

import Stack from "@foxglove/studio-base/components/Stack";
import { Diagnostic, DiagnosticSeverity } from "@foxglove/studio-base/players/UserNodePlayer/types";

const severityIcons = {
  Hint: <HelpIcon fontSize="small" />,
  Info: <InfoIcon fontSize="small" color="info" />,
  Warning: <WarningIcon fontSize="small" color="warning" />,
  Error: <ErrorIcon fontSize="small" color="error" />,
};

type Props = {
  diagnostics: readonly Diagnostic[];
};

const StyledListItem = muiStyled(ListItem)(({ theme }) => ({
  paddingTop: 0,
  paddingBottom: 0,

  ".MuiListItemText-root": {
    display: "flex",
    flexDirection: "row",
    gap: theme.spacing(1),
  },
  ".MuiListItemIcon-root": {
    minWidth: theme.spacing(3),
  },
}));

const DiagnosticsSection = ({ diagnostics }: Props): ReactElement => {
  if (diagnostics.length === 0) {
    return (
      <Stack gap={0.5} padding={2}>
        <Typography variant="body2" color="text.secondary">
          No problems to display.
        </Typography>
      </Stack>
    );
  }

  return (
    <List dense disablePadding>
      {diagnostics.map(({ severity, message, source, startColumn, startLineNumber }, i) => {
        const severityLabel =
          (invert(DiagnosticSeverity) as Record<string, keyof typeof DiagnosticSeverity>)[
            severity
          ] ?? "Error";

        const errorLoc =
          startLineNumber != undefined && startColumn != undefined
            ? `[${startLineNumber + 1},${startColumn + 1}]`
            : "";

        return (
          <StyledListItem key={`${message}_${i}`}>
            <ListItemIcon>{severityIcons[severityLabel]}</ListItemIcon>
            <ListItemText
              primary={message}
              primaryTypographyProps={{
                noWrap: true,
              }}
              secondary={`${source} ${errorLoc}`}
              secondaryTypographyProps={{
                color: "text.secondary",
                noWrap: true,
              }}
            />
          </StyledListItem>
        );
      })}
    </List>
  );
};

export default DiagnosticsSection;
