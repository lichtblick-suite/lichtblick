// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { Immutable, MessageEvent } from "@lichtblick/suite";

/**
 * Messages a panel requested on a live source but has not received in a rendered frame yet.
 *
 * When a panel subscribes to a topic, the pipeline injects the topic's last message (e.g. a latched
 * /tf_static that a live source never sends again) into a single frame. That frame can miss the
 * panel: it arrives before the panel's local subscriptions (React state) include the topic, so the
 * render state builder filters it out, or while the panel is not ready or still rendering, so the
 * frame is dropped. This keeps the latest message of each requested topic until a rendered frame
 * has delivered a message on that topic, so it can be delivered with the next render.
 */
export class UndeliveredMessages {
  #requestedTopics = new Set<string>();
  #deliveredTopics = new Set<string>();
  #heldByTopic = new Map<string, MessageEvent>();
  #lastBuilt: {
    pipelineFrame: Immutable<MessageEvent[]> | undefined;
    frame: Immutable<MessageEvent[]> | undefined;
  } = { pipelineFrame: undefined, frame: undefined };

  /**
   * The topics the panel subscribes to. A topic that is dropped forgets that it was delivered, so if
   * it is subscribed again it waits for its (injected) last message again.
   */
  public setRequestedTopics(topics: ReadonlySet<string>): void {
    this.#requestedTopics = new Set(topics);
    for (const topic of [...this.#deliveredTopics, ...this.#heldByTopic.keys()]) {
      if (!topics.has(topic)) {
        this.#forget(topic);
      }
    }
  }

  /** Forget everything, e.g. when the panel element is mounted again. */
  public reset(): void {
    this.#requestedTopics = new Set();
    this.#deliveredTopics.clear();
    this.#heldByTopic.clear();
    this.#lastBuilt = { pipelineFrame: undefined, frame: undefined };
  }

  /** Keep the latest message of each requested topic that no rendered frame has delivered yet. */
  public hold(pipelineFrame: readonly MessageEvent[] | undefined): void {
    for (const messageEvent of pipelineFrame ?? []) {
      if (this.#isWaitingFor(messageEvent.topic)) {
        this.#heldByTopic.set(messageEvent.topic, messageEvent);
      }
    }
  }

  /**
   * The frame to hand the render state builder: held messages on subscribed topics are added to
   * the pipeline frame. The builder only processes a frame it has not seen, so a pipeline frame it
   * already got contributes nothing again, and with nothing to add it gets the same array as last
   * time.
   */
  public frameFor(
    pipelineFrame: Immutable<MessageEvent[]> | undefined,
    subscribedTopics: ReadonlySet<string>,
  ): Immutable<MessageEvent[]> | undefined {
    const frame =
      pipelineFrame === this.#lastBuilt.pipelineFrame
        ? this.#frameForSeenPipelineFrame(subscribedTopics)
        : this.#frameForNewPipelineFrame(pipelineFrame, subscribedTopics);
    this.#lastBuilt = { pipelineFrame, frame };
    return frame;
  }

  /** The panel renders this frame: its messages on subscribed topics are delivered, stop holding them. */
  public markDelivered(
    frame: Immutable<MessageEvent[]> | undefined,
    subscribedTopics: ReadonlySet<string>,
  ): void {
    for (const messageEvent of frame ?? []) {
      if (subscribedTopics.has(messageEvent.topic)) {
        this.#deliveredTopics.add(messageEvent.topic);
        this.#heldByTopic.delete(messageEvent.topic);
      }
    }
  }

  /** Whether a message is still waiting for a rendered frame. */
  public hasHeld(): boolean {
    return this.#heldByTopic.size > 0;
  }

  #isWaitingFor(topic: string): boolean {
    return this.#requestedTopics.has(topic) && !this.#deliveredTopics.has(topic);
  }

  #forget(topic: string): void {
    this.#deliveredTopics.delete(topic);
    this.#heldByTopic.delete(topic);
  }

  #heldOn(subscribedTopics: ReadonlySet<string>): MessageEvent[] {
    return [...this.#heldByTopic.values()].filter((messageEvent) =>
      subscribedTopics.has(messageEvent.topic),
    );
  }

  /** A pipeline frame the builder has not seen: held messages it does not carry go in front. */
  #frameForNewPipelineFrame(
    pipelineFrame: Immutable<MessageEvent[]> | undefined,
    subscribedTopics: ReadonlySet<string>,
  ): Immutable<MessageEvent[]> | undefined {
    const inFrame = new Set<unknown>(pipelineFrame ?? []);
    const missed = this.#heldOn(subscribedTopics).filter((messageEvent) => !inFrame.has(messageEvent));
    return missed.length > 0 ? [...missed, ...(pipelineFrame ?? [])] : pipelineFrame;
  }

  /** The same pipeline frame again: only held messages are new to the builder. */
  #frameForSeenPipelineFrame(
    subscribedTopics: ReadonlySet<string>,
  ): Immutable<MessageEvent[]> | undefined {
    const missed = this.#heldOn(subscribedTopics);
    return missed.length > 0 ? missed : this.#lastBuilt.frame;
  }
}
