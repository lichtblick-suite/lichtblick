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

import Radio, { RadioOption } from "@foxglove/studio-base/components/Radio";

const OPTIONS = {
  first: {
    id: "first",
    label: "First Option",
  },
  second: {
    id: "second",
    label: <i>Second Option</i>,
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
  const ref = React.useRef<HTMLDivElement>(ReactNull);
  React.useLayoutEffect(() => {
    if (ref.current && onMount) {
      onMount(ref.current);
    }
  }, [onMount]);
  return (
    <div style={{ margin: 24, width: 432 }} ref={ref}>
      <p>{title}</p>
      <div style={{ width: 432 }}>{children}</div>
    </div>
  );
}

const optionArr: RadioOption[] = Object.values(OPTIONS);

function ControlledExample() {
  const [selectedId, setSelectedId] = React.useState(OPTIONS.first.id);
  return (
    <Box
      title="clicked the 2nd option manually"
      onMount={React.useCallback((el: HTMLDivElement) => {
        const secondOptionEl = el.querySelector<HTMLElement>("[data-test='second']");
        if (secondOptionEl) {
          secondOptionEl.click();
        }
      }, [])}
    >
      <Radio
        options={optionArr}
        selectedId={selectedId}
        onChange={(newId) => setSelectedId(newId)}
      />
    </Box>
  );
}
storiesOf("components/Radio", module).add("basic", () => (
  <div>
    <Box title="default">
      <Radio
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
