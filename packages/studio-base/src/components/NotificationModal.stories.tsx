// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { StoryObj } from "@storybook/react";

import NotificationModal from "@foxglove/studio-base/components/NotificationModal";

const fakeError = () => {
  const err = Error("This error is on purpose - it comes from the story");

  err.stack = `at http://localhost:49891/main.iframe.bundle.js:13051:22
      at finalStoryFn (http://localhost:49891/some_vendor_library-name_component-name-9a6f77.iframe.bundle.js:56275:32)
      at http://localhost:49891/some_vendor_library-name_component-name-9a6f77.iframe.bundle.js:53001:21
      at http://localhost:49891/some_vendor_library-name_component-name-9a6f77.iframe.bundle.js:54920:16
      at jsxDecorator (http://localhost:49891/some_vendor_library-name_component-name-9a6f77.iframe.bundle.js:48482:15)
      at http://localhost:49891/some_vendor_library-name_component-name-9a6f77.iframe.bundle.js:53001:21
      at http://localhost:49891/some_vendor_library-name_component-name-9a6f77.iframe.bundle.js:54884:12
      at http://localhost:49891/some_vendor_library-name_component-name-9a6f77.iframe.bundle.js:54920:16
      at withGrid (http://localhost:49891/some_vendor_library-name_component-name-9a6f77.iframe.bundle.js:45137:10)
      at http://localhost:49891/some_vendor_library-name_component-name-9a6f77.iframe.bundle.js:53001:21`;

  return err;
};

export default {
  title: "components/NotificationModal",
};

export const ErrorNoSubtextWithDetails: StoryObj = {
  render: function Story() {
    return (
      <NotificationModal
        onRequestClose={() => {}}
        notification={{
          id: "1",
          message: "Error 1",
          details: fakeError(),
          created: new Date(),
          severity: "error",
        }}
      />
    );
  },

  parameters: { colorScheme: "light" },
};

export const ErrorNoSubtextWithDetailsDark: StoryObj = {
  ...ErrorNoSubtextWithDetails,
  parameters: { colorScheme: "dark" },
};

export const ErrorWithSubtextAndDetails: StoryObj = {
  render: function Story() {
    return (
      <NotificationModal
        onRequestClose={() => {}}
        notification={{
          id: "1",
          message: "Error 1",
          details: fakeError(),
          created: new Date(),
          severity: "error",
          subText: "This error has a subtext.",
        }}
      />
    );
  },

  parameters: { colorScheme: "light" },
};

export const ErrorWithSubtextNoDetails: StoryObj = {
  render: function Story() {
    return (
      <NotificationModal
        onRequestClose={() => {}}
        notification={{
          id: "1",
          message: "Error 1",
          details: undefined,
          created: new Date(),
          severity: "error",
          subText: "This error has a subtext.",
        }}
      />
    );
  },

  parameters: { colorScheme: "light" },
};

export const Warning: StoryObj = {
  render: function Story() {
    return (
      <NotificationModal
        onRequestClose={() => {}}
        notification={{
          id: "1",
          message: "Warning 1",
          details: "Some error details",
          created: new Date(),
          severity: "warn",
        }}
      />
    );
  },

  parameters: { colorScheme: "dark" },
};

export const ErrorNoDetailsOrSubtext: StoryObj = {
  render: function Story() {
    return (
      <NotificationModal
        onRequestClose={() => {}}
        notification={{
          id: "1",
          message: "Error 1",
          details: undefined,
          created: new Date(),
          severity: "error",
        }}
      />
    );
  },

  parameters: { colorScheme: "dark" },
};

export const ErrorWithJsxElementDetails: StoryObj = {
  render: function Story() {
    return (
      <NotificationModal
        onRequestClose={() => {}}
        notification={{
          id: "1",
          message: "Error 1",
          details: (
            <p>
              This is <b style={{ color: "red" }}>customized</b> error detail.
            </p>
          ),
          created: new Date(),
          severity: "error",
        }}
      />
    );
  },

  parameters: { colorScheme: "light" },
};

export const ErrorWithJsxElementDetailsDark: StoryObj = {
  ...ErrorWithJsxElementDetails,
  parameters: { colorScheme: "dark" },
};

export const ErrorWithNewlineDetails: StoryObj = {
  render: function Story() {
    return (
      <NotificationModal
        onRequestClose={() => {}}
        notification={{
          id: "1",
          message: "Error 1",
          details: "Some details.\n\nWith a newline.",
          created: new Date(),
          severity: "error",
        }}
      />
    );
  },

  parameters: { colorScheme: "dark" },
};
