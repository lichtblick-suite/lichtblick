// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import type { Meta, StoryObj } from "@storybook/react";
import { useNetworkState } from "react-use";

import { NetworkStatusIndicator } from "@lichtblick/suite-base/components/AppBar/NetworkStatusIndicator";

// Mock the hook for storybook
const useNetworkStateMock = useNetworkState as jest.Mock;

const meta: Meta<typeof NetworkStatusIndicator> = {
  title: "components/AppBar/NetworkStatusIndicator",
  component: NetworkStatusIndicator,
  decorators: [
    (Story: React.ComponentType): React.JSX.Element => (
      <div style={{ padding: 20, background: "#1a1a1a", minHeight: 100 }}>
        <Story />
      </div>
    ),
  ],
  parameters: {
    colorScheme: "dark",
  },
};

export default meta;
type Story = StoryObj<typeof NetworkStatusIndicator>;

// Mock URL with namespace parameter
const mockLocation = (namespace?: string) => {
  const url = namespace 
    ? `https://test.com/?namespace=${namespace}`
    : "https://test.com/";
    
  Object.defineProperty(window, "location", {
    value: { href: url },
    writable: true,
  });
};

export const Online: Story = {
  beforeEach: () => {
    mockLocation("test-workspace");
    useNetworkStateMock.mockReturnValue({ online: true });
  },
  render: () => <NetworkStatusIndicator />,
};

export const Offline: Story = {
  beforeEach: () => {
    mockLocation("test-workspace");
    useNetworkStateMock.mockReturnValue({ online: false });
  },
  render: () => <NetworkStatusIndicator />,
};

export const NoNamespace: Story = {
  beforeEach: () => {
    mockLocation(); // No namespace parameter
    useNetworkStateMock.mockReturnValue({ online: false });
  },
  render: () => <NetworkStatusIndicator />,
  parameters: {
    docs: {
      description: {
        story: "When no namespace parameter is present in the URL, the component doesn't render anything.",
      },
    },
  },
};