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

import { Button, Typography, styled as muiStyled, Menu, Tooltip } from "@mui/material";
import { isEqual } from "lodash";
import { useState } from "react";

import GlobalVariableName from "@foxglove/studio-base/components/GlobalVariableName";
import Stack from "@foxglove/studio-base/components/Stack";

import GlobalVariableLinkButton from "./GlobalVariableLinkButton";
import useLinkedGlobalVariables, { LinkedGlobalVariable } from "./useLinkedGlobalVariables";
import { getPath } from "./utils";

type Props = {
  name: string;
  showList?: boolean;
};

const StyledButton = muiStyled(Button)({
  lineHeight: 1.125,
  minWidth: "auto",
});

export default function UnlinkGlobalVariables({
  name,
  showList = false,
}: Props): JSX.Element | ReactNull {
  const [anchorEl, setAnchorEl] = useState<undefined | HTMLElement>(undefined);
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(undefined);
  };

  const { linkedGlobalVariables, linkedGlobalVariablesByName, setLinkedGlobalVariables } =
    useLinkedGlobalVariables();

  const links: LinkedGlobalVariable[] = linkedGlobalVariablesByName[name] ?? [];
  const firstLink = links[0];

  if (!firstLink) {
    return ReactNull;
  }

  // the list UI is shared between 3D panel and Global Variables panel
  const listHtml = (
    <Stack gap={1} padding={showList ? 0 : 2}>
      {links.map(({ topic, markerKeyPath, name: linkedGlobalVariableName }, idx) => {
        return (
          <Stack key={idx} gap={1} alignItems="center" direction="row">
            <StyledButton
              variant="contained"
              color="error"
              size="small"
              onClick={() => {
                const newLinkedGlobalVariables = linkedGlobalVariables.filter(
                  (linkedGlobalVariable) =>
                    !(
                      linkedGlobalVariable.topic === topic &&
                      isEqual(linkedGlobalVariable.markerKeyPath, markerKeyPath) &&
                      linkedGlobalVariable.name === linkedGlobalVariableName
                    ),
                );
                setLinkedGlobalVariables(newLinkedGlobalVariables);
              }}
            >
              Unlink
            </StyledButton>
            <Typography
              variant="body2"
              noWrap
              flex="auto"
              title={`${topic}.${getPath(markerKeyPath)}`}
            >
              {topic}.
              <Typography variant="inherit" display="inline" color="text.secondary">
                {getPath(markerKeyPath)}
              </Typography>
            </Typography>
          </Stack>
        );
      })}
    </Stack>
  );
  if (showList) {
    return (
      <>
        <Typography variant="body2" gutterBottom>
          Some links already exist for this variable. The variable’s value will be taken from the
          most recently clicked linked topic.
        </Typography>
        {listHtml}
      </>
    );
  }

  return (
    <Stack
      direction="row"
      align-items="center"
      style={{ wordBreak: "normal", display: "inline-flex" }}
      gap={0.5}
    >
      <Tooltip
        title={
          <Typography variant="body2" component="span">
            Unlink <GlobalVariableName name={name} />
          </Typography>
        }
      >
        <GlobalVariableLinkButton
          color="info"
          linked
          size="small"
          id={`unlink-${firstLink.name}-button`}
          aria-controls={open ? `unlink-${firstLink.name}-menu` : undefined}
          aria-haspopup="true"
          aria-expanded={open ? "true" : undefined}
          onClick={handleClick}
          data-test={`unlink-${firstLink.name}`}
        />
      </Tooltip>
      <GlobalVariableName name={firstLink.name} paddingLeft />
      <Menu
        id={`unlink-${firstLink.name}-menu`}
        anchorEl={anchorEl}
        open
        onClose={handleClose}
        MenuListProps={{
          disablePadding: true,
          "aria-labelledby": `unlink-${firstLink.name}-menu`,
        }}
        PaperProps={{
          style: { pointerEvents: "auto", maxWidth: 320 },
        }}
      >
        <form data-test="unlink-form">{listHtml}</form>
      </Menu>
    </Stack>
  );
}
