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

import { storiesOf } from "@storybook/react";
import styled from "styled-components";

import PanelSetupWithBag from "@foxglove/studio-base/stories/PanelSetupWithBag";
import bagFile from "@foxglove/studio-base/test/fixtures/example.bag";

import SourceInfo from "./index";

const SNarrow = styled.div`
  width: 200px;
  height: 100%;
`;

function PanelWithData() {
  return (
    <PanelSetupWithBag
      bag={bagFile}
      subscriptions={["/turtle1/pose", "/turtle2/pose", "/turtle1/cmd_vel", "/turtle2/cmd_vel"]}
    >
      <SourceInfo />
    </PanelSetupWithBag>
  );
}

storiesOf("panels/SourceInfo", module)
  .addParameters({
    chromatic: {
      delay: 1750,
    },
  })
  .add("default", () => {
    return <PanelWithData />;
  })
  .add("narrow panel", () => {
    // Ensure there is no overlapping text/unfortunate line breaks when the
    // panel doesn't have much horizontal space
    return (
      <SNarrow>
        <PanelWithData />
      </SNarrow>
    );
  });
