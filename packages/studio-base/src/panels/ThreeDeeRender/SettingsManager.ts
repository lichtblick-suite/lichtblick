// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import EventEmitter from "eventemitter3";
import { produce } from "immer";

import { SettingsTreeAction, SettingsTreeNode, SettingsTreeNodes } from "@foxglove/studio";

import { LayerErrors, Path } from "./LayerErrors";

export type ActionHandler = (action: SettingsTreeAction) => void;

export type SettingsTreeNodeWithActionHandler = SettingsTreeNode & { handler?: ActionHandler };

export type SettingsTreeEntry = { path: Path; node: SettingsTreeNodeWithActionHandler };

export type SettingsManagerEvents = {
  update: () => void;
};

export class SettingsManager extends EventEmitter<SettingsManagerEvents> {
  public errors = new LayerErrors();

  #nodesByKey = new Map<string, SettingsTreeEntry[]>();
  #root: SettingsTreeNodeWithActionHandler = { children: {} };

  public constructor(baseTree: SettingsTreeNodes) {
    super();

    this.#root = { children: baseTree };
    this.errors.on("update", this.handleErrorUpdate);
    this.errors.on("remove", this.handleErrorUpdate);
    this.errors.on("clear", this.handleErrorUpdate);
  }

  public setNodesForKey(key: string, nodes: SettingsTreeEntry[]): void {
    this.#root = produce(this.#root, (draft) => {
      // Delete all previous nodes for this key
      const prevNodes = this.#nodesByKey.get(key);
      if (prevNodes) {
        for (const { path } of prevNodes) {
          removeNodeAtPath(draft, path);
        }
      }

      // Add the new nodes
      for (const { path, node } of nodes) {
        node.error ??= this.errors.errors.errorAtPath(path);
        node.label ??= path[path.length - 1];
        node.defaultExpansionState ??= "collapsed";
        addNodeAtPath(draft, path, node);
      }
    });

    // Update the map of nodes by key
    this.#nodesByKey.set(key, nodes);

    this.emit("update");
  }

  public setLabel(path: Path, label: string): void {
    this.#root = produce(this.#root, (draft) => {
      setLabelAtPath(draft, path, label);
    });

    this.emit("update");
  }

  public clearChildren(path: Path): void {
    this.#root = produce(this.#root, (draft) => {
      clearChildren(draft, path);
    });

    this.emit("update");
  }

  public tree(): SettingsTreeNodes {
    return this.#root.children!;
  }

  public handleAction = (action: SettingsTreeAction): void => {
    const path = action.payload.path;

    // Walk the settings tree down to the end of the path, firing any action
    // handlers along the way
    let curNode = this.#root;
    curNode.handler?.(action);
    for (const segment of path) {
      const nextNode: SettingsTreeNodeWithActionHandler | undefined = curNode.children?.[segment];
      if (!nextNode) {
        return;
      }
      nextNode.handler?.(action);
      curNode = nextNode;
    }
  };

  public handleErrorUpdate = (path: Path): void => {
    this.#root = produce(this.#root, (draft) => {
      if (path.length === 0) {
        return { ...draft };
      }

      let curNode = draft;
      for (const segment of path) {
        const nextNode = curNode.children?.[segment];
        if (!nextNode) {
          curNode.children = { ...curNode.children };
          return draft;
        }
        curNode = nextNode;
      }

      curNode.error = this.errors.errors.errorAtPath(path);
      return draft;
    });

    this.emit("update");
  };
}

function removeNodeAtPath(root: SettingsTreeNode, path: Path): boolean {
  if (path.length === 0) {
    return false;
  }

  const segment = path[0]!;
  const nextNode = root.children?.[segment];
  if (!nextNode) {
    return false;
  }

  if (path.length === 1) {
    const hasEntry = root.children?.[segment] != undefined;
    if (hasEntry) {
      root.children![segment] = undefined;
    }
    return hasEntry;
  }

  return removeNodeAtPath(nextNode, path.slice(1));
}

function clearChildren(root: SettingsTreeNode, path: Path): void {
  if (path.length === 0) {
    return;
  }

  const segment = path[0]!;
  const nextNode = root.children?.[segment];
  if (!nextNode) {
    return;
  }

  if (path.length === 1) {
    nextNode.children = undefined;
    return;
  }

  clearChildren(nextNode, path.slice(1));
}

function addNodeAtPath(root: SettingsTreeNode, path: Path, node: SettingsTreeNode): void {
  if (path.length === 0) {
    throw new Error(`Empty path for settings node "${node.label}"`);
  }

  // Recursively walk/build the settings tree down to the end of the path except
  // for the last segment, which is the node to add
  let curNode = root;
  for (let i = 0; i < path.length - 1; i++) {
    const segment = path[i]!;
    if (!curNode.children) {
      curNode.children = {};
    }
    if (!curNode.children[segment]) {
      curNode.children[segment] = {};
    }
    curNode = curNode.children[segment]!;
  }

  // Assign the node to the last segment of the path
  const lastSegment = path[path.length - 1]!;
  if (!curNode.children) {
    curNode.children = {};
  }
  curNode.children[lastSegment] = node;
}

function setLabelAtPath(root: SettingsTreeNode, path: Path, label: string): void {
  if (path.length === 0) {
    throw new Error(`Empty path for settings label "${label}"`);
  }

  // Recursively walk/build the settings tree down to the end of the path
  let curNode = root;
  for (let i = 0; i < path.length; i++) {
    const segment = path[i]!;
    if (!curNode.children) {
      curNode.children = {};
    }
    if (!curNode.children[segment]) {
      curNode.children[segment] = {};
    }
    curNode = curNode.children[segment]!;
  }

  curNode.label = label;
}
