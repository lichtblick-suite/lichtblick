// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { PanelExtensionContext } from "@foxglove/studio";

/**
 * An asset loaded from Studio's asset manager.
 */
export type Asset = {
  /** Asset URI, corresponds to the URI with which the asset was retrieved. */
  uri: string;
  /** Binary asset data. */
  data: Uint8Array;
  /** Asset type. */
  mediaType?: string;
};

export type DraggedMessagePath = {
  /** The full message path */
  path: string;
  /** The schema name of the top-level topic being dragged */
  rootSchemaName: string | undefined;
  /** True if the path represents a whole topic (no message path component). */
  isTopic: boolean;
  /** True if the path represents a primitive value inside a message. */
  isLeaf: boolean;
};

export type MessagePathDropStatus = {
  /** True if the panel would be able to accept this dragged message path. */
  canDrop: boolean;
  /**
   * Indicate the type of operation that would occur if this path were dropped. Used to change the
   * mouse cursor.
   */
  effect?: "replace" | "add";
  /**
   * A message to display to the user indicating what will happen when the path is dropped.
   */
  message?: string;
};

export type MessagePathDropConfig = {
  /** Called when the user drags message paths over the panel. */
  getDropStatus: (paths: readonly DraggedMessagePath[]) => MessagePathDropStatus;

  /** Called when the user drops message paths on the panel. */
  handleDrop: (paths: readonly DraggedMessagePath[]) => void;
};

/**
 * BuiltinPanelExtensionContext adds additional built-in only functionality to the PanelExtensionContext.
 *
 * These are unstable internal interfaces still in development and not yet available to 3rd party
 * extensions.
 */
export type BuiltinPanelExtensionContext = {
  /**
   * Fetch an asset from Studio's asset manager.
   *
   * The asset manager will determine how to fetch the asset. I.E. http(s) uris will use http requests
   * while other schemes may fall back to the data source.
   *
   * @param uri URI identifying the asset
   * @param options Addiotional options:
   *  - Optional abort signal that allows to abort fetching of the asset. Note that this
   *    might not be supported by all fetching methods.
   *  - Optional referenceUrl URL which may be used to resolve package:// URIs
   * @returns
   */
  unstable_fetchAsset: (
    uri: string,
    options?: { signal?: AbortSignal; referenceUrl?: string },
  ) => Promise<Asset>;

  /**
   * Updates the configuration for message path drag & drop support. A value of `undefined`
   * indicates that the panel does not accept any dragged message paths.
   */
  unstable_setMessagePathDropConfig: (config: MessagePathDropConfig | undefined) => void;
} & PanelExtensionContext;
