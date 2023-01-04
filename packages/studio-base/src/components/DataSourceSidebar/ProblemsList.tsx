// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import ErrorIcon from "@mui/icons-material/ErrorOutline";
import InfoIcon from "@mui/icons-material/InfoOutlined";
import WarningIcon from "@mui/icons-material/WarningAmber";
import { List, ListItem, ListItemButton, ListItemText, Typography } from "@mui/material";
import { useCallback, useState } from "react";

import NotificationModal from "@foxglove/studio-base/components/NotificationModal";
import Stack from "@foxglove/studio-base/components/Stack";
import { PlayerProblem } from "@foxglove/studio-base/players/types";

export function ProblemsList({ problems }: { problems: PlayerProblem[] }): JSX.Element {
  const [problemModal, setProblemModal] = useState<JSX.Element | undefined>();

  const showProblemModal = useCallback((problem: PlayerProblem) => {
    setProblemModal(
      <NotificationModal
        notification={{
          message: problem.message,
          subText: problem.tip,
          details: problem.error,
          severity: problem.severity,
        }}
        onRequestClose={() => setProblemModal(undefined)}
      />,
    );
  }, []);

  if (problems.length === 0) {
    return (
      <Stack flex="auto" padding={2} fullHeight alignItems="center" justifyContent="center">
        <Typography align="center" color="text.secondary">
          No problems found
        </Typography>
      </Stack>
    );
  }

  return (
    <Stack fullHeight flex="auto" overflow="auto">
      {problemModal}
      <List dense disablePadding>
        {problems.map((problem, idx) => (
          <ListItem disablePadding key={`${idx}`}>
            <ListItemButton onClick={() => showProblemModal(problem)}>
              <Stack direction="row" gap={1}>
                {problem.severity === "warn" && <WarningIcon color="warning" />}
                {problem.severity === "error" && <ErrorIcon color="error" />}
                {problem.severity === "info" && <InfoIcon color="info" />}
                <ListItemText
                  primary={problem.message}
                  primaryTypographyProps={{
                    color:
                      problem.severity === "warn" ? "warning.main" : `${problem.severity}.main`,
                  }}
                />
              </Stack>
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Stack>
  );
}
