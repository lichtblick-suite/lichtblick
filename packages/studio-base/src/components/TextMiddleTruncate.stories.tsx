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

import { fireEvent, screen } from "@testing-library/dom";

import TextMiddleTruncate from "./TextMiddleTruncate";

const LONG_TOPIC_NAME =
  "/some_really_long_topic_name/some/long/text/lorem/ipsum/dolor/sit/amet/consectetur/adipisicing/voluptate/laborum/amet/velit/eius/cum/modi//sapiente/natus/unde/end_topic_name";

export default {
  title: "components/TextMiddleTruncate",
  component: TextMiddleTruncate,
};

async function hoverText() {
  const allText = await screen.findAllByTestId("text-middle-truncate");
  fireEvent.pointerOver(allText[3]!);
}
export function Default(): JSX.Element {
  return (
    <div
      style={{
        display: "grid",
        gridAutoRows: 84,
        gridTemplateColumns: "300px 240px",
        gap: 16,
        padding: 16,
      }}
    >
      <div>Short text:</div>
      <TextMiddleTruncate text="Some short text" />

      <div>Long text:</div>
      <TextMiddleTruncate text="Some long text Lorem ipsum dolor sit amet consectetur adipisicing elit. Voluptate laborum amet velit eius cum modi qui. Sapiente natus unde assumenda." />

      <div>Specifify endTextLength as 20:</div>
      <TextMiddleTruncate
        endTextLength={20}
        text="Some long text Lorem ipsum dolor sit amet consectetur adipisicing elit. Voluptate laborum amet velit eius cum modi qui. Sapiente natus unde assumenda."
      />

      <div>Show the last part of topic name with visibile text:</div>
      <TextMiddleTruncate
        endTextLength={LONG_TOPIC_NAME.split("/").pop()!.length + 1}
        text={LONG_TOPIC_NAME}
      />
    </div>
  );
}
Default.play = hoverText;
