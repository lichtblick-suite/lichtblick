// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { screen, userEvent } from "@storybook/testing-library";
import { PropsWithChildren, useEffect, useState } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

import { AppSetting } from "@foxglove/studio-base/AppSetting";
import Stack from "@foxglove/studio-base/components/Stack";
import { useAppConfigurationValue } from "@foxglove/studio-base/hooks";

import Sidebars, { SidebarItem } from ".";
import { NewSidebarItem } from "./NewSidebar";

export default {
  title: "components/NewSidebar",
  component: Sidebars,
  parameters: {
    colorScheme: "both-column",
  },
};

const longText =
  "Max Polzin is a PhD Student at École Polytechnique Fédérale de Lausanne (EPFL)’s Computational Robotics Design and Fabrication Lab, where he focuses on developing novel robots with real-world applications in extreme environments like boreal forests, mountainous slopes or polar glaciers. In addition to his research, Max is dedicated to making the development of advanced robotics more accessible and to promoting robotics software engineering best practices in academic environments. Tell us a little bit about yourself, and how you first became interested in robotics. After finishing my undergraduate degree in telecommunications, I wanted to build things that moved for a change, and thus enrolled in a robotics master program at ETH Zurich . While I learned a lot about the theory of robotics – like how robots require sensors, processors and actuators to function in the world – what I didn’t learn was how to turn an idea, a research concept, or an academic prototype into a product. To learn what it takes to bring a robot from idea to reality, I joined Seervision, a young ETH Zurich spin-off dedicated to developing and selling autonomous cameras. We started as a team of three fresh graduates, with little knowledge about how to make and sell robots. It is an understatement when I say we underestimated how many lessons lay ahead of us. Over the next several years, we got a crash course on real-world robotics development. We learned how to modify and adjust our robots to meet our customer’s needs. As our team grew, we also had to find the right developer tools and adopt modern software development best practices to help us continue building robots at scale. After my experience at Seervision, returning to academia and embarking on a PhD journey was not an easy choice to make. However, in the end, I chose to join EPFL’s newly established CREATE Lab, where I could merge my passions for robots and the outdoors and focus on developing novel robots with applications in extreme environments. What robotics projects are you working on now? As a PhD student, I am dedicated to enhancing the capabilities of robots in unpredictable and complex natural environments. By developing versatile robotic systems equipped with state-of-the-art sensors, advanced control algorithms, and smart design, I aim to tackle tasks that have previously been beyond the reach of both robots and humans. Max Polzin The robot that you see above was built for the project ”Modelling Spatio-temporal Transformations of Glacial Moulins” in collaboration with the Swiss Polar Institute. It rappels itself into moulins – large open holes on a glacier, formed by surface meltwater draining through the ice sheet to the glacier’s rock bed – to explore their geometry. By capturing these measurements, we can foresee the influence of increased surface water melting, due to a changing climate, on the flow velocity of the worlds’ glaciers. Particularly in polar regions, where temperatures rise fastest, an increased glacial flow and the associated freshwater discharge will significantly contribute to the global sea level rise. Our initial evaluation of the robot took place during a four-day field trip to Mont Blanc in the French Alps, where we studied the largest moulin on the Mer de Glace glacier. I was joined by my PhD colleagues from the CREATE Lab, Kai Junge and Francesco Stella, our colleague Steffen Kirchgeorg from the Environmental Robotics Lab, as well as my friend, photographer and mountain guide, Arion Schuler. The goal of this trip was to test the robot in a nearby moulin before venturing to more remote locations, such as those on Greenland’s ice sheet. map of Mer de Glace glacierMap data from the Swiss government. What does a day in the life on this project look like? When we’re not out in the field, I am absorbed in the exciting work of designing and creating robots in our lab at EPFL. This includes developing algorithms to control a robot’s movements and testing their usability and robustness for deployment in extreme environments. As a PhD student, I also have the opportunity to share my lab findings with the wider robotics community through scientific publications. As much as I enjoy this development work, field trip days are definitely the most exciting parts of our project. On a typical field trip, we get up at 7 in the morning. My teammates Kai and Steffen go to get breakfast, while Francesco, Arion, and I check our safety equipment and the robot. packing equipment We pack generator, tent, poles, and ropes into our backpacks, then leave for the first cable car out of Montenvers Station, by the Mer de Glace glacier at Mont Blanc. riding the cable car On our ride up to the glacier, we take some time to review our plans and experiments for the day ahead. Upon arrival at our stop, we embark on a 1.5-hour trek through snowy landscapes to the largest moulin on the Mer de Glace glacier.";

function Wrapper({ children }: PropsWithChildren<unknown>): JSX.Element {
  return (
    <Stack fullHeight alignItems="center" justifyContent="center" style={{ fontSize: 44 }}>
      {children}
    </Stack>
  );
}

const A = () => <Wrapper>A</Wrapper>;
const B = () => <Wrapper>B</Wrapper>;
const C = () => <>{longText}</>;

const X = () => <Wrapper>X</Wrapper>;
const Y = () => <Wrapper>Y</Wrapper>;
const Z = () => <>{longText}</>;

type LeftKey = "a" | "b" | "c";
type RightKey = "x" | "y" | "z";

