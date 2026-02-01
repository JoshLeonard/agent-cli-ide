import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { sessionRegistry } from './SessionRegistry';
import type {
  FileDiff,
  FileReviewResult,
  FileSaveResult,
  FileRevertResult,
  FileChangeType,
} from '../../shared/types/fileReview';

// Map file extensions to Monaco language identifiers
const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.json': 'json',
  '.html': 'html',
  '.htm': 'html',
  '.css': 'css',
  '.scss': 'scss',
  '.less': 'less',
  '.md': 'markdown',
  '.markdown': 'markdown',
  '.py': 'python',
  '.rb': 'ruby',
  '.go': 'go',
  '.rs': 'rust',
  '.java': 'java',
  '.c': 'c',
  '.cpp': 'cpp',
  '.h': 'c',
  '.hpp': 'cpp',
  '.cs': 'csharp',
  '.php': 'php',
  '.sh': 'shell',
  '.bash': 'shell',
  '.zsh': 'shell',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.xml': 'xml',
  '.sql': 'sql',
  '.graphql': 'graphql',
  '.vue': 'vue',
  '.svelte': 'svelte',
};

function getLanguageFromPath(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return EXTENSION_TO_LANGUAGE[ext] || 'plaintext';
}

function execGit(cwd: string, args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const proc = spawn('git', args, { cwd, shell: true });
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (exitCode) => {
      resolve({ stdout, stderr, exitCode: exitCode ?? 1 });
    });

    proc.on('error', (error) => {
      stderr = error.message;
      resolve({ stdout, stderr, exitCode: 1 });
    });
  });
}

export class FileReviewService {
  /**
   * Get the diff for a file in a session's working directory.
   * Returns original content from git HEAD and current modified content.
   */
  async getDiff(sessionId: string, filePath: string): Promise<FileReviewResult> {
    try {
      // Get session to find the working directory
      const session = sessionRegistry.getSession(sessionId);
      if (!session) {
        return { success: false, error: 'Session not found' };
      }

      const cwd = session.worktreePath || session.cwd;
      const absolutePath = path.isAbsolute(filePath)
        ? filePath
        : path.join(cwd, filePath);

      // Determine the relative path for git commands
      const relativePath = path.relative(cwd, absolutePath).replace(/\\/g, '/');

      // Check if file exists currently
      const fileExists = fs.existsSync(absolutePath);

      // Get original content from git HEAD
      let originalContent: string | null = null;
      const gitShowResult = await execGit(cwd, ['show', `HEAD:${relativePath}`]);

      if (gitShowResult.exitCode === 0) {
        originalContent = gitShowResult.stdout;
      }

      // Get current file content
      let modifiedContent: string | null = null;
      if (fileExists) {
        try {
          modifiedContent = await fs.promises.readFile(absolutePath, 'utf-8');
        } catch (error) {
          // File might be binary or unreadable
          return { success: false, error: 'Cannot read file content' };
        }
      }

      // Determine change type
      let changeType: FileChangeType;
      if (originalContent === null && modifiedContent !== null) {
        changeType = 'created';
      } else if (originalContent !== null && modifiedContent === null) {
        changeType = 'deleted';
      } else {
        changeType = 'modified';
      }

      const diff: FileDiff = {
        filePath: relativePath,
        originalContent,
        modifiedContent,
        language: getLanguageFromPath(filePath),
        changeType,
      };

      return { success: true, diff };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Save edited content back to a file in the session's working directory.
   */
  async saveFile(sessionId: string, filePath: string, content: string): Promise<FileSaveResult> {
    try {
      const session = sessionRegistry.getSession(sessionId);
      if (!session) {
        return { success: false, error: 'Session not found' };
      }

      const cwd = session.worktreePath || session.cwd;
      const absolutePath = path.isAbsolute(filePath)
        ? filePath
        : path.join(cwd, filePath);

      // Ensure parent directory exists
      const parentDir = path.dirname(absolutePath);
      if (!fs.existsSync(parentDir)) {
        await fs.promises.mkdir(parentDir, { recursive: true });
      }

      // Write the file
      await fs.promises.writeFile(absolutePath, content, 'utf-8');

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save file',
      };
    }
  }

  /**
   * Revert a file to its git HEAD version.
   */
  async revertFile(sessionId: string, filePath: string): Promise<FileRevertResult> {
    try {
      const session = sessionRegistry.getSession(sessionId);
      if (!session) {
        return { success: false, error: 'Session not found' };
      }

      const cwd = session.worktreePath || session.cwd;
      const absolutePath = path.isAbsolute(filePath)
        ? filePath
        : path.join(cwd, filePath);

      const relativePath = path.relative(cwd, absolutePath).replace(/\\/g, '/');

      // Check if file exists in HEAD
      const gitShowResult = await execGit(cwd, ['show', `HEAD:${relativePath}`]);

      if (gitShowResult.exitCode === 0) {
        // File exists in HEAD, restore it
        await fs.promises.writeFile(absolutePath, gitShowResult.stdout, 'utf-8');
      } else {
        // File doesn't exist in HEAD - it was a new file, delete it
        if (fs.existsSync(absolutePath)) {
          await fs.promises.unlink(absolutePath);
        }
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to revert file',
      };
    }
  }
}

// Singleton instance
export const fileReviewService = new FileReviewService();
