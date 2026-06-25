import React from 'react';

const sizes = {
  xs: 'w-3 h-3 border',
  sm: 'w-5 h-5 border-2',
  md: 'w-8 h-8 border-2',
  lg: 'w-12 h-12 border-3',
};

export default function Spinner({ size = 'md', className = '' }) {
  return (
    <div
      className={`${sizes[size]} rounded-full border-white/10 border-t-blue-500 animate-spin ${className}`}
      role="status"
      aria-label="Loading"
    />
  );
}
