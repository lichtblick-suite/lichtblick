// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { MessageEvent } from "@lichtblick/suite";
import MessageEventBuilder from "@lichtblick/suite-base/testing/builders/MessageEventBuilder";

import { UndeliveredMessages } from "./undeliveredMessages";

function message(topic: string): MessageEvent {
  return MessageEventBuilder.messageEvent({ topic });
}

describe("UndeliveredMessages", () => {
  it("holds the latest message of a requested topic until a rendered frame delivers it", () => {
    // Given a panel that requested /tf_static
    const undelivered = new UndeliveredMessages();
    undelivered.setRequestedTopics(new Set(["/tf_static"]));
    const first = message("/tf_static");
    const latest = message("/tf_static");

    // When two frames carrying /tf_static miss the panel
    undelivered.hold([first]);
    undelivered.hold([latest]);

    // Then only the latest one is held, and it is dropped once a rendered frame delivers the topic
    const frame = undelivered.frameFor(undefined, new Set(["/tf_static"]));
    expect(frame).toEqual([latest]);
    undelivered.markDelivered(frame, new Set(["/tf_static"]));
    expect(undelivered.hasHeld()).toBe(false);
  });

  it("does not hold topics that are not requested or already delivered", () => {
    // Given a panel that requested /tf_static and already rendered a frame with it
    const undelivered = new UndeliveredMessages();
    undelivered.setRequestedTopics(new Set(["/tf_static"]));
    undelivered.markDelivered([message("/tf_static")], new Set(["/tf_static"]));

    // When later frames carry /tf_static and a topic the panel never requested
    undelivered.hold([message("/tf_static"), message("/other")]);

    // Then nothing is held
    expect(undelivered.hasHeld()).toBe(false);
  });

  it("adds held messages on subscribed topics in front of a new pipeline frame", () => {
    // Given a held /tf_static message
    const undelivered = new UndeliveredMessages();
    undelivered.setRequestedTopics(new Set(["/tf_static", "/points"]));
    const held = message("/tf_static");
    undelivered.hold([held]);
    const points = message("/points");

    // When the next pipeline frame only carries /points
    const frame = undelivered.frameFor([points], new Set(["/tf_static", "/points"]));

    // Then the frame given to the render state builder carries both
    expect(frame).toEqual([held, points]);
  });

  it("keeps a held message back until its topic is in the panel's subscriptions", () => {
    // Given a held /tf_static message that arrived before the panel's local subscriptions caught up
    const undelivered = new UndeliveredMessages();
    undelivered.setRequestedTopics(new Set(["/tf_static"]));
    const held = message("/tf_static");
    const pipelineFrame = [held];
    undelivered.hold(pipelineFrame);

    // When the frame is built before /tf_static is subscribed
    const early = undelivered.frameFor(pipelineFrame, new Set());

    // Then it goes through untouched, and the held message comes with a later build once subscribed
    expect(early).toBe(pipelineFrame);
    expect(undelivered.frameFor(pipelineFrame, new Set(["/tf_static"]))).toEqual([held]);
  });

  it("hands the builder the same array again when a seen pipeline frame has nothing to add", () => {
    // Given a pipeline frame that was already built once
    const undelivered = new UndeliveredMessages();
    const pipelineFrame = [message("/points")];
    const built = undelivered.frameFor(pipelineFrame, new Set(["/points"]));

    // When the same pipeline frame is built again (e.g. a re-render for another reason)
    const again = undelivered.frameFor(pipelineFrame, new Set(["/points"]));

    // Then the builder gets the identical array, so it does not process the frame twice
    expect(again).toBe(built);
  });

  it("waits again for a topic that is dropped and subscribed again", () => {
    // Given /tf_static was delivered
    const undelivered = new UndeliveredMessages();
    undelivered.setRequestedTopics(new Set(["/tf_static"]));
    undelivered.markDelivered([message("/tf_static")], new Set(["/tf_static"]));

    // When the panel unsubscribes from it and subscribes again
    undelivered.setRequestedTopics(new Set());
    undelivered.setRequestedTopics(new Set(["/tf_static"]));
    undelivered.hold([message("/tf_static")]);

    // Then its (injected) last message is held again
    expect(undelivered.hasHeld()).toBe(true);
  });

  it("forgets everything on reset", () => {
    // Given a held message
    const undelivered = new UndeliveredMessages();
    undelivered.setRequestedTopics(new Set(["/tf_static"]));
    undelivered.hold([message("/tf_static")]);

    // When the panel element is mounted again
    undelivered.reset();
    undelivered.hold([message("/tf_static")]);

    // Then nothing is held and no topic is requested
    expect(undelivered.hasHeld()).toBe(false);
  });
});
