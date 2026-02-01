import React from 'react';

export interface MenuItem {
  label: string;
  shortcut?: string;
  action?: () => void;
  separator?: boolean;
  disabled?: boolean;
}

interface MenuDropdownProps {
  items: MenuItem[];
  onClose: () => void;
}

export const MenuDropdown: React.FC<MenuDropdownProps> = ({ items, onClose }) => {
  const handleItemClick = (item: MenuItem) => {
    if (item.disabled || item.separator) return;
    item.action?.();
    onClose();
  };

  return (
    <div className="menu-dropdown">
      {items.map((item, index) => {
        if (item.separator) {
          return <div key={index} className="menu-separator" />;
        }

        return (
          <button
            key={index}
            className={`menu-item ${item.disabled ? 'disabled' : ''}`}
            onClick={() => handleItemClick(item)}
            disabled={item.disabled}
          >
            <span className="menu-item-label">{item.label}</span>
            {item.shortcut && (
              <span className="menu-item-shortcut">{item.shortcut}</span>
            )}
          </button>
        );
      })}
    </div>
  );
};
