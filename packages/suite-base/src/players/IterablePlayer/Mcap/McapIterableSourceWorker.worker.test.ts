// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
import * as Comlink from "@lichtblick/comlink";
import { WorkerIterableSourceWorker } from "@lichtblick/suite-base/players/IterablePlayer/WorkerIterableSourceWorker";
import { MultiIterableSource } from "@lichtblick/suite-base/players/IterablePlayer/shared/MultiIterableSource";
import BasicBuilder from "@lichtblick/suite-base/testing/builders/BasicBuilder";

import { McapIterableSource } from "./McapIterableSource";
import { initialize } from "./McapIterableSourceWorker.worker";

jest.mock("@lichtblick/comlink", () => ({
  expose: jest.fn((val) => val),
  proxy: jest.fn((val) => val),
  transferHandlers: {
    set: jest.fn(),
  },
}));

jest.mock("./McapIterableSource");
jest.mock("@lichtblick/suite-base/players/IterablePlayer/WorkerIterableSourceWorker");
jest.mock("@lichtblick/suite-base/players/IterablePlayer/shared/MultiIterableSource");

describe("initialize", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should initialize with a single file", () => {
    const filename = `${BasicBuilder.string()}.mcap`;
    const file = new File(["data"], filename);

    const result = initialize({ file });

    expect(McapIterableSource).toHaveBeenCalledWith({ type: "file", file });
    expect(WorkerIterableSourceWorker).toHaveBeenCalled();
    expect(Comlink.proxy).toHaveBeenCalled();
    expect(result).toBeInstanceOf(WorkerIterableSourceWorker);
  });

  it("should initialize with multiple files", () => {
    const filename1 = `${BasicBuilder.string()}.mcap`;
    const filename2 = `${BasicBuilder.string()}.mcap`;
    const files = [new File(["data"], filename1), new File(["data"], filename2)];

    const result = initialize({ files });

    expect(MultiIterableSource).toHaveBeenCalledWith({ type: "files", files }, McapIterableSource);
    expect(WorkerIterableSourceWorker).toHaveBeenCalled();
    expect(Comlink.proxy).toHaveBeenCalled();
    expect(result).toBeInstanceOf(WorkerIterableSourceWorker);
  });

  it("should initialize with a single URL", () => {
    const url = `http://${BasicBuilder.string()}.com/${BasicBuilder.string()}.mcap`;

    const result = initialize({ url });

    expect(McapIterableSource).toHaveBeenCalledWith({ type: "url", url });
    expect(WorkerIterableSourceWorker).toHaveBeenCalled();
    expect(Comlink.proxy).toHaveBeenCalled();
    expect(result).toBeInstanceOf(WorkerIterableSourceWorker);
  });

  it("should initialize with multiple URLs", () => {
    const urls = [
      `http://${BasicBuilder.string()}.com/${BasicBuilder.string()}.mcap`,
      `http://${BasicBuilder.string()}.com/${BasicBuilder.string()}.mcap`,
    ];

    const result = initialize({ urls });

    expect(MultiIterableSource).toHaveBeenCalledWith({ type: "urls", urls }, McapIterableSource);
    expect(WorkerIterableSourceWorker).toHaveBeenCalled();
    expect(Comlink.proxy).toHaveBeenCalled();
    expect(result).toBeInstanceOf(WorkerIterableSourceWorker);
  });

  it("should throw an error if no valid input is provided", () => {
    expect(() => initialize({})).toThrow("file or url required");
  });
});
