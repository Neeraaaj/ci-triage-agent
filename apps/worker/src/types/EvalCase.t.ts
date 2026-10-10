type EvalCase = {
  id: string;
  pr: number;
  runId: number;
  category: string;
  failedStep: string;
  file: string | string[];                       // one file, or a list of accepted files
  fixIn: 'code' | 'test' | 'config' | 'unknown';
  rootCause: string;
};

export {EvalCase};