// SPDX-License-Identifier: MPL-2.0

// SPDX-FileCopyrightText: Copyright (C) 2024-2025 Yukihiro Saito <yukky.saito@gmail.com>
// SPDX-FileCopyrightText: Copyright (C) 2025 Takayuki Honda <takayuki.honda@tier4.jp>
// SPDX-License-Identifier: MPL-2.0

import { MessagePath } from "@lichtblick/message-path";
import { MessageEvent } from "@lichtblick/suite";

export type Config = {
  path: string;
  title: string;
} & {
  [key in `legend${number}`]?: string;
};

export type State = {
  path: string;
  parsedPath: MessagePath | undefined;
  latestMessage: MessageEvent | undefined;
  latestMatchingQueriedData: unknown;
  error: Error | undefined;
  pathParseError: string | undefined;
};

export type Action =
  | { type: "frame"; messages: readonly MessageEvent[] }
  | { type: "path"; path: string }
  | { type: "seek" };

export type ChartDatum = {
    name: string;
    value: number;
    color: string;
};
