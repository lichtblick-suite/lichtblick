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

import { Button, Card, Typography } from "@mui/material";
import { isEqual } from "lodash";
import { useCallback } from "react";

import Stack from "@foxglove/studio-base/components/Stack";
import GlobalVariableName from "@foxglove/studio-base/panels/ThreeDimensionalViz/Interactions/GlobalVariableName";

import { getPath } from "../interactionUtils";
import useLinkedGlobalVariables, { LinkedGlobalVariable } from "../useLinkedGlobalVariables";

type Props = {
  linkedGlobalVariable: LinkedGlobalVariable;
  // eslint-disable-next-line @foxglove/no-boolean-parameters
  setIsOpen: (arg0: boolean) => void;
};

export default function UnlinkGlobalVariable({
  linkedGlobalVariable: { topic, markerKeyPath, name },
  setIsOpen,
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
    setIsOpen(false);
  }, [linkedGlobalVariables, markerKeyPath, name, setIsOpen, setLinkedGlobalVariables, topic]);

  return (
    <Card
      elevation={4}
      component="form"
      variant="elevation"
      data-testid="unlink-form"
      style={{ overflowWrap: "break-word", pointerEvents: "auto" }}
    >
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
          <Button size="small" variant="contained" color="inherit" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
        </Stack>
      </Stack>
    </Card>
  );
}
