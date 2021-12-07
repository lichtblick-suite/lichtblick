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

import { SidebarContent } from "@foxglove/studio-base/components/SidebarContent";
import TextContent from "@foxglove/studio-base/components/TextContent";

const stories = storiesOf("Help pages", module).addParameters({ colorScheme: "dark" });

export function makeHelpPageStories(req: ReturnType<typeof require.context>): void {
  const helpData = req.keys().map((name) => ({ name, data: req(name) }));

  helpData.forEach(({ name, data }) => {
    stories.add(name, () => (
      <SidebarContent title={name}>
        <TextContent allowMarkdownHtml={true}>
          {data.default != undefined ? data.default : data}
        </TextContent>
      </SidebarContent>
    ));
  });
}

makeHelpPageStories(require.context("../", true, /\.help\.(js|md)$/));
