// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { StoryObj } from "@storybook/react";
import { action } from "storybook/actions";

import DirectionalPad from "./DirectionalPad";

export default {
  title: "panels/Teleop/DirectionalPad",
  component: DirectionalPad,
};

export const Basic: StoryObj = {
  render: () => {
    return <DirectionalPad onAction={action("click")} />;
  },
};

export const Disabled: StoryObj = {
  render: () => {
    return <DirectionalPad disabled onAction={action("click")} />;
  },
};
