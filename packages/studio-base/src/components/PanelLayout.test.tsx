/** @jest-environment jsdom */
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { render, waitFor } from "@testing-library/react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

import Panel from "@foxglove/studio-base/components/Panel";
import PanelCatalogContext, {
  PanelCatalog,
  PanelInfo,
} from "@foxglove/studio-base/context/PanelCatalogContext";
import MockCurrentLayoutProvider from "@foxglove/studio-base/providers/CurrentLayoutProvider/MockCurrentLayoutProvider";
import { PanelStateContextProvider } from "@foxglove/studio-base/providers/PanelStateContextProvider";

import { UnconnectedPanelLayout } from "./PanelLayout";

class MockPanelCatalog implements PanelCatalog {
  public constructor(private allPanels: PanelInfo[]) {}
  public getPanels(): readonly PanelInfo[] {
    return this.allPanels;
  }
  public getPanelByType(type: string): PanelInfo | undefined {
    return this.allPanels.find((panel) => !panel.config && panel.type === type);
  }
}

describe("UnconnectedPanelLayout", () => {
  it("does not remount panels when changing split percentage", async () => {
    const renderA = jest.fn().mockReturnValue(<>A</>);
    const moduleA = jest.fn().mockResolvedValue({
      default: Panel(Object.assign(renderA, { panelType: "a", defaultConfig: {} })),
    });

    const renderB = jest.fn().mockReturnValue(<>B</>);
    const moduleB = jest.fn().mockResolvedValue({
      default: Panel(Object.assign(renderB, { panelType: "b", defaultConfig: {} })),
    });

    const renderC = jest.fn().mockReturnValue(<>C</>);
    const moduleC = jest.fn().mockResolvedValue({
      default: Panel(Object.assign(renderC, { panelType: "c", defaultConfig: {} })),
    });

    const panels: PanelInfo[] = [
      { title: "A", type: "a", module: moduleA },
      { title: "B", type: "b", module: moduleB },
      { title: "C", type: "c", module: moduleC },
    ];

    const panelCatalog = new MockPanelCatalog(panels);

    const onChange = () => {
      throw new Error("unexpected call to onChange");
    };
    const { rerender, unmount } = render(
      <UnconnectedPanelLayout
        layout={{ first: "a", second: "b", direction: "row", splitPercentage: 50 }}
        onChange={onChange}
      />,
      {
        wrapper: function Wrapper({ children }: React.PropsWithChildren<unknown>) {
          return (
            <DndProvider backend={HTML5Backend}>
              <MockCurrentLayoutProvider>
                <PanelStateContextProvider>
                  <PanelCatalogContext.Provider value={panelCatalog}>
                    {children}
                  </PanelCatalogContext.Provider>
                </PanelStateContextProvider>
              </MockCurrentLayoutProvider>
            </DndProvider>
          );
        },
      },
    );

    await waitFor(() => expect(renderA).toHaveBeenCalled());
    // Each panel module should have only been loaded once
    expect(moduleA).toHaveBeenCalledTimes(1);
    expect(moduleB).toHaveBeenCalledTimes(1);
    expect(moduleC).toHaveBeenCalledTimes(0);
    expect(renderA).toHaveBeenCalledTimes(4);
    expect(renderB).toHaveBeenCalledTimes(4);
    expect(renderC).toHaveBeenCalledTimes(0);

    rerender(
      <UnconnectedPanelLayout
        layout={{ first: "a", second: "c", direction: "row", splitPercentage: 40 }}
        onChange={onChange}
      />,
    );
    await waitFor(() => expect(renderC).toHaveBeenCalledTimes(4));
    // Each panel module should have only been loaded once; panels A and B should not render again
    expect(moduleA).toHaveBeenCalledTimes(1);
    expect(moduleB).toHaveBeenCalledTimes(1);
    expect(moduleC).toHaveBeenCalledTimes(1);
    expect(renderA).toHaveBeenCalledTimes(4);
    expect(renderB).toHaveBeenCalledTimes(4);
    expect(renderC).toHaveBeenCalledTimes(4);

    unmount();
  });
});
