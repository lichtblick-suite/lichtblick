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

import PlusCircleIcon from "@mui/icons-material/AddCircle";
import MinusCircleIcon from "@mui/icons-material/RemoveCircle";
import { Box, Stack } from "@mui/material";
import { storiesOf } from "@storybook/react";
import { ReactNode, useEffect, useState } from "react";

import ChildToggle, { ChildToggleContainsOpen } from "@foxglove/studio-base/components/ChildToggle";

const MARGIN = 6.25;

const Block = (props: { children: ReactNode }) => (
  <Box width={50} bgcolor="red">
    {props.children}
  </Box>
);

function ChildToggleStory() {
  const [isOpen, setIsOpen] = useState(true);
  const icon = isOpen ? (
    <MinusCircleIcon fontSize="inherit" />
  ) : (
    <PlusCircleIcon fontSize="inherit" />
  );
  const [containsOpen1, setContainsOpen1] = useState(false);
  const [containsOpen2, setContainsOpen2] = useState(false);
  return (
    <Stack flex="auto" alignItems="center" justifyContent="center" position="relative">
      <Box margin={MARGIN} border="1px solid gray">
        <ChildToggle position="right" onToggle={setIsOpen} isOpen={isOpen}>
          {icon}
          <Block>this opens right-aligned of the icon</Block>
        </ChildToggle>
      </Box>
      <Box marginTop={7.5} marginBottom={1.25} border="1px solid gray">
        <ChildToggle position="above" onToggle={setIsOpen} isOpen={isOpen}>
          {icon}
          <Block>this opens above the icon</Block>
        </ChildToggle>
      </Box>
      <Box margin={MARGIN} border="1px solid gray">
        <ChildToggle position="below" onToggle={setIsOpen} isOpen={isOpen}>
          {icon}
          <Block>this opens below the icon</Block>
        </ChildToggle>
      </Box>
      <Box margin={MARGIN} border="1px solid gray">
        <ChildToggle position="bottom-left" onToggle={setIsOpen} isOpen={isOpen}>
          {icon}
          <Block>this opens below and to the left of the icon</Block>
        </ChildToggle>
      </Box>
      <Box margin={MARGIN} border="1px solid gray">
        <ChildToggle position="left" onToggle={setIsOpen} isOpen={isOpen}>
          {icon}
          <Block>this opens left-aligned of the icon</Block>
        </ChildToggle>
      </Box>
      <Box margin={MARGIN} border="1px solid gray">
        <ChildToggleContainsOpen onChange={setContainsOpen1}>
          <div>
            Contains an open child toggle: {JSON.stringify(containsOpen1)}
            <ChildToggle position="below" onToggle={setIsOpen} isOpen={isOpen}>
              {icon}
              <Block>this opens below</Block>
            </ChildToggle>
          </div>
        </ChildToggleContainsOpen>
      </Box>
      <Box margin={MARGIN} border="1px solid gray">
        <ChildToggleContainsOpen onChange={setContainsOpen2}>
          <div>
            Contains an open child toggle: {JSON.stringify(containsOpen2)}
            <ChildToggle position="below">
              {icon}
              <Block>this should never be visible</Block>
            </ChildToggle>
          </div>
        </ChildToggleContainsOpen>
      </Box>
    </Stack>
  );
}

function UncontrolledChildToggleStory({ defaultIsOpen }: { defaultIsOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(defaultIsOpen ?? false);
  const icon = isOpen ? (
    <MinusCircleIcon fontSize="inherit" />
  ) : (
    <PlusCircleIcon fontSize="inherit" />
  );
  return (
    <Box margin={MARGIN} border="1px solid gray">
      <ChildToggle position="right" onToggle={setIsOpen} defaultIsOpen={defaultIsOpen}>
        {icon}
        <Block>this opens right-aligned of the icon</Block>
      </ChildToggle>
    </Box>
  );
}
storiesOf("components/ChildToggle", module)
  .addParameters({ colorScheme: "dark" })
  .add("controlled", () => <ChildToggleStory />)
  .add("uncontrolled", () => <UncontrolledChildToggleStory />)
  .add("uncontrolled with defaultIsOpen", () => (
    <UncontrolledChildToggleStory defaultIsOpen={true} />
  ))
  .add("closes when Escape key pressed", () => {
    useEffect(() => {
      setImmediate(() =>
        document.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Escape", code: "Escape", keyCode: 27 }),
        ),
      );
    }, []);
    return <ChildToggleStory />;
  });
