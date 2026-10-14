import type { Octokit } from "octokit";
 
export function isAllowedPath(path: string): boolean {
  // Reject empty paths, absolute paths, and Windows-style paths.
  if (!path || path.startsWith("/") || path.includes("\\")) {
    return false;
  }

  const segments = path.split("/");

if (
  segments.some(
    (segment) =>
      segment === ".." || segment === "." || segment === "",
  )
) {
  return false;
}

  // Check the filename, not just the full path.
  const filename = segments[segments.length - 1];

  // Reject sensitive filenames, even inside allowed directories.
  if (
    filename.startsWith(".env") ||
    filename.endsWith(".pem") ||
    filename.endsWith(".key")
  ) {
    return false;
  }

  // Explicitly permitted root-level files.
  const allowedRootFiles = new Set([
    "package.json",
    "tsconfig.json",
    ".github/workflows/ci.yml",
  ]);

  if (allowedRootFiles.has(path)) {
    return true;
  }

  // Permit files under src/ and test/.
  if (path.startsWith("src/") || path.startsWith("test/")) {
    return true;
  }

  // Deny everything else.
  return false;
}

/**
 * Reads an allowed file from a specific GitHub commit.
 * Returns an error string instead of throwing for expected failures.
 */
export async function readRepoFile(
  octokit: Octokit,
  owner: string,
  repo: string,
  ref: string,
  path: string,
): Promise<string> {
  // 1. Validate the path before making any GitHub API request.
  if (!isAllowedPath(path)) {
    return "error: path not allowed";
  }

  try {
    // 2. Fetch the file from the exact commit that failed CI.
    const response = await octokit.rest.repos.getContent({
      owner,
      repo,
      path,
      ref,
    });

    const data = response.data;

    // 3. Reject directories and other non-file responses.
    if (
      Array.isArray(data) ||
      data.type !== "file" ||
      typeof data.content !== "string" ||
      data.encoding !== "base64"
    ) {
      return "error: path is not a readable file";
    }

    // 4. Decode GitHub's Base64-encoded file content.
    const content = Buffer.from(data.content, "base64").toString("utf8");

    // 5. Return at most 300 lines.
    const lines = content.split(/\r?\n/);
    const maxLines = 300;

    if (lines.length > maxLines) {
      return [
        lines.slice(0, maxLines).join("\n"),
        `[truncated: showing lines 1–${maxLines} of ${lines.length}]`,
      ].join("\n\n");
    }

    return content;
  } catch (error: unknown) {
    // 6. Convert a missing file into a useful observation.
    if (
      typeof error === "object" &&
      error !== null &&
      "status" in error &&
      error.status === 404
    ) {
      return "error: file not found";
    }

    // Unexpected errors should not be silently hidden.
    throw error;
  }
}