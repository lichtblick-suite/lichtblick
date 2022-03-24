// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import Logger from "@foxglove/log";

const log = Logger.getLogger(__filename);

export class LayerErrors {
  errors = new Map<string, Map<string, string>>(); // layerId -> {errorId -> errorMessage}

  addToLayer(layerId: string, errorId: string, errorMessage: string): void {
    let layerErrors = this.errors.get(layerId);
    if (!layerErrors) {
      layerErrors = new Map();
      this.errors.set(layerId, layerErrors);
    }
    layerErrors.set(errorId, errorMessage);
    log.warn(`[${layerId}] ${errorId}: ${errorMessage}`);
  }

  addToTopic(topicId: string, errorId: string, errorMessage: string): void {
    this.addToLayer(`t:${topicId}`, errorId, errorMessage);
  }

  removeFromLayer(layerId: string, errorId: string): void {
    const layerErrors = this.errors.get(layerId);
    if (layerErrors) {
      layerErrors.delete(errorId);
    }
  }

  removeFromTopic(topicId: string, errorId: string): void {
    this.removeFromLayer(`t:${topicId}`, errorId);
  }

  clearLayer(layerId: string): void {
    this.errors.delete(layerId);
  }

  clearTopic(topicId: string): void {
    this.clearLayer(`t:${topicId}`);
  }

  clear(): void {
    this.errors.clear();
  }
}
