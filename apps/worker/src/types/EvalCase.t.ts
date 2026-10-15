type FixIn = 'code' | 'test' | 'config' | 'unknown';

type EvalCase = {
  id: string;
  pr: number;
  runId: number;
  category: string;
  failedStep: string;
  file: string | string[];                       // one file, or a list of accepted files
  fixIn: FixIn | readonly FixIn[];
  rootCause: string;
  injection?: boolean;
};

export {EvalCase};