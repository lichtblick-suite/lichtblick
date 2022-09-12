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

import TextMiddleTruncate from "./TextMiddleTruncate";

const LONG_TOPIC_NAME =
  "/some_really_long_topic_name/some/long/text/lorem/ipsum/dolor/sit/amet/consectetur/adipisicing/voluptate/laborum/amet/velit/eius/cum/modi//sapiente/natus/unde/end_topic_name";
storiesOf("components/TextMiddleTruncate", module).add("default", () => {
  return (
    <div style={{ width: 240, border: "1px solid gray", margin: 16 }}>
      <div>
        <p>Short text:</p>
        <TextMiddleTruncate text="Some short text" />
      </div>
      <div>
        <p>Long text:</p>
        <TextMiddleTruncate text="Some long text Lorem ipsum dolor sit amet consectetur adipisicing elit. Voluptate laborum amet velit eius cum modi qui. Sapiente natus unde assumenda." />
      </div>
      <div>
        <p>Specifify endTextLength as 20:</p>
        <TextMiddleTruncate
          endTextLength={20}
          text="Some long text Lorem ipsum dolor sit amet consectetur adipisicing elit. Voluptate laborum amet velit eius cum modi qui. Sapiente natus unde assumenda."
        />
      </div>
      <div>
        <p>Show the last part of topic name with visibile tooltip:</p>
        <TextMiddleTruncate
          tooltips={[<span key="0">This is a topic tooltip</span>]}
          testShowTooltip
          endTextLength={LONG_TOPIC_NAME.split("/").pop()!.length + 1}
          text={LONG_TOPIC_NAME}
        />
      </div>
    </div>
  );
});
