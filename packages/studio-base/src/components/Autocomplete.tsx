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

import {
  MenuItem,
  Autocomplete as MuiAutocomplete,
  TextField,
  TextFieldProps,
  alpha,
} from "@mui/material";
import { Fzf, FzfResultItem } from "fzf";
import * as React from "react";
import {
  CSSProperties,
  SyntheticEvent,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { useResizeDetector } from "react-resize-detector";
import { makeStyles } from "tss-react/mui";

import { HighlightChars } from "@foxglove/studio-base/components/HighlightChars";
import { ReactWindowListboxAdapter } from "@foxglove/studio-base/components/ReactWindowListboxAdapter";

const MAX_FZF_MATCHES = 200;

// Above this number of items we fall back to the faster fuzzy find algorithm.
const FAST_FIND_ITEM_CUTOFF = 1_000;

type AutocompleteProps<T> = {
  className?: string;
  autoSize?: boolean;
  disableAutoSelect?: boolean;
  disabled?: boolean;
  filterText?: string;
  getItemText?: (item: T) => string;
  getItemValue?: (item: T) => string;
  hasError?: boolean;
  inputStyle?: CSSProperties;
  items: readonly T[];
  menuStyle?: CSSProperties;
  minWidth?: number;
  onBlur?: () => void;
  onChange?: (event: React.SyntheticEvent, text: string) => void;
  onSelect: (value: string | T, autocomplete: IAutocomplete) => void;
  placeholder?: string;
  readOnly?: boolean;
  selectedItem?: T;
  selectOnFocus?: boolean;
  sortWhenFiltering?: boolean;
  value?: string;
  variant?: TextFieldProps["variant"];
};

export interface IAutocomplete {
  setSelectionRange(selectionStart: number, selectionEnd: number): void;
  focus(): void;
  blur(): void;
}

const useStyles = makeStyles()((theme) => ({
  inputError: {
    input: {
      color: theme.palette.error.main,
    },
  },
  item: {
    padding: 6,
    cursor: "pointer",
    minHeight: "100%",
    lineHeight: "calc(100% - 10px)",
    overflowWrap: "break-word",
    color: theme.palette.text.primary,

    // re-establish the <mark /> styles because the autocomplete is in a Portal
    mark: {
      backgroundColor: "transparent",
      color: theme.palette.info.main,
      fontWeight: 700,
    },
  },
  itemSelected: {
    backgroundColor: alpha(
      theme.palette.primary.main,
      theme.palette.action.selectedOpacity + theme.palette.action.hoverOpacity,
    ),
  },
  itemHighlighted: {
    backgroundColor: theme.palette.action.hover,
  },
}));

function defaultGetText(name: string): (item: unknown) => string {
  return function (item: unknown) {
    if (typeof item === "string") {
      return item;
    } else if (
      item != undefined &&
      typeof item === "object" &&
      typeof (item as { value?: string }).value === "string"
    ) {
      return (item as { value: string }).value;
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

/**
 * <Autocomplete> is a Studio-specific wrapper of MUI autocomplete with support
 * for things like multiple autocompletes that seamlessly transition into each
 * other, e.g. when building more complex strings like in the Plot panel.
 */
export default React.forwardRef(function Autocomplete<T = unknown>(
  props: AutocompleteProps<T>,
  ref: React.ForwardedRef<IAutocomplete>,
): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(ReactNull);

  const { classes, cx } = useStyles();

  const [stateValue, setValue] = useState<string | undefined>(undefined);

  const getItemText = useMemo(
    () => props.getItemText ?? defaultGetText("getItemText"),
    [props.getItemText],
  );

  const getItemValue = useMemo(
    () => props.getItemValue ?? defaultGetText("getItemValue"),
    [props.getItemValue],
  );

  // Props
  const {
    className,
    selectedItem,
    // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
    value = stateValue ?? (selectedItem ? getItemText(selectedItem) : undefined),
    disabled,
    filterText = value ?? "",
    items,
    onBlur: onBlurCallback,
    onChange: onChangeCallback,
    onSelect: onSelectCallback,
    placeholder,
    readOnly,
    selectOnFocus,
    sortWhenFiltering = true,
    variant = "filled",
  }: AutocompleteProps<T> = props;

  const fzfUnfiltered = useMemo(() => {
    return items.map((item) => itemToFzfResult(item));
  }, [items]);

  const fzf = useMemo(() => {
    // @ts-expect-error Fzf selector TS type seems to be wrong?
    return new Fzf(items, {
      // v1 algorithm is significantly faster on long lists of items.
      fuzzy: items.length > FAST_FIND_ITEM_CUTOFF ? "v1" : "v2",
      sort: sortWhenFiltering,
      limit: MAX_FZF_MATCHES,
      selector: getItemText,
    });
  }, [getItemText, items, sortWhenFiltering]);

  const autocompleteItems: FzfResultItem<T>[] = useMemo(() => {
    return filterText ? fzf.find(filterText) : fzfUnfiltered;
  }, [filterText, fzf, fzfUnfiltered]);

  const hasError = Boolean(props.hasError ?? (autocompleteItems.length === 0 && value?.length));

  const selectedItemValue = selectedItem != undefined ? getItemValue(selectedItem) : undefined;
  const setSelectionRange = useCallback((selectionStart: number, selectionEnd: number): void => {
    inputRef.current?.focus();
    inputRef.current?.setSelectionRange(selectionStart, selectionEnd);
  }, []);

  const focus = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  const blur = useCallback(() => {
    inputRef.current?.blur();
    onBlurCallback?.();
  }, [onBlurCallback]);

  // Give callers an opportunity to control autocomplete
  useImperativeHandle(ref, () => ({ setSelectionRange, focus, blur }), [
    setSelectionRange,
    focus,
    blur,
  ]);

  const onChange = useCallback(
    (_event: ReactNull | React.SyntheticEvent, newValue: string): void => {
      if (onChangeCallback) {
        if (_event) {
          onChangeCallback(_event, newValue);
        }
      } else {
        setValue(newValue);
      }
    },
    [onChangeCallback],
  );

  // To allow multiple completions in sequence, it's up to the parent component
  // to manually blur the input to finish a completion.
  const onSelect = useCallback(
    (_event: SyntheticEvent, selectedValue: ReactNull | string | FzfResultItem<T>): void => {
      if (selectedValue != undefined && typeof selectedValue !== "string") {
        setValue(undefined);
        onSelectCallback(selectedValue.item, { setSelectionRange, focus, blur });
      }
    },
    [onSelectCallback, blur, focus, setSelectionRange],
  );

  // Blur the input on resize to prevent misalignment of the input field and the
  // autocomplete listbox. Debounce to prevent resize observer loop limit errors.
  useResizeDetector<HTMLInputElement>({
    handleHeight: false,
    onResize: () => inputRef.current?.blur(),
    refreshMode: "debounce",
    refreshRate: 0,
    skipOnMount: true,
    targetRef: inputRef,
  });

  // Don't filter out options here because we assume that the parent
  // component has already filtered them. This allows completing fragments.
  const filterOptions = useCallback((options: FzfResultItem<T>[]) => options, []);

  return (
    <MuiAutocomplete
      className={className}
      componentsProps={{
        paper: { elevation: 8 },
      }}
      disableCloseOnSelect
      disabled={disabled}
      freeSolo
      fullWidth
      getOptionLabel={(item: string | FzfResultItem<T>) => {
        if (typeof item === "string") {
          return item;
        }
        return getItemValue(item.item);
      }}
      filterOptions={filterOptions}
      ListboxComponent={ReactWindowListboxAdapter}
      onChange={onSelect}
      onInputChange={onChange}
      openOnFocus
      options={autocompleteItems}
      readOnly={readOnly}
      renderInput={(params) => (
        <TextField
          {...params}
          variant={variant}
          inputRef={inputRef}
          data-testid="autocomplete-textfield"
          placeholder={placeholder}
          className={cx({ [classes.inputError]: hasError })}
          size="small"
        />
      )}
      renderOption={(optProps, item: FzfResultItem<T>, { selected }) => {
        const itemValue = getItemValue(item.item);
        return (
          <MenuItem
            dense
            {...optProps}
            key={itemValue}
            component="span"
            data-highlighted={selected}
            data-testid="autocomplete-item"
            className={cx(classes.item, {
              [classes.itemHighlighted]: selected,
              [classes.itemSelected]:
                selectedItemValue != undefined && itemValue === selectedItemValue,
            })}
          >
            <HighlightChars str={getItemText(item.item)} indices={item.positions} />
          </MenuItem>
        );
      }}
      selectOnFocus={selectOnFocus}
      size="small"
      value={value ?? ReactNull}
    />
  );
}) as <T>(props: AutocompleteProps<T> & React.RefAttributes<IAutocomplete>) => JSX.Element; // https://stackoverflow.com/a/58473012/23649
