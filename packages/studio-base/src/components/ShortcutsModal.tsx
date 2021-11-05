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

import HelpModal from "@foxglove/studio-base/components/HelpModal";
import KeyboardShortcut from "@foxglove/studio-base/components/KeyboardShortcut";

const COMMAND = "⌘";

type Props = {
  onRequestClose: () => void;
};
export default function ShortcutsModal({ onRequestClose }: Props): React.ReactElement {
  return (
    <HelpModal onRequestClose={onRequestClose}>
      <h2>Keyboard shortcuts</h2>
      <h4>Global</h4>
      <KeyboardShortcut description="Show shortcuts" keys={[COMMAND, "/"]} />

      <h4>Panels</h4>
      <KeyboardShortcut
        description="Select panel to group into a Tab panel"
        keys={[COMMAND, "click"]}
      />
      <KeyboardShortcut description="Select all panels" keys={[COMMAND, "a"]} />
      <KeyboardShortcut description="View panel shortcuts" keys={["hover", "~"]} />

      <h4>Playback bar</h4>
      <KeyboardShortcut description="Pause or play" keys={["Space"]} />
      <KeyboardShortcut description="Seek forward 100ms" keys={["⇢"]} />
      <KeyboardShortcut description="Seek backward 100ms" keys={["⇠"]} />
    </HelpModal>
  );
}
