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
import CodeJsonIcon from "@mdi/svg/svg/code-json.svg";
import { useState } from "react";

import LayoutIcon from "@foxglove-studio/app/assets/layout.svg";
import ChildToggle from "@foxglove-studio/app/components/ChildToggle";
import ClearBagCacheMenuItem from "@foxglove-studio/app/components/ClearBagCacheMenuItem";
import Flex from "@foxglove-studio/app/components/Flex";
import { WrappedIcon } from "@foxglove-studio/app/components/Icon";
import LayoutModal from "@foxglove-studio/app/components/LayoutModal";
import Menu, { Item } from "@foxglove-studio/app/components/Menu";

export default function LayoutMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [showLayoutModal, setShowLayoutModal] = useState(false);

  return (
    <>
      {showLayoutModal && <LayoutModal onRequestClose={() => setShowLayoutModal(false)} />}
      <ChildToggle position="below" onToggle={setIsOpen} isOpen={isOpen}>
        <Flex>
          <WrappedIcon medium fade active={isOpen} tooltip="Config">
            <LayoutIcon />
          </WrappedIcon>
        </Flex>
        <Menu>
          <Item
            icon={<CodeJsonIcon />}
            onClick={() => {
              setIsOpen(false);
              setShowLayoutModal(true);
            }}
          >
            Import/export layout
          </Item>
          <ClearBagCacheMenuItem />
        </Menu>
      </ChildToggle>
    </>
  );
}
