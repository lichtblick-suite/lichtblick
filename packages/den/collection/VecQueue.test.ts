// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { VecQueue } from "./VecQueue";

describe("VecQueue", () => {
  it("should make an empty queue", () => {
    const queue = new VecQueue();
    expect(queue.size()).toEqual(0);
    expect(queue.dequeue()).toEqual(undefined);
  });

  it("should add and remove one item", () => {
    const queue = new VecQueue<string>();
    queue.enqueue("a");
    expect(queue.size()).toEqual(1);
    expect(queue.dequeue()).toEqual("a");
    expect(queue.size()).toEqual(0);
  });

  it("should add many items and remove them", () => {
    const queue = new VecQueue<number>();
    for (let i = 0; i < 10; ++i) {
      queue.enqueue(i);
    }
    expect(queue.size()).toEqual(10);
    for (let i = 0; i < 10; ++i) {
      expect(queue.dequeue()).toEqual(i);
    }
    expect(queue.size()).toEqual(0);
  });

  it("should add and remove items interleaves", () => {
    const queue = new VecQueue<number>();
    for (let i = 0; i < 10; ++i) {
      queue.enqueue(i);
      expect(queue.size()).toEqual(1);
      expect(queue.dequeue()).toEqual(i);
      expect(queue.size()).toEqual(0);
    }
  });

  it("should clear", () => {
    const queue = new VecQueue<number>();
    for (let i = 0; i < 10; ++i) {
      queue.enqueue(i);
    }
    for (let i = 0; i < 3; ++i) {
      expect(queue.dequeue()).toEqual(i);
    }
    queue.clear();
    expect(queue.size()).toEqual(0);
    for (let i = 0; i < 10; ++i) {
      queue.enqueue(i);
    }
    for (let i = 0; i < 3; ++i) {
      expect(queue.dequeue()).toEqual(i);
    }
  });

  it("should read then write without growing", () => {
    const queue = new VecQueue<number>();
    for (let i = 0; i < 10; ++i) {
      queue.enqueue(i);
    }
    expect(queue.size()).toEqual(10);
    expect(queue.capacity()).toEqual(16);

    for (let i = 0; i < 3; ++i) {
      expect(queue.dequeue()).toEqual(i);
    }
    expect(queue.size()).toEqual(7);
    expect(queue.capacity()).toEqual(16);

    for (let i = 10; i < 12; ++i) {
      queue.enqueue(i);
    }
    expect(queue.size()).toEqual(9);

    for (let i = 3; i < 12; ++i) {
      expect(queue.dequeue()).toEqual(i);
    }
    expect(queue.size()).toEqual(0);
    expect(queue.capacity()).toEqual(16);
  });

  it("should stop reading when no more items", () => {
    const queue = new VecQueue<number>();
    for (let i = 0; i < 10; ++i) {
      queue.enqueue(i);
    }
    for (let i = 0; i < 10; ++i) {
      expect(queue.dequeue()).toEqual(i);
    }
    expect(queue.size()).toEqual(0);
    for (let i = 0; i < 2; ++i) {
      expect(queue.dequeue()).toEqual(undefined);
    }

    queue.enqueue(11);
    expect(queue.dequeue()).toEqual(11);
  });

  it("should grow when write is before read and is less than half capacity", () => {
    const queue = new VecQueue<number>();
    queue.enqueue(1);
    queue.enqueue(2);
    queue.enqueue(3);
    queue.enqueue(4);

    expect(queue.size()).toEqual(4);
    expect(queue.capacity()).toEqual(4);

    expect(queue.dequeue()).toEqual(1);
    expect(queue.dequeue()).toEqual(2);
    queue.enqueue(5);
    expect(queue.capacity()).toEqual(4);

    queue.enqueue(6);
    expect(queue.capacity()).toEqual(8);

    queue.enqueue(7);
    expect(queue.capacity()).toEqual(8);

    expect(queue.dequeue()).toEqual(3);
    expect(queue.dequeue()).toEqual(4);
    expect(queue.dequeue()).toEqual(5);
    expect(queue.dequeue()).toEqual(6);
    expect(queue.dequeue()).toEqual(7);
  });

  it("should grow when write before read and is greater than half capacity", () => {
    const queue = new VecQueue<number>();
    for (let i = 0; i < 8; ++i) {
      queue.enqueue(i);
    }

    expect(queue.size()).toEqual(8);
    expect(queue.capacity()).toEqual(8);

    for (let i = 0; i < 6; ++i) {
      expect(queue.dequeue()).toEqual(i);
    }

    expect(queue.size()).toEqual(2);
    for (let i = 8; i < 14; ++i) {
      queue.enqueue(i);
    }
    expect(queue.capacity()).toEqual(16);

    queue.enqueue(14);
    for (let i = 6; i < 15; ++i) {
      expect(queue.dequeue()).toEqual(i);
    }
    expect(queue.size()).toEqual(0);
  });
});
