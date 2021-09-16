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

import styled from "styled-components";

import HelpModal from "@foxglove/studio-base/components/HelpModal";
import KeyboardShortcut from "@foxglove/studio-base/components/KeyboardShortcut";

const STitle = styled.h3`
  margin: 16px 0 8px 0;
`;

const COMMAND = "⌘";

type Props = {
  onRequestClose: () => void;
};
export default function ShortcutsModal({ onRequestClose }: Props): React.ReactElement {
  return (
    <HelpModal onRequestClose={onRequestClose}>
      <h2>Keyboard shortcuts</h2>
      <STitle>Global</STitle>
      <KeyboardShortcut description="Show shortcuts" keys={[COMMAND, "/"]} />

      <STitle>Panels</STitle>
      <KeyboardShortcut
        description="Select panel to group into a Tab panel"
        keys={[COMMAND, "click"]}
      />
      <KeyboardShortcut description="Select all panels" keys={[COMMAND, "a"]} />
      <KeyboardShortcut description="View panel shortcuts" keys={["hover", "~"]} />

      <STitle>Playback bar</STitle>
      <KeyboardShortcut description="Pause or play" keys={["Space"]} />
      <KeyboardShortcut description="Seek forward 100ms" keys={["⇢"]} />
      <KeyboardShortcut description="Seek backward 100ms" keys={["⇠"]} />
    </HelpModal>
  );
}
