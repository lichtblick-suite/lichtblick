// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import * as _ from "lodash-es";
import randomString from "randomstring";

import {
  NumberBuilder,
  StringBuilder,
  Capitalization,
  MapBuilder,
  SamplePropertyKey,
} from "@lichtblick/suite-base/testing/builders/types";
import { defaults } from "@lichtblick/suite-base/testing/builders/utilities";

export default class BasicBuilder {
  public static date(
    props: Partial<{
      year: number;
      month: string;
      day: string;
      hours: string;
      minutes: string;
      seconds: string;
    }> = {},
  ): string {
    const { year, month, day, hours, minutes, seconds } = defaults(props, {
      year: BasicBuilder.number({ min: 2000, max: 2021 }),
      month: BasicBuilder.number({ min: 1, max: 12 }).toString().padStart(2, "0"),
      day: BasicBuilder.number({ min: 1, max: 28 }).toString().padStart(2, "0"),
      hours: BasicBuilder.number({ min: 0, max: 23 }).toString().padStart(2, "0"),
      minutes: BasicBuilder.number({ min: 0, max: 59 }).toString().padStart(2, "0"),
      seconds: BasicBuilder.number({ min: 0, max: 59 }).toString().padStart(2, "0"),
    });

    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.926536Z`;
  }

  public static boolean(): boolean {
    return Boolean(_.random(0, 1));
  }

  public static number({ min = 1, max = 20 }: Partial<NumberBuilder> = {}): number {
    return _.random(min, max);
  }

  public static float(min = 1, max = 20): number {
    return _.random(min, max, true);
  }

  public static bigInt(min: bigint = 1n, max: bigint = 20n): bigint {
    const range = max - min + 1n;
    const randomBigInt = BigInt(Math.floor(Math.random() * Number(range)));
    return min + randomBigInt;
  }

  public static string({
    length = 6,
    charset = "alphabetic",
    capitalization,
  }: Partial<StringBuilder> = {}): string {
    let casingFunction = (input: string) => input;
    if (capitalization != undefined) {
      casingFunction = {
        [Capitalization.UPPERCASE]: _.toUpper,
        [Capitalization.LOWERCASE]: _.toLower,
      }[capitalization];
    }

    return casingFunction(
      randomString.generate({
        length,
        charset,
      }),
    );
  }

  public static stringMap({
    count = 3,
    length = 6,
    charset = "alphabetic",
    capitalization,
  }: Partial<MapBuilder> = {}): Map<string, string> {
    const entries: [string, string][] = BasicBuilder.multiple(
      () => [
        BasicBuilder.string({ length, charset, capitalization }),
        BasicBuilder.string({ length, charset, capitalization }),
      ],
      count,
    );

    return new Map(entries);
  }

  public static genericMap<T>(
    valueGenerator: () => T,
    { count = 3, length = 6, charset = "alphabetic", capitalization }: Partial<MapBuilder> = {},
  ): Map<string, T> {
    const entries: [string, T][] = BasicBuilder.multiple(
      () => [BasicBuilder.string({ length, charset, capitalization }), valueGenerator()],
      count,
    );

    return new Map(entries);
  }

  public static genericDictionary<T>(
    valueGenerator: () => T,
    { count = 3, length = 6, charset = "alphabetic", capitalization }: Partial<MapBuilder> = {},
  ): Record<string, T> {
    return _.fromPairs(
      BasicBuilder.multiple(
        () => [BasicBuilder.string({ length, charset, capitalization }), valueGenerator()],
        count,
      ),
    );
  }

  public static multiple<T>(factory: () => T, count = 3): T[] {
    return _.map(new Array(count), factory);
  }

  public static numbers(count = 3): number[] {
    return BasicBuilder.multiple(BasicBuilder.number, count);
  }

  public static strings({
    count = 3,
    length = 6,
    charset = "alphabetic",
    capitalization = undefined,
  }: Partial<
    {
      count: number;
    } & StringBuilder
  > = {}): string[] {
    return BasicBuilder.multiple(
      () => BasicBuilder.string({ length, charset, capitalization }),
      count,
    );
  }

  public static sample<T>(input: T[]): T;
  public static sample<T extends SamplePropertyKey, K>(
    input: Record<T, K> | K[],
    count: number,
  ): K[];
  public static sample<T extends SamplePropertyKey, K>(input: Record<T, K> | K[]): K;
  public static sample<T extends SamplePropertyKey, K>(
    input: Record<T, K> | K[],
    count?: number,
  ): K | K[] {
    return count == undefined ? _.sample(input)! : _.sampleSize(input, count);
  }
}
