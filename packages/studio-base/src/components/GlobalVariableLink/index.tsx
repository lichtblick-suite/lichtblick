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

import { Menu, Tooltip, Typography } from "@mui/material";
import { useState } from "react";

import GlobalVariableName from "@foxglove/studio-base/components/GlobalVariableName";
import Stack from "@foxglove/studio-base/components/Stack";

import GlobalVariableLinkButton from "./GlobalVariableLinkButton";
import LinkToGlobalVariable from "./LinkToGlobalVariable";
import UnlinkGlobalVariable from "./UnlinkGlobalVariable";
import useLinkedGlobalVariables, { LinkedGlobalVariable } from "./useLinkedGlobalVariables";
import { getInitialName, getLinkedGlobalVariable } from "./utils";

type Props = {
  hasNestedValue?: boolean;
  label?: string;
  linkedGlobalVariable?: LinkedGlobalVariable;
  markerKeyPath?: string[];
  topic?: string;
  variableValue?: unknown;
  disablePadding?: boolean;
};

export default function GlobalVariableLink({
  hasNestedValue = false,
  label,
  linkedGlobalVariable,
  markerKeyPath,
  topic,
  variableValue,
  disablePadding = false,
}: Props): JSX.Element | ReactNull {
  const { linkedGlobalVariables } = useLinkedGlobalVariables();
  const [anchorEl, setAnchorEl] = useState<undefined | HTMLElement>(undefined);
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(undefined);
  };

  let linkedGlobalVariableLocal: LinkedGlobalVariable | undefined = linkedGlobalVariable;

  if (!linkedGlobalVariableLocal && topic && markerKeyPath) {
    linkedGlobalVariableLocal = getLinkedGlobalVariable({
      topic,
      markerKeyPath,
      linkedGlobalVariables,
    });
  }

  const isArrayBuffer = ArrayBuffer.isView(variableValue);
  const renderUnlink = !!linkedGlobalVariableLocal;
  const addToLinkedGlobalVariable =
    topic && markerKeyPath ? { topic, markerKeyPath, variableValue } : undefined;
  const renderAddLink = !renderUnlink && !isArrayBuffer && addToLinkedGlobalVariable != undefined;
  if (!renderUnlink && !renderAddLink) {
    return ReactNull;
  }

  return (
    <Stack
      paddingRight={0.75}
      gap={0.5}
      direction="row"
      alignItems="center"
      style={{ display: "inline-flex", marginRight: hasNestedValue ? -8 : undefined }}
    >
      {label && <span>{label}</span>}
      {(linkedGlobalVariableLocal != undefined || renderAddLink) && (
        <Tooltip
          arrow
          title={
            <Typography variant="body2">
              {linkedGlobalVariableLocal ? (
                <>
                  Unlink <GlobalVariableName name={linkedGlobalVariableLocal.name} />
                </>
              ) : (
                "Link this field to a global variable"
              )}
            </Typography>
          }
        >
          <GlobalVariableLinkButton
            color="info"
            linked={!renderAddLink}
            id="link-button"
            size="small"
            aria-controls={open ? "link-menu" : undefined}
            aria-haspopup="true"
            aria-expanded={open ? "true" : undefined}
            onClick={handleClick}
            data-test={
              linkedGlobalVariableLocal
                ? `unlink-${linkedGlobalVariableLocal.name}`
                : `link-${getInitialName(addToLinkedGlobalVariable?.markerKeyPath ?? [])}`
            }
          />
        </Tooltip>
      )}
      {linkedGlobalVariableLocal != undefined && (
        <GlobalVariableName name={linkedGlobalVariableLocal.name} paddingLeft={!disablePadding} />
      )}
      <Menu
        id="link-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        MenuListProps={{
          disablePadding: true,
          "aria-labelledby": "link-button",
        }}
      >
        {renderAddLink && (
          <LinkToGlobalVariable
            addToLinkedGlobalVariable={addToLinkedGlobalVariable}
            onClose={handleClose}
          />
        )}
        {linkedGlobalVariableLocal != undefined && (
          <UnlinkGlobalVariable
            linkedGlobalVariable={linkedGlobalVariableLocal}
            onClose={handleClose}
          />
        )}
      </Menu>
    </Stack>
  );
}
