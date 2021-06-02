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

import { action } from "@storybook/addon-actions";
import { useLayoutEffect } from "react";

import useConfirm from "@foxglove/studio-base/components/useConfirm";

export default {
  title: "useConfirm",
};

export const UpdateYourBrowser = (): unknown => {
  const { modal, open } = useConfirm({
    title: "Update your browser",
    prompt: "Chrome 1.2.3 is not supported. Please use Chrome 68 or later to continue.",
    confirmStyle: "primary",
    ok: "Update Chrome",
    cancel: "Continue anyway",
    action: action("action"),
  });
  useLayoutEffect(() => open(), [open]);
  return modal;
};
