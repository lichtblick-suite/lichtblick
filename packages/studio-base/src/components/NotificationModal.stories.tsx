// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import NotificationModal from "@foxglove/studio-base/components/NotificationModal";

const fakeError = () => {
  const err = Error("This error is on purpose - it comes from the story");

  err.stack = `at http://localhost:49891/main.iframe.bundle.js:13051:22
      at finalStoryFn (http://localhost:49891/vendors-node_modules_fluentui_react-icons-mdl2_lib_components_AddIcon_js-node_modules_fluentu-9a6f77.iframe.bundle.js:56275:32)
      at http://localhost:49891/vendors-node_modules_fluentui_react-icons-mdl2_lib_components_AddIcon_js-node_modules_fluentu-9a6f77.iframe.bundle.js:53001:21
      at http://localhost:49891/vendors-node_modules_fluentui_react-icons-mdl2_lib_components_AddIcon_js-node_modules_fluentu-9a6f77.iframe.bundle.js:54920:16
      at jsxDecorator (http://localhost:49891/vendors-node_modules_fluentui_react-icons-mdl2_lib_components_AddIcon_js-node_modules_fluentu-9a6f77.iframe.bundle.js:48482:15)
      at http://localhost:49891/vendors-node_modules_fluentui_react-icons-mdl2_lib_components_AddIcon_js-node_modules_fluentu-9a6f77.iframe.bundle.js:53001:21
      at http://localhost:49891/vendors-node_modules_fluentui_react-icons-mdl2_lib_components_AddIcon_js-node_modules_fluentu-9a6f77.iframe.bundle.js:54884:12
      at http://localhost:49891/vendors-node_modules_fluentui_react-icons-mdl2_lib_components_AddIcon_js-node_modules_fluentu-9a6f77.iframe.bundle.js:54920:16
      at withGrid (http://localhost:49891/vendors-node_modules_fluentui_react-icons-mdl2_lib_components_AddIcon_js-node_modules_fluentu-9a6f77.iframe.bundle.js:45137:10)
      at http://localhost:49891/vendors-node_modules_fluentui_react-icons-mdl2_lib_components_AddIcon_js-node_modules_fluentu-9a6f77.iframe.bundle.js:53001:21`;

  return err;
};

export default {
  title: "components/NotificationModal",
};

export const ErrorModal = (): JSX.Element => {
  return (
    <NotificationModal
      onRequestClose={() => {}}
      notification={{
        id: "1",
        message: "Error 1",
        details: fakeError(),
        read: false,
        created: new Date(),
        severity: "error",
      }}
    />
  );
};
ErrorModal.parameters = { colorScheme: "light" };
export const ErrorModalDark = ErrorModal.bind(undefined);
ErrorModalDark.parameters = { colorScheme: "dark" };

export const Warning = (): JSX.Element => {
  return (
    <NotificationModal
      onRequestClose={() => {}}
      notification={{
        id: "1",
        message: "Warning 1",
        details: "Some error details",
        read: false,
        created: new Date(),
        severity: "warn",
      }}
    />
  );
};
Warning.parameters = { colorScheme: "dark" };

export const ErrorWithoutDetails = (): JSX.Element => {
  return (
    <NotificationModal
      onRequestClose={() => {}}
      notification={{
        id: "1",
        message: "Error 1",
        details: undefined,
        read: false,
        created: new Date(),
        severity: "error",
      }}
    />
  );
};
ErrorWithoutDetails.parameters = { colorScheme: "dark" };

export const ErrorWithJsxElementDetails = (): JSX.Element => {
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
        read: false,
        created: new Date(),
        severity: "error",
      }}
    />
  );
};
ErrorWithJsxElementDetails.parameters = { colorScheme: "light" };
export const ErrorWithJsxElementDetailsDark = ErrorWithJsxElementDetails.bind(undefined);
ErrorWithJsxElementDetailsDark.parameters = { colorScheme: "dark" };
