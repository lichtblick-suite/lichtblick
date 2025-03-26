// SPDX-FileCopyrightText: Copyright (C) 2024-2025 Yukihiro Saito <yukky.saito@gmail.com>
// SPDX-FileCopyrightText: Copyright (C) 2025 Takayuki Honda <takayuki.honda@tier4.jp>
// SPDX-License-Identifier: MPL-2.0

export type Config = {
  path: string;
  title: string;
} & {
  [key in `legend${number}`]?: string;
};
