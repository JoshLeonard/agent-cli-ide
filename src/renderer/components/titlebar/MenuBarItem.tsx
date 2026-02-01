import React from 'react';
import { MenuDropdown, MenuItem } from './MenuDropdown';
import { useMenuStore } from '../../stores/menuStore';

interface MenuBarItemProps {
  id: string;
  label: string;
  items: MenuItem[];
}

export const MenuBarItem: React.FC<MenuBarItemProps> = ({ id, label, items }) => {
  const { openMenuId, openMenu, closeMenu, toggleMenu } = useMenuStore();
  const isOpen = openMenuId === id;

  const handleClick = () => {
    toggleMenu(id);
  };

  const handleMouseEnter = () => {
    if (openMenuId !== null && openMenuId !== id) {
      openMenu(id);
    }
  };

  return (
    <div className="menu-bar-item">
      <button
        className={`menu-bar-button ${isOpen ? 'active' : ''}`}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
      >
        {label}
      </button>
      {isOpen && (
        <MenuDropdown items={items} onClose={closeMenu} />
      )}
    </div>
  );
};
