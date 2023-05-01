// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { TypeOptions } from "i18next";

export const threeDee: Partial<TypeOptions["resources"]["threeDee"]> = {
  frame: "フレーム",
  color: "色",
  position: "位置",
  lineWidth: "ライン幅",
  rotation: "回転",
  reset: "リセット",

  // Frame
  displayFrame: "フレームを表示する",
  displayFrameHelp:
    "カメラを配置するための座標フレームです。カメラの位置と向きは、このフレームの原点を基準とした相対的なものとなります。",
  followMode: "フォローモード",
  followModeHelp:
    "再生中のカメラの動作を変更し、表示フレームをフォローするかどうかを選択できます。",
  pose: "ポーズ",
  fixed: "固定",
  frameNotFound: "フレーム {{followFrameId}} が見つかりません",
  noCoordinateFramesFound: "座標フレームが見つかりません",
  enablePreloading: "事前の読み込みを有効にする",
  lineColor: "ラインの色",
  axisScale: "軸のスケール",
  labelSize: "ラベルのサイズ",
  labels: "ラベル",
  editable: "編集可能",
  settings: "設定",
  transforms: "変換",
  showAll: "すべて表示",
  hideAll: "すべて非表示",

  // Scene
  scene: "シーン",
  renderStats: "レンダリングの統計情報",
  background: "背景",
  labelScale: "ラベルのスケール",
  labelScaleHelp: "すべてのラベルに適用するスケールファクター",
  ignoreColladaUpAxis: "COLLADA <up_axis> を無視",
  ignoreColladaUpAxisHelp:
    "COLLADA ファイル内の <up_axis> タグを無視することで、rviz の動作に合わせます。",
  takeEffectAfterReboot: "この設定は再起動後に有効になります。",
  meshUpAxis: "メッシュの上軸",
  meshUpAxisHelp:
    "方向を使用してメッシュを読み込むときに '上' として使用する方向（STL および OBJ）",
  YUp: "Y-up",
  ZUp: "Z-up",

  // Camera
  view: "ビュー",
  distance: "距離",
  perspective: "遠近法",
  target: "ターゲット",
  theta: "Theta",
  phi: "Phi",
  fovy: "Y軸 FOV",
  near: "Near",
  far: "Far",
  syncCamera: "カメラを同期する",
  syncCameraHelp: "この設定が有効になっている他のパネルとカメラを同期します。",

  // Topics
  topics: "トピック",

  // Custom layers
  customLayers: "カスタムレイヤー",
  addURDF: "URDF を追加する",
  size: "サイズ",
  divisions: "分割数",
  grid: "グリッド",
  delete: "削除",
  addGrid: "グリッドを追加する",
};
