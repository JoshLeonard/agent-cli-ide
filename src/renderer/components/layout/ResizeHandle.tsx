import React, { useCallback, useEffect, useState } from 'react';
import './ResizeHandle.css';

interface ResizeHandleProps {
  type: 'horizontal' | 'vertical';
  position: number;  // Percentage position (0-100)
  onDrag: (delta: number) => void;
}

export const ResizeHandle: React.FC<ResizeHandleProps> = ({
  type,
  position,
  onDrag,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setStartPos(type === 'horizontal' ? e.clientY : e.clientX);
  }, [type]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const currentPos = type === 'horizontal' ? e.clientY : e.clientX;
      const delta = currentPos - startPos;
      if (delta !== 0) {
        onDrag(delta);
        setStartPos(currentPos);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, startPos, type, onDrag]);

  const style: React.CSSProperties = type === 'horizontal'
    ? { top: `${position}%` }
    : { left: `${position}%` };

  return (
    <div
      className={`resize-handle ${type} ${isDragging ? 'dragging' : ''}`}
      style={style}
      onMouseDown={handleMouseDown}
    />
  );
};
