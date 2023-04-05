// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Story } from "@storybook/react";

import CssBaseline from "./CssBaseline";

export default {
  component: CssBaseline,
  title: "components/CssBaseline",
  parameters: {
    colorScheme: "light",
  },
};

export const Scrollbars: Story = () => {
  return (
    <CssBaseline>
      <div
        style={{ width: "200px", height: "200px", border: "1px solid black", overflow: "scroll" }}
      >
        <div style={{ width: "400px", height: "400px" }}>Should have both scrollbars</div>
      </div>
    </CssBaseline>
  );
};
