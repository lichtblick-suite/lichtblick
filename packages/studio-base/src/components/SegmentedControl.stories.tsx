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

import { storiesOf } from "@storybook/react";

import SegmentedControl, { Option } from "@foxglove/studio-base/components/SegmentedControl";

const OPTIONS = {
  first: {
    id: "first",
    label: "First Option",
  },
  second: {
    id: "second",
    label: "Second Option",
  },
  third: {
    id: "third",
    label: "Third Option",
  },
};

function Box({
  title = "",
  children,
  onMount,
}: {
  title?: string;
  children: React.ReactNode;
  onMount?: (arg0: HTMLDivElement) => void;
}) {
  return (
    <div
      style={{ margin: 24, width: 432 }}
      ref={(el) => {
        if (el && onMount) {
          onMount(el);
        }
      }}
    >
      <p>{title}</p>
      <div style={{ width: 432 }}>{children}</div>
    </div>
  );
}

const optionArr: Option[] = Object.values(OPTIONS);

function ControlledExample() {
  const [selectedId, setSelectedId] = React.useState(OPTIONS.first.id);
  return (
    <Box
      title="clicked the 2nd option manually"
      onMount={(el) => {
        const secondOptionEl = el.querySelector("[data-testid='second']");
        if (secondOptionEl) {
          (secondOptionEl as any).click();
        }
      }}
    >
      <SegmentedControl
        options={optionArr}
        selectedId={selectedId}
        onChange={(newId) => setSelectedId(newId)}
      />
    </Box>
  );
}
storiesOf("components/SegmentedControl", module).add("basic", () => (
  <div>
    <Box title="default">
      <SegmentedControl
        options={optionArr}
        selectedId="first"
        onChange={() => {
          // no-op
        }}
      />
    </Box>
    <ControlledExample />
  </div>
));
