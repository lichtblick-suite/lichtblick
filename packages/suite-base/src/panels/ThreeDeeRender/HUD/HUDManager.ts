// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

/**
 * Manages HUD elements.
 */
export class HUDManager {
  #infoMessagesByTopic = new Map<string, string[]>();
  #onChange: () => void;

  public constructor(onChange: () => void) {
    this.#onChange = onChange;
  }

  public getInfoMessages(): string[] {
    const allTexts: string[] = [];
    // Sort topics lexicographically to ensure consistent ordering
    const sortedTopics = Array.from(this.#infoMessagesByTopic.keys()).sort();
    for (const topic of sortedTopics) {
      const texts = this.#infoMessagesByTopic.get(topic);
      if (texts) {
        allTexts.push(...texts);
      }
    }
    return allTexts;
  }

  public setInfoMessagesForTopic(topic: string, infoMessages: string[]): void {
    if (infoMessages.length === 0) {
      // Empty array means remove debug info for this topic
      if (this.#infoMessagesByTopic.delete(topic)) {
        this.#onChange();
      }
    } else {
      this.#infoMessagesByTopic.set(topic, [...infoMessages]);
      this.#onChange();
    }
  }

  public clearInfoMessagesForTopic(topic: string): void {
    if (this.#infoMessagesByTopic.delete(topic)) {
      this.#onChange();
    }
  }

  public clear(): void {
    this.#infoMessagesByTopic.clear();
    this.#onChange();
  }
}
