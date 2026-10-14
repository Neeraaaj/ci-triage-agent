import Anthropic from "@anthropic-ai/sdk";

export const READ_FILE_TOOL:Anthropic.Tool = {
  name: "read_file",
  description:
    "Read one file from the repository at the commit that failed CI. " +
    "Use it only when the log and diff do not show the code that caused the failure, " +
    "for example when the diff is truncated or the failing code is unchanged by this commit. " +
    "Do not use it if the log and diff already explain the failure. " +
    "Allowed: files under src/ or test/, package.json, tsconfig.json, .github/workflows/ci.yml. " +
    "Results over 300 lines are truncated. You may read at most 3 files.",
  input_schema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description:
          "Repository-relative path, for example src/slug.ts",
      },
    },
    required: ["path"],
    additionalProperties: false,
  },
};