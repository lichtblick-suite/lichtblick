// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import EventEmitter from "eventemitter3";

import Logger from "@foxglove/log";

export type Path = ReadonlyArray<string>;

const TOPIC_PATH: [string, string] = ["topics", ""];

export class NodeError {
  public path: Path;
  public errorsById?: Map<string, string>;
  public children?: Map<string, NodeError>;

  public constructor(path: Path) {
    this.path = path;
  }

  public errorMessage(): string | undefined {
    if (this.errorsById && this.errorsById.size > 0) {
      const errorMessages = Array.from(this.errorsById.values());
      return errorMessages.join(`\n`);
    } else {
      return undefined;
    }
  }

  public errorAtPath(path: Path): string | undefined {
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

  public clone(): NodeError {
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
  public errors = new NodeError([]);

  public add(path: Path, errorId: string, errorMessage: string): void {
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

  public addToTopic(topicId: string, errorId: string, errorMessage: string): void {
    TOPIC_PATH[1] = topicId;
    this.add(TOPIC_PATH, errorId, errorMessage);
  }

  public hasError(path: Path, errorId: string): boolean {
    const node = this.#getNode(path);
    return node?.errorsById?.has(errorId) === true;
  }

  public remove(path: Path, errorId: string): void {
    const node = this.#getNode(path);
    if (node?.errorsById?.has(errorId) === true) {
      node.errorsById.delete(errorId);
      this.emit("remove", path, errorId);
    }
  }

  public removeFromTopic(topicId: string, errorId: string): void {
    TOPIC_PATH[1] = topicId;
    this.remove(TOPIC_PATH, errorId);
  }

  /**
   * If value is falsy then add error to path, otherwise remove error from settings path
   * @param value - value to check, if false, add error, if true, remove error
   * @param path  - path to add/remove error
   * @param errorId - id unique to error
   * @param errorMessage - error message
   */
  // eslint-disable-next-line @foxglove/no-boolean-parameters
  public errorIfFalse(value: boolean, path: Path, errorId: string, errorMessage: string): void {
    if (!value) {
      this.add(path, errorId, errorMessage);
    } else {
      this.remove(path, errorId);
    }
  }

  public clearPath(path: Path): void {
    const node = this.#getNode(path);
    if (!node) {
      return;
    }
    let cleared = false;
    if (node.children && node.children.size > 0) {
      node.children.clear();
      cleared = true;
    }
    if (node.errorsById && node.errorsById.size > 0) {
      node.errorsById.clear();
      cleared = true;
    }
    if (cleared) {
      this.emit("clear", path);
    }
  }

  public clearTopic(topicId: string): void {
    TOPIC_PATH[1] = topicId;
    this.clearPath(TOPIC_PATH);
  }

  public clear(): void {
    this.clearPath([]);
  }

  #getNode(path: Path): NodeError | undefined {
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
