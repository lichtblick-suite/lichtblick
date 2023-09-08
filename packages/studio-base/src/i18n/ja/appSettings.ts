// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { TypeOptions } from "i18next";

export const appSettings: Partial<TypeOptions["resources"]["appSettings"]> = {
  about: "情報",
  askEachTime: "毎回確認する",
  colorScheme: "カラースキーム",
  dark: "ダーク",
  desktopApp: "デスクトップアプリ",
  displayTimestampsIn: "タイムスタンプを表示",
  experimentalFeatures: "実験的機能",
  experimentalFeaturesDescription: "これらの機能は挙動が不安定なため、日々の利用は推奨されません。",
  extensions: "拡張機能",
  followSystem: "システムに従う",
  general: "一般",
  language: "言語",
  layoutDebugging: "レイアウトデバッグ",
  layoutDebuggingDescription:
    "レイアウトストレージの開発およびデバッグ用の追加コントロールを表示する。",
  light: "ライト",
  memoryUseIndicator: "メモリ使用インジケータ",
  memoryUseIndicatorDescription: "サイドバーにアプリのメモリ使用量を表示する。",
  messageRate: "メッセージレート",
  noExperimentalFeatures: "現在、実験的機能はありません。",
  openLinksIn: "リンクを開く",
  privacy: "プライバシー",
  privacyDescription: "変更は次回のFoxglove Studio起動時に有効になります。",
  ros: "ROS",
  sendAnonymizedCrashReports: "匿名化されたクラッシュレポートを送信",
  sendAnonymizedUsageData: "匿名化された使用データを送信して、Foxglove Studioの改善に役立てる",
  settings: "設定",
  studioDebugPanels: "Studioデバッグパネル",
  studioDebugPanelsDescription: "「パネルを追加」リストにFoxglove Studioデバッグパネルを表示する。",
  timestampFormat: "タイムスタンプ形式",
  webApp: "ウェブアプリ",
};
