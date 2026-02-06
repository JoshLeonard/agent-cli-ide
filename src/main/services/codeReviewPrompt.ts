import type { GitHubPullRequest } from '../../shared/types/codeReview';

/**
 * Generate the AI review prompt for a pull request.
 * The agent has full tool access to run git commands and read files.
 */
export function generatePRReviewPrompt(pr: GitHubPullRequest): string {
  return `You are a code reviewer. Review Pull Request #${pr.number}: "${pr.title}"
Author: ${pr.author}
Branch: ${pr.headBranch} → ${pr.baseBranch}
${pr.body ? `Description: ${pr.body}` : ''}

Steps:
1. Run \`git diff ${pr.baseBranch}...HEAD\` to see all changes
2. For each changed file, read the file to understand context around the changes
3. Identify issues: security vulnerabilities, bugs, edge cases, missing error handling, performance

For each issue you find, note the EXACT line number in the current version of the file. Open the file and count — do not guess from the diff.

Your FINAL response must be ONLY this JSON (no markdown fences, no explanation):
{
  "summary": "<1-2 sentence assessment>",
  "comments": [
    {
      "file": "<path relative to repo root>",
      "line": <exact line number in the current file>,
      "side": "RIGHT",
      "body": "<markdown comment>",
      "severity": "error | warning | suggestion | info",
      "suggestion": "<optional replacement code>"
    }
  ],
  "verdict": "APPROVE | REQUEST_CHANGES | COMMENT"
}

If no issues, return empty comments with verdict "APPROVE".`;
}

/**
 * Generate the AI review prompt for local uncommitted changes.
 * The agent has full tool access to run git commands and read files.
 */
export function generateLocalReviewPrompt(): string {
  return `You are a code reviewer. Review the uncommitted local changes in this repository.

Steps:
1. Run \`git diff\` to see unstaged changes and \`git diff --cached\` for staged changes
2. For each changed file, read the file to see the full context around the changes
3. Identify issues: security vulnerabilities, bugs, edge cases, missing error handling, performance

For each issue you find, note the EXACT line number in the current version of the file. Open the file and count — do not guess from the diff.

Your FINAL response must be ONLY this JSON (no markdown fences, no explanation):
{
  "summary": "<1-2 sentence assessment>",
  "comments": [
    {
      "file": "<path relative to repo root>",
      "line": <exact line number in the current file>,
      "side": "RIGHT",
      "body": "<markdown comment>",
      "severity": "error | warning | suggestion | info",
      "suggestion": "<optional replacement code>"
    }
  ],
  "verdict": "APPROVE | REQUEST_CHANGES | COMMENT"
}

If no issues, return empty comments with verdict "APPROVE".`;
}
