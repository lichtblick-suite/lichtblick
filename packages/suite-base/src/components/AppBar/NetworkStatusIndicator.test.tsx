/** @jest-environment jsdom */
// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { render } from "@testing-library/react";
import { useNetworkState } from "react-use";

import { NetworkStatusIndicator } from "@lichtblick/suite-base/components/AppBar/NetworkStatusIndicator";
import BasicBuilder from "@lichtblick/suite-base/testing/builders/BasicBuilder";

const API_URL = "https://api.test.com";
let mockApiUrl: string | undefined = API_URL;

jest.mock("react-use", () => ({
  useNetworkState: jest.fn(),
}));

jest.mock("@lichtblick/suite-base/constants/config", () => ({
  APP_CONFIG: {
    // eslint-disable-next-line no-restricted-syntax
    get apiUrl() {
      return mockApiUrl;
    },
  },
}));

const setMockApiUrl = (url: string | undefined) => {
  mockApiUrl = url;
};

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: jest.fn(),
  }),
}));

describe("NetworkStatusIndicator", () => {
  const originalLocation = window.location;
  const originalURL = global.URL;

  beforeEach(() => {
    setMockApiUrl(API_URL);
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete (window as any).location;
    (window as any).location = originalLocation;
    global.URL = originalURL;
  });

  const mockURL = (href: string): void => {
    global.URL = jest.fn().mockImplementation((url: string) => {
      if (url === window.location.href || url === href) {
        const realUrl = new originalURL(href);
        return realUrl;
      }
      return new originalURL(url);
    }) as any;
  };

  it("should not render when no workspace parameter is present", () => {
    mockURL(API_URL);
    (useNetworkState as jest.Mock).mockReturnValue({ online: true });

    const { container } = render(<NetworkStatusIndicator />);

    expect(container.firstChild).toBeNull();
  });

  it("should not render when online", () => {
    const url = `${API_URL}/?workspace=${BasicBuilder.string()}`;
    mockURL(url);
    (useNetworkState as jest.Mock).mockReturnValue({ online: true });

    const { container } = render(<NetworkStatusIndicator />);

    expect(container.firstChild).toBeNull();
  });

  it("should render when offline", () => {
    const url = `${API_URL}/?workspace=${BasicBuilder.string()}`;
    mockURL(url);
    (useNetworkState as jest.Mock).mockReturnValue({ online: false });

    const { container } = render(<NetworkStatusIndicator />);

    expect(container.firstChild).not.toBeNull();
  });
});
