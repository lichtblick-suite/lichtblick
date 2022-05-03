// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Slider } from "@fluentui/react";
import { Stack } from "@mui/material";
import { pick } from "lodash";
import { useCallback, useMemo } from "react";
import { URDFRobot } from "urdf-loader";

export function JointValueSliders({
  model,
  customJointValues,
  onChange,
}: {
  model: URDFRobot;
  customJointValues?: Record<string, number>;
  onChange: (values: Record<string, number>) => void;
}): JSX.Element {
  const joints = useMemo(
    () => Object.entries(model.joints).sort(([key1], [key2]) => key1.localeCompare(key2)),
    [model.joints],
  );
  const setJointValue = useCallback(
    (name: string, val: number) => {
      const newValues = pick(customJointValues ?? {}, Object.keys(model.joints));
      newValues[name] = val;
      onChange(newValues);
    },
    [onChange, customJointValues, model.joints],
  );

  return (
    <Stack padding={1} style={{ overflowY: "auto", width: "40%", maxWidth: 300 }}>
      {joints.map(([name, joint]) => {
        const min = joint.jointType === "continuous" ? -Math.PI : +joint.limit.lower;
        const max = joint.jointType === "continuous" ? Math.PI : +joint.limit.upper;
        const value = customJointValues?.[name] ?? +joint.limit.lower;

        const RANGE = 10000;
        if (min === max) {
          return ReactNull;
        }
        return (
          <Slider
            key={name}
            label={name}
            min={0}
            max={RANGE}
            value={(RANGE * (value - min)) / (max - min)}
            onChange={(val) => setJointValue(name, min + (val / RANGE) * (max - min))}
            valueFormat={(val) => (min + (val / RANGE) * (max - min)).toFixed(2)}
          />
        );
      })}
    </Stack>
  );
}
