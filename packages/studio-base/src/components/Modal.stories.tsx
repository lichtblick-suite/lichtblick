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

import { Link } from "@fluentui/react";
import { action } from "@storybook/addon-actions";
import { storiesOf } from "@storybook/react";

import ChildToggle from "@foxglove/studio-base/components/ChildToggle";
import DropdownItem from "@foxglove/studio-base/components/Dropdown/DropdownItem";
import Dropdown from "@foxglove/studio-base/components/Dropdown/index";
import { LegacyButton } from "@foxglove/studio-base/components/LegacyStyledComponents";
import Modal from "@foxglove/studio-base/components/Modal";
import TextContent from "@foxglove/studio-base/components/TextContent";

function ContentStory({ showChildToggle = false }: { showChildToggle?: boolean }) {
  const renderedRef = React.useRef(false);
  return (
    <Modal
      onRequestClose={() => {
        // no-op
      }}
    >
      <div
        style={{ padding: 20, height: 400, width: 400 }}
        ref={(el) => {
          if (renderedRef.current) {
            return;
          }
          if (!el) {
            return;
          }
          const btn = el.querySelector("button"); // Dropdown or toggle button
          if (!btn) {
            return;
          }
          btn.click();
          renderedRef.current = true;
        }}
      >
        {showChildToggle ? (
          <ChildToggle position="below">
            <LegacyButton>Toggle</LegacyButton>
            <p>ChildToggle component inside a Modal</p>
          </ChildToggle>
        ) : (
          <Dropdown
            text="Dropdown options inside a Modal"
            value="two"
            onChange={() => {
              // no-op
            }}
          >
            <DropdownItem value="one" />
            <DropdownItem value="two" />
            <DropdownItem value="three" />
          </Dropdown>
        )}
      </div>
    </Modal>
  );
}

storiesOf("components/Modal", module)
  .add("basic", () => (
    <Modal onRequestClose={() => action("close")()}>
      <div style={{ padding: 20 }}>
        <TextContent>
          <Link href="https://google.com" rel="noopener noreferrer">
            link
          </Link>
          <div>this is a floating, fixed position modal</div>
          <div>you can press escape or click outside of the modal to fire the close action</div>
        </TextContent>
      </div>
    </Modal>
  ))
  .add("with ChildToggle content", () => <ContentStory showChildToggle />)
  .add("with DropDown content", () => <ContentStory />);
