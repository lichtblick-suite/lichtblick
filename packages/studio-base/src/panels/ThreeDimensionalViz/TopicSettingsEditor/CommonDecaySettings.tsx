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

import Flex from "@foxglove/studio-base/components/Flex";

import { SLabel, SDescription, SInput } from "./common";

export default function CommonDecaySettings({
  settings,
  onFieldChange,
}: {
  settings: { decayTime?: number };
  onFieldChange: (name: string, value: unknown) => unknown;
}): JSX.Element {
  const decayTime = settings.decayTime;
  const decayTimeValue = decayTime == undefined ? "" : decayTime;

  return (
    <Flex col>
      <SLabel>Decay time (seconds)</SLabel>
      <SDescription>When set to 0, only the latest received data will be displayed.</SDescription>
      <SInput
        type="number"
        placeholder="0"
        value={decayTimeValue}
        min={0}
        step={0.1}
        onChange={(e) => {
          const isInputValid = !isNaN(parseFloat(e.target.value));
          onFieldChange("decayTime", isInputValid ? parseFloat(e.target.value) : undefined);
        }}
      />
    </Flex>
  );
}
