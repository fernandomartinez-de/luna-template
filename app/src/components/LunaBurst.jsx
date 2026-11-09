import React from 'react'

/**
 * Just the burst pattern from the Luna logo, without the dark rounded-tile
 * background. Meant to sit on top of the Galaxy + WebThreads layers on the
 * hub, positioned where the threads visually converge.
 */
export default function LunaBurst({ size = 96, style }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      width={size}
      height={size}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      style={style}
    >
      <defs>
        <radialGradient id="lb-core" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="0.15" stopColor="#e9d5ff" stopOpacity="0.85" />
          <stop offset="0.4" stopColor="#a855f7" stopOpacity="0.5" />
          <stop offset="1" stopColor="#7c3aed" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="lb-ray" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="1" stopColor="#c4b5fd" stopOpacity="0.35" />
        </linearGradient>
        <radialGradient id="lb-dot" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.5" stopColor="#e9d5ff" />
          <stop offset="1" stopColor="#a855f7" stopOpacity="0.35" />
        </radialGradient>
      </defs>

      <circle cx="256" cy="256" r="240" fill="url(#lb-core)" />

      <g stroke="url(#lb-ray)" strokeWidth="4" strokeLinecap="round" fill="none">
        <line x1="256" y1="216" x2="256" y2="90" />
        <line x1="256" y1="296" x2="256" y2="422" />
        <line x1="216" y1="256" x2="90" y2="256" />
        <line x1="296" y1="256" x2="422" y2="256" />

        <line x1="228" y1="228" x2="139" y2="139" />
        <line x1="284" y1="228" x2="373" y2="139" />
        <line x1="228" y1="284" x2="139" y2="373" />
        <line x1="284" y1="284" x2="373" y2="373" />

        <line x1="221" y1="241" x2="119" y2="200" />
        <line x1="291" y1="241" x2="393" y2="200" />
        <line x1="221" y1="271" x2="119" y2="312" />
        <line x1="291" y1="271" x2="393" y2="312" />

        <line x1="241" y1="221" x2="200" y2="119" />
        <line x1="271" y1="221" x2="312" y2="119" />
        <line x1="241" y1="291" x2="200" y2="393" />
        <line x1="271" y1="291" x2="312" y2="393" />
      </g>

      <g fill="url(#lb-dot)">
        <circle cx="256" cy="90" r="7" />
        <circle cx="256" cy="422" r="7" />
        <circle cx="90" cy="256" r="7" />
        <circle cx="422" cy="256" r="7" />

        <circle cx="139" cy="139" r="6" />
        <circle cx="373" cy="139" r="6" />
        <circle cx="139" cy="373" r="6" />
        <circle cx="373" cy="373" r="6" />

        <circle cx="119" cy="200" r="5" />
        <circle cx="393" cy="200" r="5" />
        <circle cx="119" cy="312" r="5" />
        <circle cx="393" cy="312" r="5" />

        <circle cx="200" cy="119" r="5" />
        <circle cx="312" cy="119" r="5" />
        <circle cx="200" cy="393" r="5" />
        <circle cx="312" cy="393" r="5" />
      </g>

      <circle cx="256" cy="256" r="42" fill="#ffffff" opacity="0.25" />
      <circle cx="256" cy="256" r="18" fill="#ffffff" />
    </svg>
  )
}
