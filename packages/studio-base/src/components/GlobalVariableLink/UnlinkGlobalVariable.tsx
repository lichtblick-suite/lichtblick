// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { Button, Typography } from "@mui/material";
import { isEqual } from "lodash";
import { useCallback } from "react";

import GlobalVariableName from "@foxglove/studio-base/components/GlobalVariableName";
import Stack from "@foxglove/studio-base/components/Stack";

import useLinkedGlobalVariables, { LinkedGlobalVariable } from "./useLinkedGlobalVariables";
import { getPath } from "./utils";

type Props = {
  linkedGlobalVariable: LinkedGlobalVariable;
  onClose: () => void;
};

export default function UnlinkGlobalVariable({
  linkedGlobalVariable: { topic, markerKeyPath, name },
  onClose,
}: Props): JSX.Element {
  const { linkedGlobalVariables, setLinkedGlobalVariables } = useLinkedGlobalVariables();

  const handleClick = useCallback(() => {
    const newLinkedGlobalVariables = linkedGlobalVariables.filter(
      (linkedGlobalVariable) =>
        !(
          linkedGlobalVariable.topic === topic &&
          isEqual(linkedGlobalVariable.markerKeyPath, markerKeyPath) &&
          linkedGlobalVariable.name === name
        ),
    );
    setLinkedGlobalVariables(newLinkedGlobalVariables);
    onClose();
  }, [linkedGlobalVariables, markerKeyPath, name, onClose, setLinkedGlobalVariables, topic]);

  return (
    <form data-test="unlink-form" style={{ overflowWrap: "break-word", pointerEvents: "auto" }}>
      <Stack padding={2} gap={1.5}>
        <Typography variant="body2" noWrap>
          Unlink <GlobalVariableName name={name} /> from {topic}.
          <Typography variant="inherit" display="inline" color="text.secondary">
            {getPath(markerKeyPath)}?
          </Typography>
        </Typography>
        <Stack direction="row" gap={1}>
          <Button size="small" color="error" variant="contained" onClick={handleClick}>
            Unlink
          </Button>
          <Button size="small" variant="contained" color="inherit" onClick={onClose}>
            Cancel
          </Button>
        </Stack>
      </Stack>
    </form>
  );
}
