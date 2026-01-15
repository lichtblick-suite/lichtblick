// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { TextFieldProps } from "@mui/material";
import { CSSProperties } from "react";

export type AutocompleteProps = {
  className?: string;
  disableAutoSelect?: boolean;
  disabled?: boolean;
  filterText?: string;
  hasError?: boolean;
  inputStyle?: CSSProperties;
  items: readonly string[];
  menuStyle?: CSSProperties;
  minWidth?: number;
  onBlur?: () => void;
  onChange?: (event: React.SyntheticEvent, text: string) => void;
  onSelect: (value: string, autocomplete: IAutocomplete) => void;
  placeholder?: string;
  readOnly?: boolean;
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
