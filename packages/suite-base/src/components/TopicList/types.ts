// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { Time } from "@lichtblick/rostime";

export type TopicBoundaries = {
  first?: Time;
  last?: Time;
};

export interface UseTopicMessageNavigationReturn {
  handleNextMessage: () => Promise<void>;
  handlePreviousMessage: () => Promise<void>;
  isNavigating: boolean;
  canNavigateNext: boolean;
  canNavigatePrevious: boolean;
}
