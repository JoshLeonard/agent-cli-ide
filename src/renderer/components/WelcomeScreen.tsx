import React, { useEffect, useState } from 'react';
import { useProjectStore } from '../stores/projectStore';
import { useLayoutStore } from '../stores/layoutStore';
import type { RecentProject } from '../../shared/types/ipc';

export const WelcomeScreen: React.FC = () => {
  const setProject = useProjectStore((state) => state.setProject);
  const { setLayout, loadWorktreeAgentPrefsFromBackend } = useLayoutStore();
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);

  useEffect(() => {
    window.terminalIDE.project.getRecent().then(setRecentProjects);
  }, []);

  // Restore layout and preferences after opening a project
  const restoreProjectState = async () => {
    await loadWorktreeAgentPrefsFromBackend();
    const state = await window.terminalIDE.persistence.restore();
    if (state) {
      // IMPORTANT: Get sessions from backend first, so they're in the map
      // before setLayout validates sessionIds
      const backendSessions = await window.terminalIDE.session.list();
      for (const session of backendSessions) {
        useLayoutStore.getState().updateSession(session);
      }
      // Now set layout - sessionIds will be validated against populated map
      if (state.layout) {
        setLayout(state.layout);
      }
    }
  };

  const handleOpenProject = async () => {
    const path = await window.terminalIDE.dialog.selectDirectory();
    if (!path) return;

    const result = await window.terminalIDE.project.open(path);
    if (result.success && result.project) {
      setProject(result.project);
      await restoreProjectState();
    } else {
      console.error('Failed to open project:', result.error);
    }
  };

  const handleOpenRecent = async (path: string) => {
    const result = await window.terminalIDE.project.open(path);
    if (result.success && result.project) {
      setProject(result.project);
      await restoreProjectState();
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

        {recentProjects.length > 0 && (
          <div className="recent-folders">
            <div className="recent-folders-title">Recent Folders</div>
            {recentProjects.map((project) => (
              <button
                key={project.path}
                className="recent-folder-item"
                onClick={() => handleOpenRecent(project.path)}
              >
                <span className="recent-folder-name">{project.name}</span>
                <span className="recent-folder-path">{project.path}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
