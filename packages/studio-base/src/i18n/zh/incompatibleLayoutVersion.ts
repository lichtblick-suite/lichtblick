// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { TypeOptions } from "i18next";

export const incompatibleLayoutVersion: Partial<
  TypeOptions["resources"]["incompatibleLayoutVersion"]
> = {
  desktopText: "此版面是使用较新版本的 Foxglove Studio 制作的。请从以下网址更新至最新版本 ",
  title: "布局版本不兼容",
  webText: "此版面是使用较新版本的 Foxglove Studio 制作的。请刷新浏览器。",
};
