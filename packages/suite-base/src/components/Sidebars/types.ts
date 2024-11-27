// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { BadgeProps } from "@mui/material";
import { ComponentProps } from "react";

import { BuiltinIcon } from "@lichtblick/suite-base/components/BuiltinIcon";

export type SidebarItemBadge = {
  color?: BadgeProps["color"];
  count: number;
};

export type SidebarItem = {
  badge?: SidebarItemBadge;
  component?: React.ComponentType;
  iconName?: ComponentProps<typeof BuiltinIcon>["name"];
  title: string;
  url?: string;
};

export type NewSidebarProps<K> = {
  items: Map<K, SidebarItem>;
  anchor: "right" | "left";
  onClose: () => void;
  activeTab: K | undefined;
  setActiveTab: (newValue: K) => void;
};
