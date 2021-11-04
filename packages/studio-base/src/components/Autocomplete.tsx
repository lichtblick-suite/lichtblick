// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { makeStyles } from "@fluentui/react";
import cx from "classnames";
import { Fzf, FzfResultItem } from "fzf";
import { maxBy } from "lodash";
import React, { CSSProperties, PureComponent, RefObject, useCallback } from "react";
import ReactAutocomplete from "react-autocomplete";
import { createPortal } from "react-dom";
import textMetrics from "text-metrics";

import { colors, fonts } from "@foxglove/studio-base/util/sharedStyleConstants";

const fontFamily = fonts.SANS_SERIF;
const fontSize = "12px";
let textMeasure: textMetrics.TextMeasure;
function measureText(text: string): number {
  if (textMeasure == undefined) {
    textMeasure = textMetrics.init({ fontFamily, fontSize });
  }
  return textMeasure.width(text) + 3;
}

const ROW_HEIGHT = 24;
const MAX_ITEMS = 200;

const useStyles = makeStyles((theme) => ({
  root: {
    borderRadius: 3,
    borderTopLeftRadius: 0,
    boxShadow: theme.effects.elevation16,
    position: "fixed",
    overflow: "auto",
    background: theme.semanticColors.menuBackground,
    zIndex: 1,
    marginLeft: -6,
  },
  input: {
    background: "transparent !important",
    borderRadius: 0,
    border: "none",
    color: theme.semanticColors.inputText,
    flexGrow: 1,
    fontSize: "1rem",
    margin: 0,
    padding: 0,
    textAlign: "left",
    fontFamily: fonts.SANS_SERIF,

    "&.disabled, &[disabled]": {
      color: theme.semanticColors.disabledText,
      backgroundColor: theme.semanticColors.disabledBackground,
    },
    "&:focus": {
      outline: "none",
    },
    "&::placeholder": {
      color: theme.semanticColors.inputPlaceholderText,
    },
  },
  inputError: {
    color: `${theme.semanticColors.errorIcon} !important`,
  },
  inputPlaceholder: {
    color: theme.semanticColors.inputPlaceholderText,
  },
  item: {
    padding: 6,
    cursor: "pointer",
    minHeight: ROW_HEIGHT,
    lineHeight: ROW_HEIGHT - 10,
    overflowWrap: "break-word",
    color: theme.semanticColors.menuItemText,
    whiteSpace: "pre",
  },
  itemSelected: {
    backgroundColor: theme.semanticColors.menuItemBackgroundHovered,
  },
  itemHighlighted: {
    backgroundColor: theme.semanticColors.menuItemBackgroundHovered,
  },
}));

// <Autocomplete> is a Studio-specific autocomplete with support for things like multiple
// autocompletes that seamlessly transition into each other, e.g. when building more complex
// strings like in the Plot panel.
//
// The multiple autocompletes doesn't work super well with react-autocomplete, so we have to
// reimplement some of its behaviour to make things work properly, such as the `_ignoreBlur`
// stuff. Mostly, though, we can lean on react-autocomplete to do the heavy lifting.
//
// For future reference, the reason `<ReactAutocomplete>` (and we) has to do `_ignoreBlur`, is that
// when you select an item from the autocomplete menu by clicking, it first triggers a `blur` event
// on the `<input>`, before triggering a `click` event. If we wouldn't ignore that `blur` event,
// we'd hide the menu before the `click` event even has a chance of getting fired. So the `blur`
// event has to be ignored, and the subsequent `focus` event also has to be ignored since it's kind
// of a "false" focus event. (In our case we just don't bother with ignoring the `focus` event since
// it doesn't cause any problems.)
type AutocompleteProps<T = unknown> = {
  classes: ReturnType<typeof useStyles>;
  items: T[];
  getItemValue: (arg0: T) => string;
  getItemText: (arg0: T) => string;
  filterText?: string;
  value?: string;
  selectedItem?: T;
  onChange?: (event: React.SyntheticEvent<HTMLInputElement>, text: string) => void;
  onSelect: (text: string, item: T, autocomplete: AutocompleteImpl<T>) => void;
  onBlur?: () => void;
  hasError?: boolean;
  autocompleteKey?: string;
  placeholder?: string;
  autoSize?: boolean;
  sortWhenFiltering: boolean;
  clearOnFocus: boolean; // only for uncontrolled use (when onChange is not set)
  minWidth: number;
  menuStyle?: CSSProperties;
  inputStyle?: CSSProperties;
  disableAutoSelect?: boolean;
};

