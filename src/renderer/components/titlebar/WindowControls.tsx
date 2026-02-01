import React, { useState, useEffect } from 'react';

export const WindowControls: React.FC = () => {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    const checkMaximized = async () => {
      const maximized = await window.terminalIDE.window.isMaximized();
      setIsMaximized(maximized);
    };

    checkMaximized();

    const unsubscribe = window.terminalIDE.window.onMaximizeChanged(({ isMaximized }) => {
      setIsMaximized(isMaximized);
    });

    return () => unsubscribe();
  }, []);

  const handleMinimize = () => {
    window.terminalIDE.window.minimize();
  };

  const handleMaximize = () => {
    window.terminalIDE.window.maximize();
  };

  const handleClose = () => {
    window.terminalIDE.window.close();
  };

  return (
    <div className="window-controls">
      <button
        className="window-control minimize"
        onClick={handleMinimize}
        title="Minimize"
      >
        <svg width="10" height="1" viewBox="0 0 10 1">
          <rect width="10" height="1" fill="currentColor" />
        </svg>
      </button>
      <button
        className="window-control maximize"
        onClick={handleMaximize}
        title={isMaximized ? 'Restore' : 'Maximize'}
      >
        {isMaximized ? (
          <svg width="10" height="10" viewBox="0 0 10 10">
            <path
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              d="M2.5,3.5 L2.5,1 L9,1 L9,7.5 L6.5,7.5"
            />
            <rect
              x="1"
              y="3"
              width="6"
              height="6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
            />
          </svg>
        ) : (
          <svg width="10" height="10" viewBox="0 0 10 10">
            <rect
              x="0.5"
              y="0.5"
              width="9"
              height="9"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
            />
          </svg>
        )}
      </button>
      <button
        className="window-control close"
        onClick={handleClose}
        title="Close"
      >
        <svg width="10" height="10" viewBox="0 0 10 10">
          <path
            stroke="currentColor"
            strokeWidth="1.2"
            d="M1,1 L9,9 M1,9 L9,1"
          />
        </svg>
      </button>
    </div>
  );
};
