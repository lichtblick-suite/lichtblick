// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { TypeOptions } from "i18next";

export const threeDee: Partial<TypeOptions["resources"]["threeDee"]> = {
  // Common
  color: "色",
  colorMode: undefined,
  frame: "フレーム",
  lineWidth: "ライン幅",
  position: "位置",
  reset: "リセット",
  rotation: "回転",
  scale: undefined,
  gradient: undefined,
  type: undefined,
  topic: undefined,

  // Frame
  age: undefined,
  axisScale: "軸のスケール",
  displayFrame: "フレームを表示する",
  displayFrameHelp:
    "カメラを配置するための座標フレームです。カメラの位置と向きは、このフレームの原点を基準とした相対的なものとなります。",
  editable: "編集可能",
  enablePreloading: "事前の読み込みを有効にする",
  fixed: "固定",
  followMode: "フォローモード",
  followModeHelp:
    "再生中のカメラの動作を変更し、表示フレームをフォローするかどうかを選択できます。",
  frameNotFound: "フレーム {{frameId}} が見つかりません",
  hideAll: "すべて非表示",
  historySize: undefined,
  labels: "ラベル",
  labelSize: "ラベルのサイズ",
  lineColor: "ラインの色",
  noCoordinateFramesFound: "座標フレームが見つかりません",
  parent: undefined,
  pose: "ポーズ",
  rotationOffset: undefined,
  settings: "設定",
  showAll: "すべて表示",
  transforms: "変換",
  translation: undefined,
  translationOffset: undefined,

  // Scene
  background: "背景",
  debugPicking: undefined,
  ignoreColladaUpAxis: "COLLADA <up_axis> を無視",
  ignoreColladaUpAxisHelp:
    "COLLADA ファイル内の <up_axis> タグを無視することで、rviz の動作に合わせます。",
  labelScale: "ラベルのスケール",
  labelScaleHelp: "すべてのラベルに適用するスケールファクター",
  meshUpAxis: "メッシュの上軸",
  meshUpAxisHelp:
    "方向を使用してメッシュを読み込むときに '上' として使用する方向（STL および OBJ）",
  renderStats: "レンダリングの統計情報",
  scene: "シーン",
  takeEffectAfterReboot: "この設定は再起動後に有効になります。",
  YUp: "Y-up",
  ZUp: "Z-up",

  // Camera
  distance: "距離",
  far: "Far",
  fovy: "Y軸 FOV",
  near: "Near",
  perspective: "遠近法",
  phi: "Phi",
  planarProjectionFactor: undefined,
  syncCamera: "カメラを同期する",
  syncCameraHelp: "この設定が有効になっている他のパネルとカメラを同期します。",
  target: "ターゲット",
  theta: "Theta",
  view: "ビュー",

  // Topics
  topics: "トピック",

  // Custom layers
  addGrid: "グリッドを追加する",
  addURDF: "URDF を追加する",
  customLayers: "カスタムレイヤー",
  delete: "削除",
  divisions: "分割数",
  grid: "グリッド",
  size: "サイズ",

  // Image Annotations
  imageAnnotations: undefined,
  resetView: undefined,

  // Images
  cameraInfo: undefined,

  // Occupancy Grids
  colorModeCustom: undefined,
  colorModeRaw: undefined,
  colorModeRvizCostmap: "Costmap",
  colorModeRvizMap: "Map",
  frameLock: undefined,
  invalidColor: undefined,
  maxColor: undefined,
  minColor: undefined,
  unknownColor: undefined,

  // Point Extension Utils
  decayTime: undefined,
  decayTimeDefaultZeroSeconds: undefined,
  pointShape: undefined,
  pointShapeCircle: undefined,
  pointShapeSquare: undefined,
  pointSize: undefined,

  // Color Mode
  colorBy: undefined,
  colorModeBgraPacked: undefined,
  colorModeBgrPacked: undefined,
  colorModeColorMap: undefined,
  colorModeFlat: undefined,
  colorModeRgbaSeparateFields: undefined,
  flatColor: undefined,
  opacity: undefined,
  valueMax: undefined,
  valueMin: undefined,

  // Markers
  selectionVariable: undefined,
  selectionVariableHelp: undefined,
  showOutline: undefined,

  // Poses
  covariance: undefined,
  covarianceColor: undefined,
  poseDisplayTypeArrow: undefined,
  poseDisplayTypeAxis: undefined,
  poseDisplayTypeLine: undefined,

  // Publish
  publish: undefined,
  publishTopicHelp: undefined,
  publishTypeHelp: undefined,
  publishTypePoint: undefined,
  publishTypePose: undefined,
  publishTypePoseEstimate: undefined,
  thetaDeviation: undefined,
  thetaDeviationHelp: undefined,
  xDeviation: undefined,
  xDeviationHelp: undefined,
  yDeviation: undefined,
  yDeviationHelp: undefined,
};
