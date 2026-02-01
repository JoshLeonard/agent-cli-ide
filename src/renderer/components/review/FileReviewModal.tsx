import React, { useEffect, useRef, useCallback } from 'react';
import * as monaco from 'monaco-editor';
import { useFileReviewStore } from '../../stores/fileReviewStore';
import { useLayoutStore } from '../../stores/layoutStore';
import { FileReviewList } from './FileReviewList';
import './FileReviewModal.css';

export const FileReviewModal: React.FC = () => {
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const diffEditorRef = useRef<monaco.editor.IStandaloneDiffEditor | null>(null);

  const {
    isModalOpen,
    activeSessionId,
    currentFileIndex,
    currentDiff,
    editedContent,
    hasUnsavedChanges,
    isLoading,
    error,
    getPendingChangesForSession,
    closeReview,
    navigateFile,
    navigateNext,
    navigatePrevious,
    setEditedContent,
    markCurrentAsReviewed,
    saveCurrentFile,
    revertCurrentFile,
    refreshCurrentDiff,
  } = useFileReviewStore();

  const session = useLayoutStore((state) =>
    activeSessionId ? state.sessions.get(activeSessionId) : null
  );

  const changes = activeSessionId ? getPendingChangesForSession(activeSessionId) : [];
  const currentChange = changes[currentFileIndex];
  const totalFiles = changes.length;

  // Load diff when file changes
  useEffect(() => {
    if (isModalOpen && currentChange && !currentDiff) {
      refreshCurrentDiff();
    }
  }, [isModalOpen, currentChange, currentDiff, refreshCurrentDiff]);

  // Initialize Monaco diff editor
  useEffect(() => {
    if (!editorContainerRef.current || !isModalOpen) return;

    const editor = monaco.editor.createDiffEditor(editorContainerRef.current, {
      theme: 'vs-dark',
      automaticLayout: true,
      renderSideBySide: true,
      readOnly: false,
      originalEditable: false,
      enableSplitViewResizing: true,
      scrollBeyondLastLine: false,
      minimap: { enabled: false },
      fontSize: 13,
      lineNumbers: 'on',
      renderWhitespace: 'selection',
      scrollbar: {
        verticalScrollbarSize: 10,
        horizontalScrollbarSize: 10,
      },
    });

    diffEditorRef.current = editor;

    return () => {
      editor.dispose();
      diffEditorRef.current = null;
    };
  }, [isModalOpen]);

  // Update editor content when diff changes
  useEffect(() => {
    if (!diffEditorRef.current || !currentDiff) return;

    const originalModel = monaco.editor.createModel(
      currentDiff.originalContent || '',
      currentDiff.language
    );
    const modifiedModel = monaco.editor.createModel(
      currentDiff.modifiedContent || '',
      currentDiff.language
    );

    diffEditorRef.current.setModel({
      original: originalModel,
      modified: modifiedModel,
    });

    // Listen for changes in the modified editor
    const modifiedEditor = diffEditorRef.current.getModifiedEditor();
    const disposable = modifiedEditor.onDidChangeModelContent(() => {
      const value = modifiedEditor.getValue();
      setEditedContent(value);
    });

    return () => {
      disposable.dispose();
      originalModel.dispose();
      modifiedModel.dispose();
    };
  }, [currentDiff, setEditedContent]);

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isModalOpen) return;

      // Escape - close modal
      if (e.key === 'Escape') {
        if (hasUnsavedChanges) {
          if (confirm('You have unsaved changes. Close anyway?')) {
            closeReview();
          }
        } else {
          closeReview();
        }
        e.preventDefault();
        return;
      }

      // Ctrl+S - save file
      if (e.ctrlKey && e.key === 's') {
        saveCurrentFile();
        e.preventDefault();
        return;
      }

      // Arrow keys for navigation (only when not focused in editor)
      const activeElement = document.activeElement;
      const isInEditor = editorContainerRef.current?.contains(activeElement);

      if (!isInEditor) {
        if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
          if (hasUnsavedChanges) {
            if (confirm('You have unsaved changes. Navigate anyway?')) {
              navigatePrevious();
            }
          } else {
            navigatePrevious();
          }
          e.preventDefault();
        } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
          if (hasUnsavedChanges) {
            if (confirm('You have unsaved changes. Navigate anyway?')) {
              navigateNext();
            }
          } else {
            navigateNext();
          }
          e.preventDefault();
        }
      }
    },
    [isModalOpen, hasUnsavedChanges, closeReview, saveCurrentFile, navigatePrevious, navigateNext]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleFileSelect = (index: number) => {
    if (index === currentFileIndex) return;

    if (hasUnsavedChanges) {
      if (confirm('You have unsaved changes. Switch file anyway?')) {
        navigateFile(index);
      }
    } else {
      navigateFile(index);
    }
  };

  const handleClose = () => {
    if (hasUnsavedChanges) {
      if (confirm('You have unsaved changes. Close anyway?')) {
        closeReview();
      }
    } else {
      closeReview();
    }
  };

  const handleSave = async () => {
    await saveCurrentFile();
  };

  const handleRevert = async () => {
    if (confirm('Revert this file to the version from git HEAD? This cannot be undone.')) {
      await revertCurrentFile();
    }
  };

  const handleDone = () => {
    markCurrentAsReviewed();
    if (currentFileIndex < totalFiles - 1) {
      navigateNext();
    } else {
      closeReview();
    }
  };

  if (!isModalOpen || !activeSessionId) {
    return null;
  }

  const sessionName = session?.branch || session?.cwd.split(/[\\/]/).pop() || 'Unknown';

  return (
    <div className="file-review-modal-overlay" onClick={handleClose}>
      <div className="file-review-modal" onClick={(e) => e.stopPropagation()}>
        <div className="file-review-modal-header">
          <h2 className="file-review-modal-title">
            Review Changes - {sessionName}
          </h2>
          <button className="file-review-modal-close" onClick={handleClose} title="Close">
            &times;
          </button>
        </div>

        <div className="file-review-modal-content">
          <div className="file-review-modal-sidebar">
            <FileReviewList
              changes={changes}
              currentIndex={currentFileIndex}
              hasUnsavedChanges={hasUnsavedChanges}
              onSelect={handleFileSelect}
            />
          </div>

          <div className="file-review-modal-editor">
            {isLoading && (
              <div className="file-review-modal-loading">Loading diff...</div>
            )}
            {error && (
              <div className="file-review-modal-error">{error}</div>
            )}
            {!isLoading && !error && currentDiff && (
              <div className="file-review-modal-editor-labels">
                <span className="file-review-modal-editor-label">Original (HEAD)</span>
                <span className="file-review-modal-editor-label">Current (editable)</span>
              </div>
            )}
            <div
              ref={editorContainerRef}
              className="file-review-modal-editor-container"
            />
          </div>
        </div>

        <div className="file-review-modal-footer">
          <div className="file-review-modal-nav">
            <button
              className="file-review-modal-btn file-review-modal-btn--secondary"
              onClick={() => hasUnsavedChanges && !confirm('You have unsaved changes. Navigate anyway?') ? null : navigatePrevious()}
              disabled={currentFileIndex === 0}
            >
              &lt; Prev
            </button>
            <span className="file-review-modal-counter">
              {currentFileIndex + 1} / {totalFiles}
            </span>
            <button
              className="file-review-modal-btn file-review-modal-btn--secondary"
              onClick={() => hasUnsavedChanges && !confirm('You have unsaved changes. Navigate anyway?') ? null : navigateNext()}
              disabled={currentFileIndex >= totalFiles - 1}
            >
              Next &gt;
            </button>
          </div>

          <div className="file-review-modal-actions">
            <button
              className="file-review-modal-btn file-review-modal-btn--danger"
              onClick={handleRevert}
              disabled={isLoading || !currentDiff}
              title="Restore file to git HEAD version"
            >
              Revert
            </button>
            <button
              className="file-review-modal-btn file-review-modal-btn--primary"
              onClick={handleSave}
              disabled={isLoading || !hasUnsavedChanges}
              title="Save changes to disk (Ctrl+S)"
            >
              Save
            </button>
            <button
              className="file-review-modal-btn file-review-modal-btn--success"
              onClick={handleDone}
              disabled={isLoading}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
