// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { StoryObj } from "@storybook/react";
import { ReactElement } from "react";

import { LaunchingInDesktopScreen } from "@lichtblick/suite-base/screens/LaunchingInDesktopScreen";

export default {
  title: "LaunchingInDesktopScreen",
  component: LaunchingInDesktopScreen,
};

export const LaunchingInDesktopScreenRender: StoryObj = {
  render: (): ReactElement => {
    return <LaunchingInDesktopScreen />;
  },
};
