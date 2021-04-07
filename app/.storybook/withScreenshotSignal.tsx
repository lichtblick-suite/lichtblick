import { Story, StoryContext } from "@storybook/react";
import { useCallback, useRef, useState } from "react";

import signal from "@foxglove-studio/app/shared/signal";
import ScreenshotReadyContext from "@foxglove-studio/app/stories/ScreenshotReadyContext";

export default function withScreenshotSignal(Story: Story, { parameters }: StoryContext) {
  const signalRef = useRef(signal());
  const callCount = useRef(0);
  const [error, setError] = useState<Error | undefined>(undefined);

  if (parameters.screenshot?.waitFor == undefined) {
    parameters.screenshot.waitFor = signalRef.current;
  } else {
    // if the user has a waitFor defined, use that rather than our signal
    signalRef.current = parameters.screenshot.waitFor;
  }

  const sceneReady = useCallback(() => {
    if (callCount.current > 0) {
      setError(new Error("withScreenshotSignal: called scene ready more than once"));
      return;
    }
    ++callCount.current;
    signalRef.current.resolve();
  }, []);

  if (error) {
    throw error;
  }

  return (
    <ScreenshotReadyContext.Provider value={sceneReady}>
      <Story />
    </ScreenshotReadyContext.Provider>
  );
}
