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
   * @param options Optional abort signal that allows to abort fetching of the asset. Note that this
   * might not be supported by all fetching methods.
   * @returns
   */
  unstable_fetchAsset: (uri: string, options?: { signal: AbortSignal }) => Promise<Asset>;
} & PanelExtensionContext;
