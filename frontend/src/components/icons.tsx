import React from 'react';

export function RecordIcon({ size = 160 }: { size?: number }) {
  const r = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Record">
      <defs>
        <radialGradient id="record-grad" cx="30%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#ff6b6b" />
          <stop offset="60%" stopColor="#ff3b3b" />
          <stop offset="100%" stopColor="#e42222" />
        </radialGradient>
      </defs>
      <circle cx={r} cy={r} r={r * 0.9} fill="url(#record-grad)" />
    </svg>
  );
}

export function SearchIcon({ size = 160 }: { size?: number }) {
  const r = size / 2;
  const ring = r * 0.6;
  const handleLength = r * 0.9;
  const handleWidth = r * 0.18;
  return (
    <svg width={size + handleLength * 0.6} height={size} viewBox={`0 0 ${size + handleLength * 0.6} ${size}`} role="img" aria-label="Search">
      <defs>
        <linearGradient id="search-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6a7bff" />
          <stop offset="100%" stopColor="#2f46c6" />
        </linearGradient>
      </defs>
      <g transform={`translate(${r * 0.1},0)`}>
        <circle cx={r} cy={r} r={ring} fill="#ffffff" />
        <circle cx={r} cy={r} r={ring} fill="none" stroke="url(#search-grad)" strokeWidth={ring * 0.18} />
        <rect x={r + ring * 0.6} y={r + ring * 0.2} width={handleLength} height={handleWidth} rx={handleWidth / 2} fill="url(#search-grad)" transform={`rotate(45 ${r + ring * 0.6} ${r + ring * 0.2})`} />
      </g>
    </svg>
  );
}







