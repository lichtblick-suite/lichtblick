// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { TypeOptions } from "i18next";

export const panels: Partial<TypeOptions["resources"]["panels"]> = {
  "3D": "3D",
  "3DPanelDescription": "マーカーやカメラ映像、メッシュ、URDFなどを3Dシーンで表示します。",
  callService: "サービスを呼び出す",
  callServiceDescription: "サービスを呼び出し、サービス呼び出し結果を表示する",
  dataSourceInfo: "データソース情報",
  dataSourceInfoDescription:
    "現在のデータソースに関するトピックやタイムスタンプなどの詳細を表示します。",
  gauge: "ゲージ",
  gaugeDescription: "連続値に基づく色付きのゲージを表示します。",
  image: "画像",
  imageDescription: "注釈付きの画像を表示します。",
  indicator: "インジケーター",
  indicatorDescription: "閾値に基づいた色やテキストで表示されるインジケーターを表示します。",
  log: "ログ",
  logDescription: "ノードと重要度レベル別にログを表示します。",
  map: "地図",
  mapDescription: "地図上に点を表示します。",
  parameters: "パラメーター",
  parametersDescription: "データソースのパラメーターを読み取り、設定します。",
  plot: "プロット",
  plotDescription: "時間または他の値に対する数値をプロットします。",
  publish: "パブリッシュ",
  publishDescription: "データソースにメッセージをパブリッシュします（ライブ接続のみ）。 ",
  rawMessages: "生データのメッセージ",
  rawMessagesDescription: "トピックメッセージを検査します。",
  ROSDiagnosticsDetail: "診断 - 詳細 (ROS)",
  ROSDiagnosticsDetailDescription: "特定のhardware_idのROS DiagnosticArrayメッセージを表示します。",
  ROSDiagnosticSummary: "診断 - 概要 (ROS)",
  ROSDiagnosticSummaryDescription: "すべてのROS DiagnosticArrayメッセージの概要を表示します。",
  stateTransitions: "ステートトランジション",
  stateTransitionsDescription: "時間とともに値が変化するときを追跡します。",
  tab: "タブ",
  tabDescription: "複数のパネルをタブでグループ化して表示します。",
  table: "テーブル",
  tableDescription: "トピックメッセージを表形式で表示します。",
  teleop: "Teleop",
  teleopDescription: "ライブ接続でロボットを操作します。",
  topicGraph: "トピックグラフ",
  topicGraphDescription: "アクティブなノード、トピック、サービスのグラフを表示します。",
  userScripts: "ユーザースクリプト",
  userScriptsDescription:
    "TypeScriptでカスタムデータ変換を記述します。以前はNode Playgroundとして知られていました。",
  variableSlider: "変数スライダー",
  variableSliderDescription: "レイアウトの数値変数を更新します。",
};
