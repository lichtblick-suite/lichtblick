// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { StoryContext } from "@storybook/addons";

let nextFn: (email: string) => Promise<void>;
export default function mockSubscribeToNewsletter(email: string): Promise<void> {
  return nextFn?.(email);
}

// Decorator for all stories to allow passing a mock function implementation in `parameters.mockSubscribeToNewsletter`
// Example: https://storybook.js.org/docs/react/workflows/build-pages-with-storybook#mocking-imports
export function withMockSubscribeToNewsletter(story: Function, { parameters }: StoryContext) {
  if (parameters && parameters.mockSubscribeToNewsletter) {
    nextFn = parameters.mockSubscribeToNewsletter;
  }
  return story();
}
