// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

declare module "@foxglove/studio" {
  type ExtensionPanelRegistration = {
    // Unique name of the panel within your extension
    //
    // NOTE: Panel names within your extension must be unique. The panel name identifies this panel
    // within a layout. Changing the panel name will cause layouts using the old name unable to load
    // your panel.
    name: string;

    // Panel component
    component: () => JSX.Element;
  };

  interface ExtensionContext {
    readonly extensionMode: "production" | "development" | "test";

    registerPanel(params: ExtensionPanelRegistration): void;
  }

  interface ExtensionActivate {
    (extensionContext: ExtensionContext): void;
  }

  // ExtensionModule describes the interface your extension entry level module must export
  // as its default export
  interface ExtensionModule {
    activate: ExtensionActivate;
  }
}
