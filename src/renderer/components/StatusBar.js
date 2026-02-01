import React from 'react';
import { useProjectStore } from '../stores/projectStore';
export const StatusBar = () => {
    const currentProject = useProjectStore((state) => state.currentProject);
    if (!currentProject)
        return null;
    return (<div className="status-bar">
      <div className="status-bar-left">
        <span className="status-bar-item">
          <span className="status-bar-icon">&#128193;</span>
          {currentProject.path}
        </span>
      </div>
      <div className="status-bar-right">
        {currentProject.isGitRepo && currentProject.gitBranch && (<span className="status-bar-item">
            <span className="status-bar-icon">&#9737;</span>
            {currentProject.gitBranch}
          </span>)}
      </div>
    </div>);
};
//# sourceMappingURL=StatusBar.js.map