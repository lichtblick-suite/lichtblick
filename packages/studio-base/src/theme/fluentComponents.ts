// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  PartialTheme,
  IColorPickerStyles,
  IComboBoxStyles,
  IContextualMenuItemStyles,
  IContextualMenuStyles,
  IDetailsRowProps,
  IDetailsRowStyles,
  ILayerStyles,
  IModalStyles,
  IOverlayStyles,
  ITextFieldStyles,
  IToggleStyles,
  ITooltipStyleProps,
  ITooltipStyles,
} from "@fluentui/react";

const fluentComponents: PartialTheme["components"] = {
  ColorPicker: {
    styles: {
      root: { maxWidth: 250 },
      colorRectangle: { minWidth: 100, minHeight: 100 },
      table: {
        // We need to remove table styles from global.scss, but for now, changing them
        // to e.g. "#root td" messes with the styling in various places because the
        // selector becomes more specific. So for now, just disable them directly here.
        "tr, th, td, tr:hover th, tr:hover td": {
          border: "none",
          background: "none",
          cursor: "unset",
        },
      },
    } as IColorPickerStyles,
  },
  ContextualMenu: {
    styles: {
      subComponentStyles: {
        menuItem: {
          // Improve menu item icon/text alignment - this may not be necessary if we choose a
          // different font in the future.
          icon: {
            marginTop: -4,
          },
        } as Partial<IContextualMenuItemStyles>,
      },
    } as IContextualMenuStyles,
  },
  DetailsRow: {
    styles: ({ theme }: IDetailsRowProps): Partial<IDetailsRowStyles> => ({
      root: {
        borderBottom: `1px solid ${theme?.semanticColors.bodyDivider} !important`,
      },
    }),
  },
  Overlay: {
    styles: {
      root: {
        "-webkit-app-region": "drag",
      },
    } as Partial<IOverlayStyles>,
  },
  Modal: {
    styles: {
      main: {
        "-webkit-app-region": "no-drag",
        minHeight: "unset",
      },
    } as Partial<IModalStyles>,
  },
  ComboBox: {
    // Style hacks that can be removed when we eventually clean up our global styles from global.scss
    // which currently has margin: $control-margin;
    styles: {
      input: {
        margin: 0,
      },
      root: {
        ".ms-ComboBox-CaretDown-button": {
          margin: 0,
        },
      },
    } as Partial<IComboBoxStyles>,
  },
  TextField: {
    styles: {
      field: {
        "::placeholder": {
          opacity: 0.6,
        },
        ":focus::placeholder": {
          opacity: 0,
        },
      },
    } as Partial<ITextFieldStyles>,
  },
  Tooltip: {
    styles: ({ theme }: ITooltipStyleProps): Partial<ITooltipStyles> => ({
      root: {
        padding: 6,
        background: theme.palette.neutralLighter,
      },
      content: {
        background: theme.palette.neutralLighter,
        color: theme.palette.neutralDark,
      },
    }),
  },
  // Prevent Layer from overriding root styles - similar to `applyTo="none"` on ThemeProvider.
  // https://github.com/microsoft/fluentui/issues/17701
  Layer: {
    styles: {
      root: {
        fontFamily: "",
        WebkitFontSmoothing: "",
        fontSize: "",
        fontWeight: "",
        color: "",
      },
      content: {
        fontFamily: "",
        WebkitFontSmoothing: "",
        fontSize: "",
        fontWeight: "",
        color: "",
      },
    } as ILayerStyles,
  },
  Toggle: {
    styles: {
      container: {
        alignItems: "baseline",
      },
    } as IToggleStyles,
  },
};

export default fluentComponents;
