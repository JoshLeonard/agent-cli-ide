import React from 'react';
import { useProjectStore } from '../stores/projectStore';

export const WelcomeScreen: React.FC = () => {
  const setProject = useProjectStore((state) => state.setProject);

  const handleOpenProject = async () => {
    const path = await window.terminalIDE.dialog.selectDirectory();
    if (!path) return;

    const result = await window.terminalIDE.project.open(path);
    if (result.success && result.project) {
      setProject(result.project);
    } else {
      console.error('Failed to open project:', result.error);
    }
  };

  return (
    <div className="welcome-screen">
      <div className="welcome-content">
        <h1 className="welcome-title">Terminal IDE</h1>
        <p className="welcome-subtitle">Open a folder to get started</p>
        <button className="welcome-button" onClick={handleOpenProject}>
          Open Project
        </button>
      </div>
    </div>
  );
};
