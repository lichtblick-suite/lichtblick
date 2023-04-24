// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { TypeOptions } from "i18next";

export const threeDee: Partial<TypeOptions["resources"]["threeDee"]> = {
  frame: "参考系",
  reset: "重置",
  color: "颜色",
  position: "位置",
  lineWidth: "线宽",
  rotation: "旋转",

  // Frame
  displayFrame: "展示参考系",
  displayFrameHelp: "放置相机用于显示坐标系。相机的位置和方向将相对于该坐标系的原点。",
  followMode: "跟踪模式",
  followModeHelp: "更改回放期间相机的行为，是否跟踪显示坐标系。",
  pose: "姿态",
  fixed: "固定",
  frameNotFound: "未找到参考系 {{followFrameId}}",
  noCoordinateFramesFound: "未找到坐标系",
  enablePreloading: "启用预加载",
  lineColor: "线颜色",
  axisScale: "轴比例",
  labelSize: "标签大小",
  labels: "标签",
  editable: "可编辑",
  settings: "设置",
  transforms: "变换",
  showAll: "显示全部",
  hideAll: "隐藏全部",

  // Scene
  scene: "场景",
  renderStats: "渲染统计",
  background: "背景",
  labelScale: "标签比例",
  labelScaleHelp: "应用于所有标签的比例因子",
  ignoreColladaUpAxis: "忽略 COLLADA 的 <up_axis>",
  ignoreColladaUpAxisHelp: "通过忽略 COLLADA 文件中的 <up_axis> 标记，匹配 rviz 的行为",
  takeEffectAfterReboot: "此设置需要重新启动以生效",
  meshUpAxis: "网格上轴",
  meshUpAxisHelp: "加载缺少方向信息的网格（STL 和 OBJ）时使用的“上”方向",
  YUp: "Y-up",
  ZUp: "Z-up",

  // Camera
  view: "视图",
  distance: "距离",
  perspective: "透视",
  target: "目标",
  theta: "极角",
  phi: "方向角",
  fovy: "Y轴视野",
  near: "近面",
  far: "远面",
  syncCamera: "同步相机",
  syncCameraHelp: "将相机与其他启用此设置的面板同步。",

  // Topics
  topics: "话题",

  // Custom layers
  customLayers: "自定义图层",
  addURDF: "添加 URDF",
  size: "大小",
  divisions: "划分",
  grid: "网格",
  delete: "删除",
  addGrid: "添加网格",
};
