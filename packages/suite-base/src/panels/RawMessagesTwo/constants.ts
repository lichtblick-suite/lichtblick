// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
import { ros1 } from "@lichtblick/rosmsg-msgs-common";

export const PATH_NAME_AGGREGATOR = "~";

export const CUSTOM_METHOD = "custom";

export const PREV_MSG_METHOD = "previous message";

export const FONT_SIZE_OPTIONS = [8, 9, 10, 11, 12, 14, 16, 18, 24, 30, 36, 48, 60, 72];

export const diffArrow = "->";

// Strings longer than this many characters will start off collapsed.
export const COLLAPSE_TEXT_OVER_LENGTH = 512;

export const DATA_ARRAY_PREVIEW_LIMIT = 20;
export const ROS1_COMMON_MSG_PACKAGES = new Set(Object.keys(ros1).map((key) => key.split("/")[0]!));