const ITEMS = new Map<string, SidebarItem>([]);
const BOTTOM_ITEMS = new Map<string, SidebarItem>([]);

const LEFT_ITEMS = new Map<LeftKey, NewSidebarItem>([
  ["a", { title: "A", component: A }],
  ["b", { title: "B", component: B }],
  ["c", { title: "C", component: C }],
]);

const RIGHT_ITEMS = new Map<RightKey, NewSidebarItem>([
  ["x", { title: "X", component: X }],
  ["y", { title: "Y", component: Y }],
  ["z", { title: "Z", component: Z }],
]);

function Story({
  label,
  defaultLeftKey,
  defaultRightKey,
}: {
  label?: string;
  defaultLeftKey?: LeftKey | undefined;
  defaultRightKey?: RightKey | undefined;
}): JSX.Element {
  const [selectedRightKey, setSelectedRightKey] = useState<RightKey | undefined>(defaultRightKey);
  const [selectedLeftKey, setSelectedLeftKey] = useState<LeftKey | undefined>(defaultLeftKey);
  const [_, setAppBarEnabled] = useAppConfigurationValue<boolean>(AppSetting.ENABLE_NEW_TOPNAV);
  const [leftSidebarSize, setLeftSidebarSize] = useState<number | undefined>();
  const [rightSidebarSize, setRightSidebarSize] = useState<number | undefined>();

  useEffect(() => {
    void setAppBarEnabled(true);
  }, [setAppBarEnabled]);

  return (
    <DndProvider backend={HTML5Backend}>
      <div style={{ height: "100%" }}>
        <Sidebars
          items={ITEMS}
          bottomItems={BOTTOM_ITEMS}
          rightItems={RIGHT_ITEMS}
          leftItems={LEFT_ITEMS}
          selectedKey={undefined}
          onSelectKey={() => {
            // no-op
          }}
          selectedRightKey={selectedRightKey}
          onSelectRightKey={setSelectedRightKey}
          selectedLeftKey={selectedLeftKey}
          onSelectLeftKey={setSelectedLeftKey}
          leftSidebarSize={leftSidebarSize}
          setLeftSidebarSize={setLeftSidebarSize}
          rightSidebarSize={rightSidebarSize}
          setRightSidebarSize={setRightSidebarSize}
        >
          {label ?? "Main content"}
        </Sidebars>
      </div>
    </DndProvider>
  );
}

// Left
export const LeftOpen = (): JSX.Element => <Story defaultLeftKey="a" />;
LeftOpen.storyName = "Left";

export const LeftLongText = (): JSX.Element => <Story defaultLeftKey="c" />;
LeftLongText.storyName = "Left (with text overflow)";

export const LeftClicked = (): JSX.Element => <Story defaultLeftKey="a" />;
LeftClicked.storyName = "Left (tab click interaction)";
LeftClicked.parameters = { colorScheme: "dark" };
LeftClicked.play = async () => {
  const leftTab = await screen.findByTestId("b-left");
  userEvent.click(leftTab);
};
export const LeftClosed = (): JSX.Element => (
  <Story defaultLeftKey="b" defaultRightKey="y" label="Left sidebar should be closed" />
);
LeftClosed.storyName = "Left (closed by interaction)";
LeftClosed.parameters = { colorScheme: "dark" };
LeftClosed.play = async () => {
  const leftClose = await screen.findByTestId("sidebar-close-left");
  userEvent.click(leftClose);
};

// Right
export const RightOpen = (): JSX.Element => <Story defaultRightKey="x" />;
RightOpen.storyName = "Right";

export const RightLongText = (): JSX.Element => <Story defaultRightKey="z" />;
RightLongText.storyName = "Right (with text overflow)";

export const RightClicked = (): JSX.Element => <Story defaultRightKey="x" />;
RightClicked.storyName = "Right (tab click interaction)";
RightClicked.parameters = { colorScheme: "dark" };
RightClicked.play = async () => {
  const rightTab = await screen.findByTestId("y-right");
  userEvent.click(rightTab);
};
export const RightClosed = (): JSX.Element => (
  <Story defaultLeftKey="b" defaultRightKey="y" label="Right sidebar should be closed" />
);
RightClosed.storyName = "Right (closed by interaction)";
RightClosed.parameters = { colorScheme: "dark" };
RightClosed.play = async () => {
  const rightClose = await screen.findByTestId("sidebar-close-right");
  userEvent.click(rightClose);
};

// Both
export const Default = (): JSX.Element => <Story label="Both sidebars should be closed" />;
export const BothOpen = (): JSX.Element => <Story defaultLeftKey="a" defaultRightKey="x" />;
BothOpen.storyName = "Both (opened)";

export const BothClicked = (): JSX.Element => <Story defaultLeftKey="a" defaultRightKey="x" />;
BothClicked.storyName = "Both (tab click interaction)";
BothClicked.parameters = { colorScheme: "dark" };
BothClicked.play = async () => {
  const leftTab = await screen.findByTestId("b-left");
  userEvent.click(leftTab);

  const rightTab = await screen.findByTestId("y-right");
  userEvent.click(rightTab);
};
