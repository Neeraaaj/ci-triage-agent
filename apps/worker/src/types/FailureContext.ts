type FailureContext = {
  failedJobs: { name: string; failedStep: string | null; logTail: string }[];
  diff: string;
};

export {FailureContext};