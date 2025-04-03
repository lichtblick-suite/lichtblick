// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { DataSourceFactoryInitializeArgs } from "@lichtblick/suite-base/context/PlayerSelectionContext";
import {
  IterablePlayer,
  IterablePlayerOptions,
  WorkerIterableSource,
} from "@lichtblick/suite-base/players/IterablePlayer";
import NoopMetricsCollector from "@lichtblick/suite-base/players/NoopMetricsCollector";
import BasicBuilder from "@lichtblick/suite-base/testing/builders/BasicBuilder";

import Ros1LocalBagDataSourceFactory from "./Ros1LocalBagDataSourceFactory";

jest.mock("@lichtblick/suite-base/players/IterablePlayer/WorkerIterableSource");
jest.mock("@lichtblick/suite-base/players/IterablePlayer");

describe("Ros1LocalBagDataSourceFactory", () => {
  let factory: Ros1LocalBagDataSourceFactory;

  beforeEach(() => {
    factory = new Ros1LocalBagDataSourceFactory();
  });

  it("should have correct metadata", () => {
    expect(factory.id).toBe("ros1-local-bagfile");
    expect(factory.type).toBe("file");
    expect(factory.displayName).toBe("ROS 1 Bag");
    expect(factory.iconName).toBe("OpenFile");
    expect(factory.supportedFileTypes).toEqual([".bag"]);
  });

  it("should return undefined if no files is provided", () => {
    const result = factory.initialize({
      files: [],
      metricsCollector: new NoopMetricsCollector(),
    });

    expect(result).toBeUndefined();
  });

  it("should return undefined if no file is provided", () => {
    const result = factory.initialize({
      file: undefined,
      metricsCollector: new NoopMetricsCollector(),
    });

    expect(result).toBeUndefined();
  });

  it("should return undefined if undefined file is provided", () => {
    const result = factory.initialize({
      files: [undefined as unknown as File],
      metricsCollector: new NoopMetricsCollector(),
    });

    expect(result).toBeUndefined();
  });

  it.each([
    {
      file: new File([BasicBuilder.string()], `${BasicBuilder.string()}.bag`),
      metricsCollector: new NoopMetricsCollector(),
    },
    {
      files: [new File([BasicBuilder.string()], `${BasicBuilder.string()}.bag`)],
      metricsCollector: new NoopMetricsCollector(),
    },
  ])("should return an IterablePlayer", (args: DataSourceFactoryInitializeArgs) => {
    const expectedInitArgs = {
      ...(args.file ? { file: args.file } : undefined),
      ...(args.files ? { file: args.files[0] } : undefined),
    };

    const player = factory.initialize(args);

    expect(player).toBeInstanceOf(IterablePlayer);
    expect(WorkerIterableSource).toHaveBeenCalledWith({
      initWorker: expect.any(Function),
      initArgs: expectedInitArgs,
    });
    expect(IterablePlayer).toHaveBeenCalledWith({
      metricsCollector: args.metricsCollector,
      source: expect.any(WorkerIterableSource),
      name: expectedInitArgs.file?.name,
      sourceId: expect.any(String),
    } as IterablePlayerOptions);
  });
});
