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

import { Button, FilledInput, Typography } from "@mui/material";
import React, { FormEvent } from "react";

import GlobalVariableName from "@foxglove/studio-base/components/GlobalVariableName";
import Stack from "@foxglove/studio-base/components/Stack";
import useGlobalVariables from "@foxglove/studio-base/hooks/useGlobalVariables";

import UnlinkGlobalVariables from "./UnlinkGlobalVariables";
import useLinkedGlobalVariables from "./useLinkedGlobalVariables";

type AddToLinkedGlobalVariable = {
  topic: string;
  markerKeyPath: string[];
  variableValue: unknown;
};

type Props = {
  addToLinkedGlobalVariable: AddToLinkedGlobalVariable;
  onClose: () => void;
};

function getInitialName(markerKeyPath: string[]) {
  return markerKeyPath.slice(0, 2).reverse().join("_");
}

export default function LinkToGlobalVariable({
  addToLinkedGlobalVariable: { topic, variableValue, markerKeyPath },
  onClose,
}: Props): JSX.Element {
  const [name, setName] = React.useState(() => getInitialName(markerKeyPath));

  const { setGlobalVariables } = useGlobalVariables();
  const { linkedGlobalVariables, setLinkedGlobalVariables } = useLinkedGlobalVariables();

  const addLink = (ev: FormEvent) => {
    ev.preventDefault();
    setGlobalVariables({ [name]: variableValue });
    const newLinkedGlobalVariables = [...linkedGlobalVariables, { topic, markerKeyPath, name }];
    setLinkedGlobalVariables(newLinkedGlobalVariables);
    onClose();
  };

  return (
    <form
      style={{ overflowWrap: "break-word", pointerEvents: "auto", width: 240 }}
      onSubmit={addLink}
      data-test="link-form"
    >
      <Stack padding={2} gap={1}>
        <Typography variant="body2">
          When linked, clicking a new object from {topic} will update the global variable&nbsp;
          <GlobalVariableName name={name} />.
        </Typography>
        <UnlinkGlobalVariables name={name} showList />
        <FilledInput
          size="small"
          autoFocus
          type="text"
          value={`$${name}`}
          onChange={(e) => setName(e.target.value.replace(/^\$/, ""))}
        />
        <Stack direction="row" gap={1} data-test="action-buttons">
          <Button
            variant="contained"
            color={name.length > 0 ? "primary" : "inherit"}
            disabled={name.length === 0}
            onClick={addLink}
          >
            Add Link
          </Button>
          <Button variant="contained" color="inherit" onClick={onClose}>
            Cancel
          </Button>
        </Stack>
      </Stack>
    </form>
  );
}
