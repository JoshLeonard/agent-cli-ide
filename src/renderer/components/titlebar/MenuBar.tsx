import React, { useEffect, useCallback } from 'react';
import { MenuBarItem } from './MenuBarItem';
import { useMenuStore } from '../../stores/menuStore';
import type { MenuItem } from './MenuDropdown';

interface MenuDefinition {
  id: string;
  label: string;
  items: MenuItem[];
}

interface MenuBarProps {
  onNewSession: () => void;
  onOpenProject: () => void;
  onExit: () => void;
  onToggleSidebar: () => void;
  onToggleDevTools: () => void;
  onGridChange: (rows: number, cols: number) => void;
  onTerminateSession: () => void;
  onSendMessage: () => void;
  onBroadcast: () => void;
  onCopyShared: () => void;
  onPasteShared: () => void;
  onOpenSettings: () => void;
  hasActiveSession: boolean;
}

export const MenuBar: React.FC<MenuBarProps> = ({
  onNewSession,
  onOpenProject,
  onExit,
  onToggleSidebar,
  onToggleDevTools,
  onGridChange,
  onTerminateSession,
  onSendMessage,
  onBroadcast,
  onCopyShared,
  onPasteShared,
  onOpenSettings,
  hasActiveSession,
}) => {
  const { closeMenu } = useMenuStore();

  const menus: MenuDefinition[] = [
    {
      id: 'file',
      label: 'File',
      items: [
        { label: 'New Session', shortcut: 'Ctrl+N', action: onNewSession },
        { label: 'Open Project', shortcut: 'Ctrl+O', action: onOpenProject },
        { separator: true, label: '' },
        { label: 'Settings', shortcut: 'Ctrl+,', action: onOpenSettings },
        { separator: true, label: '' },
        { label: 'Exit', shortcut: 'Alt+F4', action: onExit },
      ],
    },
    {
      id: 'edit',
      label: 'Edit',
      items: [
        { label: 'Copy', shortcut: 'Ctrl+C', disabled: true },
        { label: 'Paste', shortcut: 'Ctrl+V', disabled: true },
        { separator: true, label: '' },
        { label: 'Copy to Shared Clipboard', shortcut: 'Ctrl+Shift+C', action: onCopyShared },
        { label: 'Paste from Shared', shortcut: 'Ctrl+Shift+V', action: onPasteShared },
      ],
    },
    {
      id: 'view',
      label: 'View',
      items: [
        { label: 'Grid 1x1', action: () => onGridChange(1, 1) },
        { label: 'Grid 1x2', action: () => onGridChange(1, 2) },
        { label: 'Grid 2x2', action: () => onGridChange(2, 2) },
        { label: 'Grid 2x3', action: () => onGridChange(2, 3) },
        { separator: true, label: '' },
        { label: 'Toggle Sidebar', shortcut: 'Ctrl+B', action: onToggleSidebar },
        { separator: true, label: '' },
        { label: 'Developer Tools', shortcut: 'Ctrl+Shift+I', action: onToggleDevTools },
      ],
    },
    {
      id: 'session',
      label: 'Session',
      items: [
        { label: 'New Session', action: onNewSession },
        { label: 'Terminate', shortcut: 'Ctrl+W', action: onTerminateSession, disabled: !hasActiveSession },
        { separator: true, label: '' },
        { label: 'Send to Session', shortcut: 'Ctrl+Shift+S', action: onSendMessage },
        { label: 'Broadcast', shortcut: 'Ctrl+Shift+B', action: onBroadcast },
      ],
    },
    {
      id: 'help',
      label: 'Help',
      items: [
        { label: 'Keyboard Shortcuts', shortcut: 'Ctrl+?' },
        { label: 'About Terminal IDE' },
      ],
    },
  ];

  const handleClickOutside = useCallback((e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target.closest('.menu-bar')) {
      closeMenu();
    }
  }, [closeMenu]);

  useEffect(() => {
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [handleClickOutside]);

  return (
    <div className="menu-bar">
      {menus.map((menu) => (
        <MenuBarItem key={menu.id} id={menu.id} label={menu.label} items={menu.items} />
      ))}
    </div>
  );
};
