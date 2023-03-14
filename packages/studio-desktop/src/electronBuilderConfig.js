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
    appId: "dev.foxglove.studio",
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
        name: "foxglove",
        schemes: ["foxglove"],
      },
    ],
    linux: {
      target: [
        {
          target: "deb",
          arch: ["x64", "arm64"],
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
          name: "Foxglove Studio Extension",
          mimeType: "application/zip",
        },
        {
          ext: "urdf",
          name: "Unified Robot Description Format File",
          mimeType: "text/xml",
        },
        {
          ext: "xacro",
          name: "Xacro File",
          mimeType: "text/xml",
        },
      ],
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
          name: "Foxglove Studio Extension",
          mimeType: "application/zip",
        },
        {
          ext: "urdf",
          name: "Unified Robot Description Format File",
          icon: path.join(__dirname, "../resources/icon/URDFIcon.ico"),
        },
        {
          ext: "xacro",
          name: "Xacro File",
          icon: path.join(__dirname, "../resources/icon/XacroIcon.ico"),
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
        { from: path.join(__dirname, "../resources/icon/URDFIcon.png"), to: "URDFIcon.png" },
        { from: path.join(__dirname, "../resources/icon/XacroIcon.png"), to: "XacroIcon.png" },
      ],
      extendInfo: {
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
            CFBundleTypeName: "Foxglove Studio Extension File",
            CFBundleTypeRole: "Viewer",
            LSHandlerRank: "Owner",
            CFBundleTypeIconSystemGenerated: 1,
            LSItemContentTypes: ["dev.foxglove.extension"],
          },
          {
            CFBundleTypeExtensions: ["urdf"],
            CFBundleTypeIconFile: "URDFIcon",
            CFBundleTypeName: "Unified Robot Description Format File",
            CFBundleTypeRole: "Viewer",
            LSHandlerRank: "Default",
            CFBundleTypeIconSystemGenerated: 1,
            LSItemContentTypes: ["org.ros.urdf"],
          },
          {
            CFBundleTypeExtensions: ["xacro"],
            CFBundleTypeIconFile: "XacroIcon",
            CFBundleTypeName: "Xacro File",
            CFBundleTypeRole: "Viewer",
            LSHandlerRank: "Default",
            CFBundleTypeIconSystemGenerated: 1,
            LSItemContentTypes: ["org.ros.xacro"],
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
            UTTypeDescription: "Foxglove Studio Extension File",
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
          {
            UTTypeConformsTo: ["public.xml"],
            UTTypeDescription: "Unified Robot Description Format File",
            UTTypeIcons: { UTTypeIconText: "urdf" },
            UTTypeIdentifier: "org.ros.urdf",
            UTTypeTagSpecification: { "public.filename-extension": "urdf" },
            UTTypeReferenceURL: "http://wiki.ros.org/urdf",
          },
          {
            UTTypeConformsTo: ["public.xml"],
            UTTypeDescription: "Xacro File",
            UTTypeIcons: { UTTypeIconText: "xacro" },
            UTTypeIdentifier: "org.ros.xacro",
            UTTypeTagSpecification: { "public.filename-extension": "xacro" },
            UTTypeReferenceURL: "https://github.com/ros/xacro/wiki",
          },
        ],
      },
    },
    appx: {
      applicationId: "FoxgloveStudio",
      backgroundColor: "#f7def6",
      displayName: "Foxglove Studio",
      identityName: "Foxglove.Studio",
      publisher:
        "CN=Foxglove Technologies, O=Foxglove Technologies, L=San Francisco, S=California, C=US",
      publisherDisplayName: "Foxglove Technologies",
      languages: ["en-US"],
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
  };
}

module.exports = { makeElectronBuilderConfig };
