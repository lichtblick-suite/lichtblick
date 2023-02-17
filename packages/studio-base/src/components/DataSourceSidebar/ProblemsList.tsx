// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import ErrorOutlineOutlinedIcon from "@mui/icons-material/ErrorOutlineOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import WarningIcon from "@mui/icons-material/WarningAmber";
import { List, ListItem, ListItemButton, ListItemText, Typography } from "@mui/material";
import { useCallback, useState } from "react";

import NotificationModal from "@foxglove/studio-base/components/NotificationModal";
import Stack from "@foxglove/studio-base/components/Stack";
import { PlayerProblem } from "@foxglove/studio-base/players/types";

export function ProblemsList({
  problems,
  setProblemModal,
}: {
  problems: PlayerProblem[];
  setProblemModal?: (_: JSX.Element | undefined) => void;
}): JSX.Element {
  const [localProblemModal, setLocalProblemModal] = useState<JSX.Element | undefined>();

  const showProblemModal = useCallback(
    (problem: PlayerProblem) => {
      const modal = (
        <NotificationModal
          notification={{
            message: problem.message,
            subText: problem.tip,
            details: problem.error,
            severity: problem.severity,
          }}
          onRequestClose={() => (setProblemModal ?? setLocalProblemModal)(undefined)}
        />
      );

      (setProblemModal ?? setLocalProblemModal)(modal);
    },
    [setProblemModal],
  );

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
      {localProblemModal}
      <List dense disablePadding>
        {problems.map((problem, idx) => (
          <ListItem disablePadding key={`${idx}`}>
            <ListItemButton onClick={() => showProblemModal(problem)}>
              <Stack direction="row" gap={0.5} alignItems="center">
                {problem.severity === "warn" && <WarningIcon fontSize="small" color="warning" />}
                {problem.severity === "error" && (
                  <ErrorOutlineOutlinedIcon fontSize="small" color="error" />
                )}
                {problem.severity === "info" && <InfoOutlinedIcon fontSize="small" color="info" />}
                <ListItemText primary={problem.message} />
              </Stack>
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Stack>
  );
}
