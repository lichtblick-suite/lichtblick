// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { TypeOptions } from "i18next";

export const appSettings: Partial<TypeOptions["resources"]["appSettings"]> = {
  about: "关于",
  askEachTime: "每次询问",
  colorScheme: "配色方案",
  dark: "暗色",
  desktopApp: "桌面应用",
  displayTimestampsIn: "显示时间戳在",
  experimentalFeatures: "实验性功能",
  experimentalFeaturesDescription: "这些功能不稳定，不建议日常使用。",
  extensions: "扩展",
  followSystem: "跟随系统",
  general: "通用",
  language: "语言",
  layoutDebugging: "布局调试",
  layoutDebuggingDescription: "显示用于开发和调试布局存储的额外控件。",
  light: "亮色",
  memoryUseIndicator: "内存使用指示器",
  memoryUseIndicatorDescription: "在侧边栏显示应用程序的内存使用情况。",
  messageRate: "消息速率",
  noExperimentalFeatures: "目前没有实验性的功能。",
  openLinksIn: "打开链接",
  privacy: "隐私",
  privacyDescription: "更改将在下次启动 Foxglove Studio 时生效",
  ros: "ROS",
  sendAnonymizedCrashReports: "发送匿名崩溃报告",
  sendAnonymizedUsageData: "发送匿名使用数据以帮助我们改进 Foxglove Studio",
  settings: "设置",
  studioDebugPanels: undefined,
  studioDebugPanelsDescription: undefined,
  timestampFormat: "时间戳格式",
  webApp: "网页应用",
};
