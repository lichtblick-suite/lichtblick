// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  IDataSourceFactory,
  DataSourceFactoryInitializeArgs,
} from "@lichtblick/suite-base/context/PlayerSelectionContext";
import { IterablePlayer } from "@lichtblick/suite-base/players/IterablePlayer";
import { DeserializingIterableSource } from "@lichtblick/suite-base/players/IterablePlayer/DeserializingIterableSource";
import { McapIterableSource } from "@lichtblick/suite-base/players/IterablePlayer/Mcap/McapIterableSource";
import { WorkerSerializedIterableSource } from "@lichtblick/suite-base/players/IterablePlayer/WorkerSerializedIterableSource";
import {
  addMultiFileHydrationOverrides,
  MultiFileHydrationOverrides,
} from "@lichtblick/suite-base/players/IterablePlayer/shared/multiFileHydrationOptions";
import { Player } from "@lichtblick/suite-base/players/types";

import { BenchmarkPipelineKind } from "./types";

function initMcapWorker(): Worker {
  return new Worker(
    // `import.meta.url` is handled natively by webpack; Jest uses the root babel config's
    // babel-plugin-transform-import-meta (declared in the root package.json).
    new URL(
      "@lichtblick/suite-base/players/IterablePlayer/Mcap/McapIterableSourceWorker.worker",
      import.meta.url,
    ),
  );
}

/** Splits the comma-separated `url` param, dropping blanks. */
function parseUrls(url: string): string[] {
  const urls: string[] = [];
  for (const part of url.split(",")) {
    const trimmed = part.trim();
    if (trimmed.length > 0) {
      urls.push(trimmed);
    }
  }
  return urls;
}

/** Parses a positive safe integer; anything else (empty, NaN, <= 0, fractional) is ignored. */
function parsePositiveInteger(value: string | undefined): number | undefined {
  if (value == undefined || value.trim().length === 0) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function parseHydrationOverrides(
  params: Record<string, string | undefined> | undefined,
): MultiFileHydrationOverrides {
  return {
    maxHydratedSources: parsePositiveInteger(params?.maxHydratedSources),
    maxHydratedBytes: parsePositiveInteger(params?.maxHydratedBytes),
  };
}

/**
 * Loads MCAP file(s) by URL through the real production pipeline, with no `BenchmarkPlayer`
 * synthetic instrumentation wrapper. URL-based (rather than file-picker based) so CI can serve
 * fixtures and drive this via scenario params / `?ds.url=`.
 *
 * Params:
 * - `url` (required): one URL, or a comma-separated list of URLs.
 *   - one URL: `IterablePlayer` over `McapIterableSource` -> `DeserializingIterableSource` on the
 *     main thread (unchanged legacy behavior of this factory).
 *   - several URLs: `IterablePlayer` over `WorkerSerializedIterableSource` running the MCAP worker
 *     (multi-file `MultiIterableSource` + `HydratedSourcePool` inside the worker), mirroring
 *     `RemoteDataSourceFactory`.
 * - `maxHydratedSources`, `maxHydratedBytes` (optional, multi-URL only): positive integers passed
 *   as multi-file hydration overrides; invalid values are ignored (pipeline defaults apply).
 */
class McapRealPipelineBenchmarkDataSourceFactory implements IDataSourceFactory {
  public readonly pipeline: BenchmarkPipelineKind = "real";

  public id = "mcap-real-pipeline";
  public type: IDataSourceFactory["type"] = "connection";
  public displayName = "MCAP (real pipeline)";
  public iconName: IDataSourceFactory["iconName"] = "FileASPX";
  public supportedFileTypes = [".mcap"];

  public formConfig = {
    fields: [
      {
        id: "url",
        label: "MCAP file URL(s), comma-separated",
        placeholder: "https://example.com/file.mcap",
        validate: (newValue: string): Error | undefined => {
          return this.#validateUrls(newValue);
        },
      },
    ],
  };

  public initialize(args: DataSourceFactoryInitializeArgs): Player | undefined {
    const rawUrl = args.params?.url;
    if (rawUrl == undefined) {
      return undefined;
    }
    const urls = parseUrls(rawUrl);
    const [firstUrl] = urls;
    if (firstUrl == undefined) {
      return undefined;
    }

    if (urls.length === 1) {
      const mcapSource = new McapIterableSource({ type: "url", url: firstUrl });
      const source = new DeserializingIterableSource(mcapSource);

      return new IterablePlayer({
        source,
        name: firstUrl,
        sourceId: this.id,
        metricsCollector: args.metricsCollector,
        urlParams: { url: firstUrl },
      });
    }

    const initArgs = addMultiFileHydrationOverrides({ urls }, parseHydrationOverrides(args.params));
    // Serialized source straight into IterablePlayer (no DeserializingIterableSource): the player
    // deserializes serialized sources itself, as for RemoteDataSourceFactory.
    const source = new WorkerSerializedIterableSource({ initWorker: initMcapWorker, initArgs });

    return new IterablePlayer({
      source,
      name: urls.join(),
      sourceId: this.id,
      metricsCollector: args.metricsCollector,
      urlParams: { urls },
    });
  }

  #validateUrls(newValue: string): Error | undefined {
    const urls = parseUrls(newValue);
    if (urls.length === 0) {
      return new Error("Enter a valid url");
    }
    try {
      for (const url of urls) {
        new URL(url);
      }
      return undefined;
    } catch (err: unknown) {
      console.error(err);
      return new Error("Enter a valid url");
    }
  }
}

export { McapRealPipelineBenchmarkDataSourceFactory };
