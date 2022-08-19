// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

declare module "text-metrics" {
  export type Options = {
    multiline?: boolean;
  };

  export type Overrides = {
    fontFamily?: string;
    fontSize?: string;
    fontWeight?: number;
    lineHeight?: string;
    width?: number;
  };

  export class TextMeasure {
    public width(text?: string, options?: Options, overrides?: Overrides): number;
    public height(text: string): number;
    public lines(text: string): string[];
    public maxFontSize(text: string): string;
  }

  function init(el?: Element | Overrides, overrides?: Overrides): TextMeasure;

  export const init;
}
