// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { TypeOptions } from "i18next";

export const appSettings: Partial<TypeOptions["resources"]["appSettings"]> = {
  settings: "設定",
  colorScheme: "カラースキーム",
  dark: "ダーク",
  light: "ライト",
  followSystem: "システムに従う",
  language: "言語",
  displayTimestampsIn: "タイムスタンプを表示",
  timestampFormat: "タイムスタンプ形式",
  messageRate: "メッセージレート",
  openLinksIn: "リンクを開く",
  webApp: "ウェブアプリ",
  desktopApp: "デスクトップアプリ",
  askEachTime: "毎回確認する",
  general: "一般",
  ros: "ROS",
  privacy: "プライバシー",
  privacyDescription: "変更は次回のFoxglove Studio起動時に有効になります。",
  extensions: "拡張機能",
  about: "情報",
  sendAnonymizedUsageData: "匿名化された使用データを送信して、Foxglove Studioの改善に役立てる",
  sendAnonymizedCrashReports: "匿名化されたクラッシュレポートを送信",
  experimentalFeatures: "実験的機能",
  experimentalFeaturesDescription: "これらの機能は挙動が不安定なため、日々の利用は推奨されません。",
  noExperimentalFeatures: "現在、実験的機能はありません。",
  studioDebugPanels: "Studioデバッグパネル",
  studioDebugPanelsDescription: "「パネルを追加」リストにFoxglove Studioデバッグパネルを表示する。",
  memoryUseIndicator: "メモリ使用インジケータ",
  memoryUseIndicatorDescription: "サイドバーにアプリのメモリ使用量を表示する。",
  newNavigation: "新しいナビゲーション",
  newNavigationDescription: "新しいトップナビゲーションバー。",
  restartTheAppForChangesToTakeEffect: "変更を反映するには、アプリを再起動してください。",
  ros2NativeConnection: "ROS 2ネイティブ接続",
  ros2NativeConnectionDescription: "非推奨のROS 2ネイティブコネクタを有効にする。",
  layoutDebugging: "レイアウトデバッグ",
  layoutDebuggingDescription:
    "レイアウトストレージの開発およびデバッグ用の追加コントロールを表示する。",
  newImagePanel: "新しいImageパネル",
  newImagePanelDescription: "実験的なImageパネルを有効にする。",
};
