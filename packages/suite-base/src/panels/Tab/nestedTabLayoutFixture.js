// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
const nestedTabLayoutFixture = {
    topics: [],
    datatypes: new Map(),
    frame: {},
    layout: {
        direction: "column",
        first: {
            direction: "row",
            first: "Tab!Left",
            second: "Tab!Right",
            splitPercentage: 50,
        },
        second: "Tab!Bottom",
        splitPercentage: 75,
    },
    savedProps: {
        "Tab!RightInner": {
            activeTabIdx: 1,
            tabs: [
                {
                    title: "Inactive Plots",
                    layout: undefined,
                },
                {
                    title: "Child Plots",
                    layout: {
                        first: {
                            first: "Audio!A",
                            second: "Audio!B",
                            direction: "column",
                        },
                        second: {
                            first: "Audio!C",
                            second: "Audio!D",
                            direction: "column",
                        },
                        direction: "row",
                    },
                },
            ],
        },
        "Tab!Left": {
            activeTabIdx: 0,
            tabs: [
                {
                    title: "Left",
                    layout: {
                        first: "Global!A",
                        second: {
                            first: "Foo!A",
                            second: {
                                first: "Foo!B",
                                second: "Foo!C",
                                direction: "row",
                                splitPercentage: 50,
                            },
                            direction: "row",
                            splitPercentage: 33.3,
                        },
                        direction: "column",
                        splitPercentage: 75,
                    },
                },
            ],
        },
        "Tab!Right": {
            activeTabIdx: 0,
            tabs: [
                {
                    title: "Right",
                    layout: "Tab!RightInner",
                },
            ],
        },
        "Tab!Bottom": {
            activeTabIdx: 0,
            tabs: [
                {
                    title: "Bottom",
                    layout: "GlobalVariableSliderPanel!A",
                },
            ],
        },
    },
};
const nestedTabLayoutFixture2 = {
    topics: [],
    datatypes: new Map(),
    frame: {},
    layout: {
        direction: "row",
        splitPercentage: 20,
        first: "Sample1",
        second: {
            direction: "row",
            splitPercentage: 20,
            first: "unknown!2",
            second: {
                direction: "column",
                splitPercentage: 20,
                first: "unknown!3",
                second: "Tab!a",
            },
        },
    },
    savedProps: {
        "Tab!a": {
            activeTabIdx: 0,
            tabs: [
                {
                    title: "First",
                    layout: {
                        direction: "column",
                        splitPercentage: 20,
                        first: "unknown!inner1",
                        second: {
                            direction: "column",
                            splitPercentage: 20,
                            first: "unknown!inner2",
                            second: {
                                direction: "row",
                                splitPercentage: 20,
                                first: "unknown!inner3",
                                second: "Tab!b",
                            },
                        },
                    },
                },
            ],
        },
        "Tab!b": {
            activeTabIdx: 0,
            tabs: [
                {
                    title: "First inner",
                    layout: {
                        direction: "column",
                        splitPercentage: 50,
                        first: "unknown!inner4",
                        second: "unknown!inner5",
                    },
                },
            ],
        },
    },
};
export { nestedTabLayoutFixture, nestedTabLayoutFixture2 };
