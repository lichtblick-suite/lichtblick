// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import AddIcon from "@mui/icons-material/Add";
import { Divider, IconButton } from "@mui/material";
import { partition, union } from "lodash";
import { useMemo, useRef, useState, ReactElement, useEffect } from "react";

import { SidebarContent } from "@foxglove/studio-base/components/SidebarContent";
import Stack from "@foxglove/studio-base/components/Stack";
import useGlobalVariables, {
  GlobalVariables,
} from "@foxglove/studio-base/hooks/useGlobalVariables";
import useLinkedGlobalVariables from "@foxglove/studio-base/panels/ThreeDimensionalViz/Interactions/useLinkedGlobalVariables";

import Variable from "./Variable";
import helpContent from "./index.help.md";

const ANIMATION_RESET_DELAY_MS = 1500;

export default function VariablesSidebar(): ReactElement {
  const { globalVariables, setGlobalVariables } = useGlobalVariables();
  const { linkedGlobalVariablesByName } = useLinkedGlobalVariables();
  const globalVariableNames = useMemo(() => Object.keys(globalVariables), [globalVariables]);

  const [linked, unlinked] = useMemo(() => {
    return partition(globalVariableNames, (name) => !!linkedGlobalVariablesByName[name]);
  }, [globalVariableNames, linkedGlobalVariablesByName]);

  // Don't run the animation when the sidebar first renders
  const skipAnimation = useRef<boolean>(true);

  useEffect(() => {
    const timeoutId = setTimeout(() => (skipAnimation.current = false), ANIMATION_RESET_DELAY_MS);
    return () => clearTimeout(timeoutId);
  }, []);

  const previousGlobalVariablesRef = useRef<GlobalVariables | undefined>(globalVariables);
  const [changedVariables, setChangedVariables] = useState<string[]>([]);

  useEffect(() => {
    if (skipAnimation.current) {
      previousGlobalVariablesRef.current = globalVariables;
      return;
    }
    const newChangedVariables = union(
      Object.keys(globalVariables),
      Object.keys(previousGlobalVariablesRef.current ?? {}),
    ).filter((name) => {
      const previousValue = previousGlobalVariablesRef.current?.[name];
      return previousValue !== globalVariables[name];
    });

    setChangedVariables(newChangedVariables);
    previousGlobalVariablesRef.current = globalVariables;
    const timerId = setTimeout(() => setChangedVariables([]), ANIMATION_RESET_DELAY_MS);
    return () => clearTimeout(timerId);
  }, [globalVariables, skipAnimation]);

  return (
    <SidebarContent
      title="Variables"
      disablePadding
      helpContent={helpContent}
      trailingItems={[
        <IconButton
          data-testid="add-variable-button"
          key="add-global-variable"
          color="primary"
          disabled={globalVariables[""] != undefined}
          onClick={() => setGlobalVariables({ "": '""' })}
        >
          <AddIcon />
        </IconButton>,
      ]}
    >
      <Stack flex="auto">
        <Divider />
        {linked.map((name, idx) => (
          <Variable
            key={`linked.${name}`}
            name={name}
            selected={!skipAnimation.current && changedVariables.includes(name)}
            linked
            linkedIndex={linked.length + idx}
          />
        ))}
        {unlinked.map((name, idx) => (
          <Variable
            key={`unlinked.${name}`}
            name={name}
            selected={!skipAnimation.current && changedVariables.includes(name)}
            linkedIndex={linked.length + idx}
          />
        ))}
      </Stack>
    </SidebarContent>
  );
}
