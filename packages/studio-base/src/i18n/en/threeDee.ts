// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

export const threeDee = {
  frame: "Frame",
  color: "Color",
  position: "Position",
  lineWidth: "Line width",
  rotation: "Rotation",
  reset: "Reset",

  // Frame
  displayFrame: "Display frame",
  displayFrameHelp:
    "The coordinate frame to place the camera in. The camera position and orientation will be relative to the origin of this frame.",
  followMode: "Follow mode",
  followModeHelp: "Change the camera behavior during playback to follow the display frame or not.",
  pose: "Pose",
  fixed: "Fixed",
  frameNotFound: "Frame {{followFrameId}} not found",
  noCoordinateFramesFound: "No coordinate frames found",
  enablePreloading: "Enable preloading",
  lineColor: "Line color",
  axisScale: "Axis scale",
  labelSize: "Label size",
  labels: "Labels",
  editable: "Editable",
  settings: "Settings",
  transforms: "Transforms",
  showAll: "Show All",
  hideAll: "Hide All",

  // Scene
  scene: "Scene",
  renderStats: "Render stats",
  background: "Background",
  labelScale: "Label scale",
  labelScaleHelp: "Scale factor to apply to all labels",
  ignoreColladaUpAxis: "Ignore COLLADA <up_axis>",
  ignoreColladaUpAxisHelp:
    "Match the behavior of rviz by ignoring the <up_axis> tag in COLLADA files",
  takeEffectAfterReboot: "This setting requires a restart to take effect",
  meshUpAxis: "Mesh up axis",
  meshUpAxisHelp:
    "The direction to use as “up” when loading meshes without orientation info (STL and OBJ)",
  YUp: "Y-up",
  ZUp: "Z-up",

  // Camera
  view: "View",
  distance: "Distance",
  perspective: "Perspective",
  target: "Target",
  theta: "Theta",
  phi: "Phi",
  fovy: "Y-Axis FOV",
  near: "Near",
  far: "Far",
  syncCamera: "Sync camera",
  syncCameraHelp: "Sync the camera with other panels that also have this setting enabled.",

  // Topics
  topics: "Topics",

  // Custom layers
  customLayers: "Custom layers",
  addURDF: "Add URDF",
  size: "Size",
  divisions: "Divisions",
  grid: "Grid",
  delete: "Delete",
  addGrid: "Add Grid",
};
