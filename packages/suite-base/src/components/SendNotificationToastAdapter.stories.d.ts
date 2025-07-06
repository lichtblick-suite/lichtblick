import { StoryFn, StoryObj } from "@storybook/react";
import SendNotificationToastAdapter from "@lichtblick/suite-base/components/SendNotificationToastAdapter";
declare const _default: {
    title: string;
    component: typeof SendNotificationToastAdapter;
    parameters: {
        chromatic: {
            delay: number;
        };
        colorScheme: string;
    };
    decorators: ((Wrapped: StoryFn) => React.JSX.Element)[];
};
export default _default;
export declare const OneError: StoryObj;
export declare const OneWarning: StoryObj;
export declare const OneInfo: StoryObj;
export declare const MultipleMessages: StoryObj;
export declare const MultipleMessagesLightTheme: StoryObj;
