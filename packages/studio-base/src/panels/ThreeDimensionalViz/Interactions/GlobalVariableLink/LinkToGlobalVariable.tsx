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

import LinkPlusIcon from "@mdi/svg/svg/link-plus.svg";
import { Button, Card, FilledInput, Typography } from "@mui/material";
import classNames from "classnames";
import React, { CSSProperties, FormEvent } from "react";

import ChildToggle from "@foxglove/studio-base/components/ChildToggle";
import Icon from "@foxglove/studio-base/components/Icon";
import Stack from "@foxglove/studio-base/components/Stack";
import useGlobalVariables from "@foxglove/studio-base/hooks/useGlobalVariables";
import GlobalVariableName from "@foxglove/studio-base/panels/ThreeDimensionalViz/Interactions/GlobalVariableName";
import { colors } from "@foxglove/studio-base/util/sharedStyleConstants";

import useLinkedGlobalVariables from "../useLinkedGlobalVariables";
import UnlinkGlobalVariables from "./UnlinkGlobalVariables";

type AddToLinkedGlobalVariable = {
  topic: string;
  markerKeyPath: string[];
  variableValue: unknown;
};

type Props = {
  highlight?: boolean;
  addToLinkedGlobalVariable: AddToLinkedGlobalVariable;
  style?: CSSProperties;
};

function getInitialName(markerKeyPath: string[]) {
  return markerKeyPath.slice(0, 2).reverse().join("_");
}

export default function LinkToGlobalVariable({
  style = {},
  addToLinkedGlobalVariable: { topic, variableValue, markerKeyPath },
  highlight = false,
}: Props): JSX.Element {
  const [isOpen, _setIsOpen] = React.useState<boolean>(false);
  const [name, setName] = React.useState(() => getInitialName(markerKeyPath));

  const setIsOpen = React.useCallback(
    // eslint-disable-next-line @foxglove/no-boolean-parameters
    (newValue: boolean) => {
      _setIsOpen(newValue);
      if (newValue) {
        setName(getInitialName(markerKeyPath));
      }
    },
    [markerKeyPath],
  );

  const { setGlobalVariables } = useGlobalVariables();
  const { linkedGlobalVariables, setLinkedGlobalVariables } = useLinkedGlobalVariables();

  const addLink = (ev: FormEvent) => {
    ev.preventDefault();
    setGlobalVariables({ [name]: variableValue });
    const newLinkedGlobalVariables = [...linkedGlobalVariables, { topic, markerKeyPath, name }];
    setLinkedGlobalVariables(newLinkedGlobalVariables);
    setIsOpen(false);
  };

  const highlightIconStyle = highlight ? { color: colors.HIGHLIGHT } : {};

  return (
    <ChildToggle
      dataTest={`link-${name}`}
      position="above"
      onToggle={setIsOpen}
      isOpen={isOpen}
      style={style}
    >
      <Icon
        className={classNames("link-icon", { highlight })}
        style={highlightIconStyle}
        fade={!highlight}
        tooltip="Link this field to a global variable"
        tooltipProps={{ placement: "top" }}
      >
        <LinkPlusIcon />
      </Icon>
      <Card
        elevation={4}
        component="form"
        variant="elevation"
        style={{ overflowWrap: "break-word", pointerEvents: "auto", width: 240 }}
        onSubmit={addLink}
        data-testid="link-form"
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
          <Stack direction="row" gap={1} data-testid="action-buttons">
            <Button
              variant="contained"
              color={name.length > 0 ? "primary" : "inherit"}
              disabled={name.length === 0}
              onClick={addLink}
            >
              Add Link
            </Button>
            <Button variant="contained" color="inherit" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
          </Stack>
        </Stack>
      </Card>
    </ChildToggle>
  );
}
