// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import EventEmitter from "eventemitter3";

import Logger from "@foxglove/log";

export type Path = ReadonlyArray<string>;

const TOPIC_PATH: [string, string] = ["topics", ""];

export class NodeError {
  path: Path;
  errorsById?: Map<string, string>;
  children?: Map<string, NodeError>;

  constructor(path: Path) {
    this.path = path;
  }

  errorMessage(): string | undefined {
    if (this.errorsById && this.errorsById.size > 0) {
      const errorMessages = Array.from(this.errorsById.values());
      return errorMessages.join("\n");
    } else {
      return undefined;
    }
  }

  errorAtPath(path: Path): string | undefined {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let node: NodeError | undefined = this;
    for (const segment of path) {
      node = node.children?.get(segment);
      if (!node) {
        return undefined;
      }
    }
    return node.errorMessage();
  }

  clone(): NodeError {
    const clone = new NodeError(this.path);
    clone.errorsById = this.errorsById;
    clone.children = this.children;
    return clone;
  }
}

export type LayerErrorEvents = {
  update: (path: Path, errorId: string, errorMessage: string) => void;
  remove: (path: Path, errorId: string) => void;
  clear: (path: Path) => void;
};

const log = Logger.getLogger(__filename);

export class LayerErrors extends EventEmitter<LayerErrorEvents> {
  errors = new NodeError([]);

  add(path: Path, errorId: string, errorMessage: string): void {
    // Get or create the node for the given path
    let node = this.errors;
    for (const segment of path) {
      if (!node.children) {
        node.children = new Map();
      }
      if (!node.children.has(segment)) {
        node.children.set(segment, new NodeError([...node.path, segment]));
      }
      node = node.children.get(segment)!;
    }

    // Create the error map if it does not already exist
    node.errorsById ??= new Map();

    // Onlu log the first error message per path+id for performance
    const prevErrorMessage = node.errorsById.get(errorId);
    if (prevErrorMessage == undefined) {
      log.warn(`[${path.join(" > ")}] ${errorMessage}`);
    }

    // Add or update the error
    if (errorMessage !== prevErrorMessage) {
      node.errorsById.set(errorId, errorMessage);
      this.emit("update", path, errorId, errorMessage);
    }
  }

  addToTopic(topicId: string, errorId: string, errorMessage: string): void {
    TOPIC_PATH[1] = topicId;
    this.add(TOPIC_PATH, errorId, errorMessage);
  }

  hasError(path: Path, errorId: string): boolean {
    const node = this._getNode(path);
    return node?.errorsById?.has(errorId) === true;
  }

  remove(path: Path, errorId: string): void {
    const node = this._getNode(path);
    if (node?.errorsById?.has(errorId) === true) {
      node.errorsById.delete(errorId);
      this.emit("remove", path, errorId);
    }
  }

  removeFromTopic(topicId: string, errorId: string): void {
    TOPIC_PATH[1] = topicId;
    this.remove(TOPIC_PATH, errorId);
  }

  clearPath(path: Path): void {
    const node = this._getNode(path);
    if (node) {
      node.children?.clear();
      node.errorsById?.clear();
      this.emit("clear", path);
    }
  }

  clearTopic(topicId: string): void {
    TOPIC_PATH[1] = topicId;
    this.clearPath(TOPIC_PATH);
  }

  clear(): void {
    this.clearPath([]);
  }

  private _getNode(path: Path): NodeError | undefined {
    let node: NodeError | undefined = this.errors;
    for (const segment of path) {
      node = node.children?.get(segment);
      if (!node) {
        return undefined;
      }
    }
    return node;
  }
}
