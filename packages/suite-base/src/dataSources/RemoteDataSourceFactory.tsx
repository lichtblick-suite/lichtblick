// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import path from "path";

import { AllowedFileExtensions } from "@lichtblick/suite-base/constants/allowedFileExtensions";
import {
  IDataSourceFactory,
  DataSourceFactoryInitializeArgs,
} from "@lichtblick/suite-base/context/PlayerSelectionContext";
import { IterablePlayer } from "@lichtblick/suite-base/players/IterablePlayer";
import { WorkerSerializedIterableSource } from "@lichtblick/suite-base/players/IterablePlayer/WorkerSerializedIterableSource";
import { Player } from "@lichtblick/suite-base/players/types";

const initWorkers: Record<string, () => Worker> = {
  ".bag": () => {
    return new Worker(
      // foxglove-depcheck-used: babel-plugin-transform-import-meta
      new URL(
        "@lichtblick/suite-base/players/IterablePlayer/BagIterableSourceWorker.worker",
        import.meta.url,
      ),
    );
  },
  ".mcap": () => {
    return new Worker(
      // foxglove-depcheck-used: babel-plugin-transform-import-meta
      new URL(
        "@lichtblick/suite-base/players/IterablePlayer/Mcap/McapIterableSourceWorker.worker",
        import.meta.url,
      ),
    );
  },
};

const fileTypesAllowed: AllowedFileExtensions[] = [
  AllowedFileExtensions.BAG,
  AllowedFileExtensions.MCAP,
];

export function checkExtensionMatch(fileExtension: string, previousExtension?: string): string {
  if (previousExtension != undefined && previousExtension !== fileExtension) {
    throw new Error("All sources need to be from the same type");
  }
  return fileExtension;
}

class RemoteDataSourceFactory implements IDataSourceFactory {
  public id = "remote-file";

  // The remote file feature use to be handled by two separate factories with these IDs.
  // We consolidated this into one factory that appears in the "connection" list and has a `url` field.
  //
  // To keep backwards compatability with deep-link urls that used these ids we provide them as legacy aliases
  public legacyIds = ["mcap-remote-file", "ros1-remote-bagfile"];

  public type: IDataSourceFactory["type"] = "connection";
  public displayName = "Remote file";
  public iconName: IDataSourceFactory["iconName"] = "FileASPX";
  public supportedFileTypes = fileTypesAllowed;
  public description = "Open pre-recorded .bag or .mcap files from a remote location.";
  public docsLinks = [
    {
      label: "ROS 1",
      url: "https://lichtblick-suite.github.io/docs/connecting-to-data/ros1.html",
    },
    {
      label: "MCAP",
      url: "https://lichtblick-suite.github.io/docs/connecting-to-data/mcap.html",
    },
  ];

  public formConfig = {
    fields: [
      {
        id: "url",
        label: "Remote file URL",
        placeholder: "https://example.com/file.bag",
        validate: (newValue: string): Error | undefined => {
          return this.#validateUrl(newValue);
        },
      },
    ],
  };

  public warning = "Loading large files over HTTP can be slow";

  public initialize(args: DataSourceFactoryInitializeArgs): Player | undefined {
    if (args.params?.url == undefined) {
      return;
    }
    const urls = args.params.url.split(",");

    let nextExtension: string | undefined = undefined;
    let extension = "";

    urls.forEach((url) => {
      extension = path.extname(new URL(url).pathname);
      nextExtension = checkExtensionMatch(extension, nextExtension);
    });

    const initWorker = initWorkers[extension]!;

    const source = new WorkerSerializedIterableSource({ initWorker, initArgs: { urls } });

    return new IterablePlayer({
      source,
      name: urls.join(),
      metricsCollector: args.metricsCollector,
      urlParams: { urls },
      sourceId: this.id,
      readAheadDuration: { sec: 10, nsec: 0 },
    });
  }

  #validateUrl(newValue: string): Error | undefined {
    try {
      const url = new URL(newValue);
      const extension = path.extname(url.pathname) as AllowedFileExtensions;

      if (extension.length === 0) {
        return new Error("URL must end with a filename and extension");
      }

      if (!this.supportedFileTypes.includes(extension)) {
        const supportedExtensions = new Intl.ListFormat("en-US", { style: "long" }).format(
          this.supportedFileTypes,
        );
        return new Error(`Only ${supportedExtensions} files are supported.`);
      }

      return undefined;
    } catch (err: unknown) {
      console.error(err);
      return new Error("Enter a valid url");
    }
  }
}

export default RemoteDataSourceFactory;
