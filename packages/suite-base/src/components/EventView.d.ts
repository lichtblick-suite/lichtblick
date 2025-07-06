/// <reference types="react" />
import { TimelinePositionedEvent } from "@lichtblick/suite-base/context/EventsContext";
declare function EventViewComponent(params: {
    event: TimelinePositionedEvent;
    filter: string;
    formattedTime: string;
    isHovered: boolean;
    isSelected: boolean;
    onClick: (event: TimelinePositionedEvent) => void;
    onHoverStart: (event: TimelinePositionedEvent) => void;
    onHoverEnd: (event: TimelinePositionedEvent) => void;
}): React.JSX.Element;
export declare const EventView: import("react").MemoExoticComponent<typeof EventViewComponent>;
export {};