type AutocompleteState = {
  focused: boolean;
  showAllItems: boolean;
  value?: string;
};

function defaultGetText(name: string) {
  return function (item: unknown) {
    if (typeof item === "string") {
      return item;
    } else if (
      item != undefined &&
      typeof item === "object" &&
      typeof (item as { value?: string }).value === "string"
    ) {
      return (item as { value?: string }).value;
    }
    throw new Error(`you need to provide an implementation of ${name}`);
  };
}

const EMPTY_SET = new Set<number>();

function itemToFzfResult<T>(item: T): FzfResultItem<T> {
  return {
    item,
    score: 0,
    positions: EMPTY_SET,
    start: 0,
    end: 0,
  };
}

const HighlightChars = (props: { str: string; indices: Set<number> }) => {
  const chars = props.str.split("");

  const nodes = chars.map((char, i) => {
    if (props.indices.has(i)) {
      return (
        <b key={i} style={{ color: colors.HIGHLIGHT }}>
          {char}
        </b>
      );
    } else {
      return char;
    }
  });

  return <>{nodes}</>;
};

export interface IAutocomplete {
  setSelectionRange(selectionStart: number, selectionEnd: number): void;
  focus(): void;
  blur(): void;
}

class AutocompleteImpl<T = unknown>
  extends PureComponent<AutocompleteProps<T>, AutocompleteState>
  implements IAutocomplete
{
  private _autocomplete: RefObject<ReactAutocomplete>;
  private _ignoreFocus: boolean = false;
  private _ignoreBlur: boolean = false;

  static defaultProps = {
    getItemText: defaultGetText("getItemText"),
    getItemValue: defaultGetText("getItemValue"),
    sortWhenFiltering: true,
    clearOnFocus: false,
    minWidth: 100,
  };

  constructor(props: AutocompleteProps<T>) {
    super(props);
    this._autocomplete = React.createRef<ReactAutocomplete>();
    this.state = { focused: false, showAllItems: false };
  }

  // When we lose the scrollbar, we can safely set `showAllItems: false` again, because all items
  // will be in view anyway. We cannot set it to false earlier, as `<ReactAutocomplete>` may have a
  // reference to the highlighted element, which can cause an error if we hide it.
  override componentDidUpdate(): void {
    if (
      (this._autocomplete.current?.refs.menu as Element)?.scrollHeight <=
        (this._autocomplete.current?.refs.menu as Element)?.clientHeight &&
      this.state.showAllItems
    ) {
      this.setState({ showAllItems: false });
    }
  }

  setSelectionRange(selectionStart: number, selectionEnd: number): void {
    if (this._autocomplete.current?.refs.input) {
      (this._autocomplete.current.refs.input as HTMLInputElement).setSelectionRange(
        selectionStart,
        selectionEnd,
      );
    }
    this.setState({ focused: true });
  }

  focus(): void {
    if (this._autocomplete.current?.refs.input) {
      (this._autocomplete.current.refs.input as HTMLInputElement).focus();
    }
  }

  blur(): void {
    if (this._autocomplete.current?.refs.input) {
      (this._autocomplete.current.refs.input as HTMLInputElement).blur();
    }
    this._ignoreBlur = false;
    this.setState({ focused: false });
    if (this.props.onBlur) {
      this.props.onBlur();
    }
  }

  private _onFocus = (): void => {
    if (this._ignoreFocus) {
      return;
    }
    const { clearOnFocus } = this.props;
    if (
      this._autocomplete.current?.refs.input &&
      document.activeElement === this._autocomplete.current.refs.input
    ) {
      this.setState({ focused: true });
      if (clearOnFocus) {
        this.setState({ value: "" });
      }
    }
  };

  // Wait for a mouseup event, and check in the mouseup event if anything was actually selected, or
  // if it just was a click without a drag. In the latter case, select everything. This is very
  // similar to how, say, the browser bar in Chrome behaves.
  private _onMouseDown = (_event: React.MouseEvent<HTMLInputElement>): void => {
    if (this.props.disableAutoSelect ?? false) {
      return;
    }
    if (this.state.focused) {
      return;
    }
    const onMouseUp = (e: MouseEvent) => {
      document.removeEventListener("mouseup", onMouseUp, true);

      if (
        this._autocomplete.current?.refs.input && // Make sure that the element is actually still focused.
        document.activeElement === this._autocomplete.current.refs.input
      ) {
        if (
          (this._autocomplete.current.refs.input as HTMLInputElement).selectionStart ===
          (this._autocomplete.current.refs.input as HTMLInputElement).selectionEnd
        ) {
          (this._autocomplete.current.refs.input as HTMLInputElement).select();
          e.stopPropagation();
          e.preventDefault();
        }
        // Also set `state.focused` for good measure, since we know here that we're focused.
        this.setState({ focused: true });
      }
    };
    document.addEventListener("mouseup", onMouseUp, true);
  };

  private _onBlur = (): void => {
    if (this._ignoreBlur) {
      return;
    }
    if (
      this._autocomplete.current?.refs.input &&
      document.activeElement === this._autocomplete.current.refs.input
    ) {
      // Bail if we actually still are focused.
      return;
    }
    this.setState({ focused: false, value: undefined });
    if (this.props.onBlur) {
      this.props.onBlur();
    }
  };

  private _onChange = (event: React.SyntheticEvent<HTMLInputElement>): void => {
    if (this.props.onChange) {
      this.props.onChange(event, (event.target as HTMLInputElement).value);
    } else {
      this.setState({ value: (event.target as HTMLInputElement).value });
    }
  };

  // Make sure the input field gets focused again after selecting, in case we're doing multiple
  // autocompletes. We pass in `this` to `onSelect` in case the user of this component wants to call
  // `blur()`.
  private _onSelect = (value: string, item: FzfResultItem<T>): void => {
    if (this._autocomplete.current?.refs.input) {
      (this._autocomplete.current.refs.input as HTMLInputElement).focus();
      this.setState({ focused: true, value: undefined }, () => {
        this.props.onSelect(value, item.item, this);
      });
    }
  };

  // When scrolling down by even a little bit, just show all items. In most cases people won't
  // do this and instead will type more text to narrow down their autocomplete.
  private _onScroll = (event: React.MouseEvent<HTMLDivElement>): void => {
    if (event.currentTarget.scrollTop > 0) {
      // Never set `showAllItems` to false here, as `<ReactAutocomplete>` may have a reference to
      // the highlighted element. We only set it back to false in `componentDidUpdate`.
      this.setState({ showAllItems: true });
    }
  };

  private _onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "Escape" || (event.key === "Enter" && this.props.items.length === 0)) {
      this.blur();
    }
  };

  override render(): JSX.Element {
    const {
      classes,
      autocompleteKey,
      autoSize = false,
      getItemValue,
      getItemText,
      items,
      placeholder,
      selectedItem,
      value = this.state.value ?? (selectedItem ? getItemText(selectedItem) : undefined),
      filterText = value,
      sortWhenFiltering,
      minWidth,
      menuStyle = {},
      inputStyle = {},
    } = this.props;
    const autocompleteItems: FzfResultItem<T>[] = filterText
      ? new Fzf(items, {
          fuzzy: filterText.length > 2 ? "v2" : false,
          sort: sortWhenFiltering,
          limit: MAX_ITEMS,
          selector: getItemText as (_: unknown) => string, // Fzf selector TS type seems to be wrong?
        }).find(filterText)
      : items.map((item) => itemToFzfResult(item));

    const { hasError = autocompleteItems.length === 0 && value?.length } = this.props;

    const open = this.state.focused && autocompleteItems.length > 0;
    if (!open) {
      this._ignoreBlur = false;
    }

    const selectedItemValue = selectedItem != undefined ? getItemValue(selectedItem) : undefined;
    return (
      <ReactAutocomplete
        open={open}
        items={autocompleteItems}
        getItemValue={(item: FzfResultItem<T>) => getItemValue(item.item)}
        renderItem={(item: FzfResultItem<T>, isHighlighted) => {
          const itemValue = getItemValue(item.item);
          return (
            <div
              key={itemValue}
              data-highlighted={isHighlighted}
              data-test-auto-item
              className={cx(classes.item, {
                [classes.itemHighlighted]: isHighlighted,
                [classes.itemSelected]:
                  selectedItemValue != undefined && itemValue === selectedItemValue,
              })}
            >
              <HighlightChars str={getItemText(item.item)} indices={item.positions} />
            </div>
          );
        }}
        onChange={this._onChange}
        onSelect={this._onSelect}
        value={value ?? ""}
        inputProps={{
          className: cx(classes.input, {
            [classes.inputError]: hasError,
            [classes.inputPlaceholder]: value == undefined || value.length === 0,
          }),
          autoCorrect: "off",
          autoCapitalize: "off",
          spellCheck: "false",
          placeholder,
          style: {
            ...inputStyle,
            fontFamily,
            fontSize,
            width: autoSize
              ? Math.max(
                  measureText(value != undefined && value.length > 0 ? value : placeholder ?? ""),
                  minWidth,
                )
              : "100%",
          },
          onFocus: this._onFocus,
          onBlur: this._onBlur,
          onMouseDown: this._onMouseDown,
          onKeyDown: this._onKeyDown,
        }}
        renderMenu={(menuItems, _val, style) => {
          // Hacky virtualization. Either don't show all menuItems (typical when the user is still
          // typing in the autcomplete), or do show them all (once the user scrolls). Not the most
          // sophisticated, but good enough!
          const maxNumberOfItems = Math.ceil(window.innerHeight / ROW_HEIGHT + 10);
          const menuItemsToShow =
            this.state.showAllItems || menuItems.length <= maxNumberOfItems * 2
              ? menuItems
              : menuItems.slice(0, maxNumberOfItems).concat(menuItems.slice(-maxNumberOfItems));

          // The longest string might not be the widest (e.g. "|||" vs "www"), but this is
          // quite a bit faster, so we throw in a nice padding and call it good enough! :-)
          const longestItem = maxBy(autocompleteItems, (item) => getItemText(item.item).length);
          const width =
            50 + (longestItem != undefined ? measureText(getItemText(longestItem.item)) : 0);
          const maxHeight = `calc(100vh - 10px - ${style.top}px)`;

          return (
            <div
              className={classes.root}
              key={
                autocompleteKey
                /* So we scroll to the top when selecting */
              }
              style={
                // If the autocomplete would fall off the screen, pin it to the right.
                (style.left as number) + width <= window.innerWidth
                  ? { ...menuStyle, ...style, width, maxWidth: "100%", maxHeight }
                  : {
                      ...menuStyle,
                      ...style,
                      width,
                      maxWidth: "100%",
                      maxHeight,
                      left: "auto",
                      right: 0,
                    }
              }
              onScroll={this._onScroll}
            >
              {/* Have to wrap onMouseEnter and onMouseLeave in a separate <div>, as react-autocomplete
               * would override them on the root <div>. */}
              <div
                onMouseEnter={() => (this._ignoreBlur = true)}
                onMouseLeave={() => (this._ignoreBlur = false)}
              >
                {menuItemsToShow}
              </div>
            </div>
          );
        }}
        // @ts-expect-error renderMenuWrapper added in the fork but we don't have typings for it
        renderMenuWrapper={(menu: React.ReactNode) => createPortal(menu, document.body)}
        ref={this._autocomplete}
        wrapperStyle={{ flex: "1 1 auto", overflow: "hidden", marginLeft: 6 }}
      />
    );
  }
}

export default React.forwardRef((props, ref) => {
  const classes = useStyles();
  const mapRef = useCallback(
    (autocomplete: IAutocomplete | ReactNull) => {
      if (typeof ref === "function") {
        ref(autocomplete);
      } else if (ref != undefined) {
        ref.current = autocomplete;
      }
    },
    [ref],
  );
  return <AutocompleteImpl {...props} ref={mapRef} classes={classes} />;
}) as <T>(
  props: JSX.LibraryManagedAttributes<
    typeof AutocompleteImpl,
    Omit<AutocompleteProps<T>, "classes">
  > &
    React.RefAttributes<IAutocomplete>,
) => React.ReactElement;
