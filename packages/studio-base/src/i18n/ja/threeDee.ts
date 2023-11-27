// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { TypeOptions } from "i18next";

export const threeDee: Partial<TypeOptions["resources"]["threeDee"]> = {
  // Common
  color: "色",
  colorMode: "カラーモード",
  frame: "フレーム",
  lineWidth: "ライン幅",
  position: "位置",
  reset: "リセット",
  rotation: "回転",
  scale: "スケール",
  gradient: "グラデーション",
  type: "タイプ",
  topic: "トピック",

  // Frame
  age: "経過時間",
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
  historySize: "履歴サイズ",
  labels: "ラベル",
  labelSize: "ラベルのサイズ",
  lineColor: "ラインの色",
  noCoordinateFramesFound: "座標フレームが見つかりません",
  parent: "親",
  pose: "ポーズ",
  rotationOffset: "回転オフセット",
  settings: "設定",
  showAll: "すべて表示",
  transforms: "変換",
  translation: "変換",
  translationOffset: "変換オフセット",

  // Scene
  background: "背景",
  debugPicking: "デバッグピッキング",
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
  planarProjectionFactor: "平面投影係数",
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

  // Image annotations
  imageAnnotations: "画像アノテーション",
  resetView: "ビューをリセット",

  // Images
  cameraInfo: "カメラ情報",

  // Occupancy Grids
  colorModeCustom: "カスタム",
  colorModeRaw: "生データ",
  colorModeRvizCostmap: "Costmap",
  colorModeRvizMap: "Map",
  frameLock: "フレームロック",
  invalidColor: "無効な色",
  maxColor: "最大色",
  minColor: "最小色",
  unknownColor: "不明な色",

  // Point Extension Utils
  decayTime: "減衰時間",
  decayTimeDefaultZeroSeconds: "0秒",
  pointShape: "ポイント形状",
  pointShapeCircle: "円",
  pointShapeSquare: "四角",
  pointSize: "ポイントサイズ",

  // Color Mode
  colorBy: "色指定",
  colorModeBgraPacked: "BGRA（パック）",
  colorModeBgrPacked: "BGR（パック）",
  colorModeColorMap: "カラーマップ",
  colorModeFlat: "フラット",
  colorModeRgbaSeparateFields: "RGBA（個別フィールド）",
  flatColor: "フラットカラー",
  opacity: "不透明度",
  valueMax: "最大値",
  valueMin: "最小値",

  // Markers
  selectionVariable: "選択変数",
  selectionVariableHelp: "マーカーを選択すると、このグローバル変数がマーカーIDに設定されます",
  showOutline: "アウトラインを表示",

  // Poses
  covariance: "共分散",
  covarianceColor: "共分散色",
  poseDisplayTypeArrow: "矢印",
  poseDisplayTypeAxis: "軸",
  poseDisplayTypeLine: "ライン",

  // Publish
  publish: "公開",
  publishTopicHelp: "公開するトピック",
  publishTypeHelp: "シーンをクリックする際に公開するメッセージのタイプ",
  publishTypePoint: "ポイント（geometry_msgs/Point）",
  publishTypePose: "ポーズ（geometry_msgs/PoseStamped）",
  publishTypePoseEstimate: "ポーズ推定（geometry_msgs/PoseWithCovarianceStamped）",
  thetaDeviation: "シータ偏差",
  thetaDeviationHelp: "ポーズ推定で公開するシータの標準偏差",
  xDeviation: "X偏差",
  xDeviationHelp: "ポーズ推定で公開するXの標準偏差",
  yDeviation: "Y偏差",
  yDeviationHelp: "ポーズ推定で公開するYの標準偏差",
};
