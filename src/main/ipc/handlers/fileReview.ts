import { ipcMain } from 'electron';
import { fileReviewService } from '../../services/FileReviewService';
import type {
  FileReviewRequest,
  FileSaveRequest,
  FileRevertRequest,
} from '../../../shared/types/fileReview';

export function registerFileReviewHandlers(): void {
  ipcMain.handle(
    'fileReview:getDiff',
    async (_event, request: FileReviewRequest) => {
      return fileReviewService.getDiff(request.sessionId, request.filePath);
    }
  );

  ipcMain.handle(
    'fileReview:saveFile',
    async (_event, request: FileSaveRequest) => {
      return fileReviewService.saveFile(
        request.sessionId,
        request.filePath,
        request.content
      );
    }
  );

  ipcMain.handle(
    'fileReview:revertFile',
    async (_event, request: FileRevertRequest) => {
      return fileReviewService.revertFile(request.sessionId, request.filePath);
    }
  );
}

export function unregisterFileReviewHandlers(): void {
  ipcMain.removeHandler('fileReview:getDiff');
  ipcMain.removeHandler('fileReview:saveFile');
  ipcMain.removeHandler('fileReview:revertFile');
}
