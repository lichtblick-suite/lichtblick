// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Link } from "@mui/material";
import path from "path";

import {
  IDataSourceFactory,
  DataSourceFactoryInitializeArgs,
} from "@foxglove/studio-base/context/PlayerSelectionContext";
import { IterablePlayer, WorkerIterableSource } from "@foxglove/studio-base/players/IterablePlayer";
import { Player } from "@foxglove/studio-base/players/types";

const initWorkers: Record<string, () => Worker> = {
  ".bag": () => {
    return new Worker(
      // foxglove-depcheck-used: babel-plugin-transform-import-meta
      new URL(
        "@foxglove/studio-base/players/IterablePlayer/BagIterableSourceWorker.worker",
        import.meta.url,
      ),
    );
  },
  ".mcap": () => {
    return new Worker(
      // foxglove-depcheck-used: babel-plugin-transform-import-meta
      new URL(
        "@foxglove/studio-base/players/IterablePlayer/Mcap/McapIterableSourceWorker.worker",
        import.meta.url,
      ),
    );
  },
};

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
  public supportedFileTypes = [".bag", ".mcap"];
  public description = "Open pre-recorded .bag or .mcap files from a remote location.";
  public docsLinks = [
    { label: "ROS 1", url: "https://foxglove.dev/docs/studio/connection/ros1#cloud-data" },
    { label: "MCAP", url: "https://foxglove.dev/docs/studio/connection/mcap#cloud-data" },
  ];

  public formConfig = {
    fields: [
      {
        id: "url",
        label: "Remote file URL",
        placeholder: "https://example.com/file.bag",
        validate: (newValue: string): Error | undefined => {
          return this.validateUrl(newValue);
        },
      },
    ],
  };

  public warning = (
    <>
      Loading large files over HTTP can be slow. For better performance, we recommend{" "}
      <Link href="https://foxglove.dev/data-platform" target="_blank">
        Foxglove Data Platform
      </Link>
      .
    </>
  );

  public initialize(args: DataSourceFactoryInitializeArgs): Player | undefined {
    const url = args.params?.url;
    if (!url) {
      throw new Error("Missing url argument");
    }

    const extension = path.extname(new URL(url).pathname);
    const initWorker = initWorkers[extension];
    if (!initWorker) {
      throw new Error(`Unsupported extension: ${extension}`);
    }

    const source = new WorkerIterableSource({ initWorker, initArgs: { url } });

    return new IterablePlayer({
      source,
      name: url,
      metricsCollector: args.metricsCollector,
      // Use blank url params so the data source is set in the url
      urlParams: { url },
      sourceId: this.id,
    });
  }

  private validateUrl(newValue: string): Error | undefined {
    try {
      const url = new URL(newValue);
      const extension = path.extname(url.pathname);

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
    } catch (err) {
      return new Error("Enter a valid url");
    }
  }
}

export default RemoteDataSourceFactory;
