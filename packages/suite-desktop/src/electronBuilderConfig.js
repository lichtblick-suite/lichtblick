// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

const { version: electronVersion } = require("electron/package.json");
const path = require("path");

/**
 * @param {{appPath: string}} params
 * @returns {import("electron-builder").Configuration}
 */
function makeElectronBuilderConfig(params) {
  return {
    electronVersion,
    appId: "dev.umstj.edu.autoblick.suite",
    npmRebuild: false,
    asar: true,
    directories: {
      app: params.appPath,
      buildResources: path.join(__dirname, "../resources"),
    },
    artifactName: "${name}-${version}-${os}-${arch}.${ext}",
    afterPack: path.resolve(__dirname, "afterPack.ts"),
    icon: path.join(__dirname, "../resources/icon/icon.icns"),
    protocols: [
      {
        name: "autoblick",
        schemes: ["autoblick"],
      },
    ],
    linux: {
      target: [
        {
          target: "deb",
          arch: ["x64", "arm64"],
        },
        {
          target: "tar.gz",
          arch: ["x64", "arm64"],
        },
        {
          target: "rpm", // 添加 rpm 打包目标
          arch: ["x64", "arm64"], // 支持 x64 和 arm64 架构
        },
      ],
      fileAssociations: [
        {
          ext: "bag",
          name: "ROS Bag File",
          mimeType: "application/octet-stream",
        },
        {
          ext: "mcap",
          name: "MCAP File",
          mimeType: "application/octet-stream",
        },
        {
          ext: "foxe",
          name: "Autotblick Extension",
          mimeType: "application/zip",
        },
      ],
    },
    nsis: {
      oneClick: false, // 是否一键安装
      allowToChangeInstallationDirectory: true, // 允许用户修改安装位置
      // installerIcon: path.join(__dirname, "../resources/icon/icon.png"),
      // uninstallerIcon: path.join(__dirname, "../resources/icon/icon.png"),
      // installerHeaderIcon: path.join(__dirname, "../resources/icon/icon.png"),
      createDesktopShortcut: true,
      createStartMenuShortcut: true,
      shortcutName: "Autotblick",
      // 设置默认安装路径
      // installDirectory: "C:\\Autotblick",
    },
    win: {
      target: [
        {
          target: "nsis",
          arch: ["x64", "arm64"],
        },
      ],
      icon: path.join(__dirname, "../resources/icon/icon.png"),
      fileAssociations: [
        {
          ext: "bag",
          name: "ROS Bag File",
          icon: path.join(__dirname, "../resources/icon/BagIcon.ico"),
        },
        {
          ext: "mcap",
          name: "MCAP File",
          icon: path.join(__dirname, "../resources/icon/McapIcon.ico"),
        },
        {
          ext: "foxe",
          name: "Autotblick Extension",
          mimeType: "application/zip",
        },
      ],
    },
    mac: {
      target: {
        target: "default",
        arch: ["universal"],
      },
      category: "public.app-category.developer-tools",
      icon: path.join(__dirname, "../resources/icon/icon.icns"),
      entitlements: path.join(__dirname, "../resources/mac/entitlements.plist"),
      entitlementsInherit: path.join(__dirname, "../resources/mac/entitlements.plist"),
      extraFiles: [
        {
          from: path.join(
            require.resolve("quicklookjs/index.d.ts"),
            "../dist/PreviewExtension.appex",
          ),
          to: "PlugIns/PreviewExtension.appex",
        },
      ],
      extraResources: [
        { from: path.join(__dirname, "../resources/icon/BagIcon.png"), to: "BagIcon.png" },
        { from: path.join(__dirname, "../resources/icon/McapIcon.png"), to: "McapIcon.png" },
        { from: path.join(__dirname, "../resources/icon/FoxeIcon.png"), to: "FoxeIcon.png" },
      ],
      extendInfo: {
        NSLocalNetworkUsageDescription: "应用需要访问本地网络以扫描设备。",
        CFBundleDocumentTypes: [
          {
            CFBundleTypeExtensions: ["bag"],
            CFBundleTypeIconFile: "BagIcon",
            CFBundleTypeName: "ROS Bag File",
            CFBundleTypeRole: "Viewer",
            LSHandlerRank: "Default",
            CFBundleTypeIconSystemGenerated: 1,
            LSItemContentTypes: ["org.ros.bag"],
          },
          {
            CFBundleTypeExtensions: ["mcap"],
            CFBundleTypeIconFile: "McapIcon",
            CFBundleTypeName: "MCAP File",
            CFBundleTypeRole: "Viewer",
            LSHandlerRank: "Owner",
            CFBundleTypeIconSystemGenerated: 1,
            LSItemContentTypes: ["dev.mcap.mcap"],
          },
          {
            CFBundleTypeExtensions: ["foxe"],
            CFBundleTypeIconFile: "FoxeIcon",
            CFBundleTypeName: "Autotblick Extension File",
            CFBundleTypeRole: "Viewer",
            LSHandlerRank: "Owner",
            CFBundleTypeIconSystemGenerated: 1,
            LSItemContentTypes: ["dev.foxglove.extension"],
          },
        ],
        CFBundleURLTypes: [
          {
            CFBundleURLSchemes: ["foxglove"],
            CFBundleTypeRole: "Viewer",
          },
        ],
        UTExportedTypeDeclarations: [
          {
            UTTypeConformsTo: ["public.data", "public.log", "public.composite-content"],
            UTTypeDescription: "MCAP File",
            UTTypeIcons: { UTTypeIconText: "mcap" },
            UTTypeIdentifier: "dev.mcap.mcap",
            UTTypeTagSpecification: { "public.filename-extension": "mcap" },
            UTTypeReferenceURL: "https://mcap.dev/",
          },
          {
            UTTypeConformsTo: ["public.data", "public.archive", "public.zip-archive"],
            UTTypeDescription: "Autotblick Extension File",
            UTTypeIcons: { UTTypeIconText: "foxe" },
            UTTypeIdentifier: "dev.foxglove.extension",
            UTTypeTagSpecification: { "public.filename-extension": "foxe" },
            UTTypeReferenceURL: "https://foxglove.dev/docs/studio/extensions/getting-started",
          },
        ],
        UTImportedTypeDeclarations: [
          {
            UTTypeConformsTo: ["public.data", "public.log", "public.composite-content"],
            UTTypeDescription: "ROS 1 Bag File",
            UTTypeIcons: { UTTypeIconText: "bag" },
            UTTypeIdentifier: "org.ros.bag",
            UTTypeTagSpecification: { "public.filename-extension": "bag" },
            UTTypeReferenceURL: "http://wiki.ros.org/Bags",
          },
        ],
      },
    },
    appx: {
      applicationId: "AutotblickSuite",
      backgroundColor: "#f7def6",
      displayName: "Autotblick",
      identityName: "Autotblick.Suite",
      publisher: "CN=Autotblick, O=Autotblick, L=Tianjin, S=Tianjin, C=CN",
      publisherDisplayName: "Autotblick",
      languages: ["zh-CN"],
      addAutoLaunchExtension: false,
      showNameOnTiles: false,
      setBuildNumber: false,
    },
    dmg: {
      background: path.join(__dirname, "../resources/dmg-background/background.png"),
      contents: [
        { x: 144, y: 170, type: "file" },
        { x: 390, y: 170, type: "link", path: "/Applications" },
      ],
    },
    deb: {
      depends: [
        "libgtk-3-0",
        "libnotify4",
        "libnss3",
        "libxtst6",
        "xdg-utils",
        "libatspi2.0-0",
        "libdrm2",
        "libgbm1",
        "libxcb-dri3-0",
      ],
      afterInstall: path.join(__dirname, "../resources/linux/deb/postinst"),
    },
    snap: {
      confinement: "strict",
      grade: "stable",
      summary: "Integrated visualization and diagnosis tool for robotics",
    },
    rpm: {
      afterInstall: path.join(__dirname, "../resources/linux/rpm/postinst"),
    },
  };
}

module.exports = { makeElectronBuilderConfig };
