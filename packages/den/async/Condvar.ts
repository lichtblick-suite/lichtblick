// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

/**
 * Condvar provides a condition variable interface for async code
 *
 * Callers can wait on the condition variable and other callers can notify any
 * waiters. An example use case could be a producer/consumer queue where the consumer
 * waits for the producer to notify it that there are items to consume.
 *
 * See: https://en.wikipedia.org/wiki/Monitor_(synchronization)#Condition_variables_2
 */
class Condvar {
  private waitQueue: Array<() => void> = [];

  /**
   * Wait on a notification.
   *
   * @return a promise which resolves when notified.
   *
   * ```
   * await condvar.wait();
   * ```
   */
  async wait(): Promise<void> {
    await new Promise<void>((resolve) => {
      this.waitQueue.push(resolve);
    });
  }

  /**
   * Notify one wait.
   */
  notifyOne(): void {
    const item = this.waitQueue.shift();
    item?.();
  }

  /**
   * Notify all waiting.
   */
  notifyAll(): void {
    for (const item of this.waitQueue) {
      item();
    }
    this.waitQueue.length = 0;
  }
}

export { Condvar };
