
import React from 'react';

interface IconProps {
  name: string;
  className?: string;
  fill?: boolean;
}

const Icon: React.FC<IconProps> = ({ name, className = '', fill = false }) => {
  const style = fill ? { fontVariationSettings: "'FILL' 1" } : {};
  return (
    <span className={`material-symbols-outlined ${className}`} style={style}>
      {name}
    </span>
  );
};

export default Icon;
