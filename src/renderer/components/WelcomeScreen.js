import React, { useEffect, useState } from 'react';
import { useProjectStore } from '../stores/projectStore';
export const WelcomeScreen = () => {
    const setProject = useProjectStore((state) => state.setProject);
    const [recentProjects, setRecentProjects] = useState([]);
    useEffect(() => {
        window.terminalIDE.project.getRecent().then(setRecentProjects);
    }, []);
    const handleOpenProject = async () => {
        const path = await window.terminalIDE.dialog.selectDirectory();
        if (!path)
            return;
        const result = await window.terminalIDE.project.open(path);
        if (result.success && result.project) {
            setProject(result.project);
        }
        else {
            console.error('Failed to open project:', result.error);
        }
    };
    const handleOpenRecent = async (path) => {
        const result = await window.terminalIDE.project.open(path);
        if (result.success && result.project) {
            setProject(result.project);
        }
        else {
            console.error('Failed to open project:', result.error);
        }
    };
    return (<div className="welcome-screen">
      <div className="welcome-content">
        <h1 className="welcome-title">Terminal IDE</h1>
        <p className="welcome-subtitle">Open a folder to get started</p>
        <button className="welcome-button" onClick={handleOpenProject}>
          Open Project
        </button>

        {recentProjects.length > 0 && (<div className="recent-folders">
            <div className="recent-folders-title">Recent Folders</div>
            {recentProjects.map((project) => (<button key={project.path} className="recent-folder-item" onClick={() => handleOpenRecent(project.path)}>
                <span className="recent-folder-name">{project.name}</span>
                <span className="recent-folder-path">{project.path}</span>
              </button>))}
          </div>)}
      </div>
    </div>);
};
//# sourceMappingURL=WelcomeScreen.js.map