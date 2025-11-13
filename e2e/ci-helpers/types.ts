export type ReportTestResult = {
  title: string;
  status: "passed" | "failed" | "skipped" | "timedOut";
  duration: number;
  retries: number;
};

type Result = {
  status: string;
  duration: number;
  retry: number;
};

type Test = {
  results: Result[];
};

type Spec = {
  title: string;
  tests: Test[];
};

type TestSuite = {
  title: string;
  file: string;
  specs: Spec[];
};

export type PlaywrightJSONReport = {
  suites: TestSuite[];
};
