// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2019-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { getNonOverlappingLabels } from "@foxglove/studio-base/components/SliderWithTicks";

describe("getNonOverlappingLabels", () => {
  const label = {
    text: "foo",
    value: 0,
  };
  const measuredLabels = [
    {
      ...label,
      tickWidth: 30,
    },
    {
      ...label,
      tickWidth: 40,
    },
    {
      ...label,
      tickWidth: 20,
    },
    {
      ...label,
      tickWidth: 100,
    },
  ];

  it("always returns at least 2 labels", () => {
    expect(getNonOverlappingLabels(measuredLabels, 10).length).toEqual(2);
  });

  it("keeps all the labels if it has room", () => {
    expect(getNonOverlappingLabels(measuredLabels, 1000).length).toEqual(4);
  });

  it("removes overlapping labels", () => {
    expect(getNonOverlappingLabels(measuredLabels, 100).length).toEqual(2);
  });
});
