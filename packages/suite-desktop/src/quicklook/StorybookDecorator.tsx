// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Story, StoryContext } from "@storybook/react";

import { GlobalStyle } from "./GlobalStyle";

export default function StorybookDecorator(Child: Story, _ctx: StoryContext): JSX.Element {
  return (
    <>
      <GlobalStyle />
      <Child />
    </>
  );
}
