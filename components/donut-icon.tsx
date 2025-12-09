"use client";

import { cn } from "@/lib/utils";

interface DonutIconProps {
  className?: string;
  size?: number;
}

export function DonutIcon({ className, size = 16 }: DonutIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("inline-block", className)}
    >
      {/* Outer donut ring */}
      <circle
        cx="12"
        cy="12"
        r="10"
        fill="url(#donutGradient)"
        stroke="#c2410c"
        strokeWidth="1"
      />
      {/* Inner hole */}
      <circle
        cx="12"
        cy="12"
        r="4"
        fill="#18181b"
      />
      {/* Frosting/glaze highlights */}
      <path
        d="M6 8c1-2 3-3 6-3s5 1 6 3"
        stroke="#fcd34d"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
        opacity="0.8"
      />
      {/* Sprinkles */}
      <circle cx="7" cy="10" r="0.8" fill="#fbbf24" />
      <circle cx="17" cy="10" r="0.8" fill="#fb923c" />
      <circle cx="9" cy="16" r="0.8" fill="#fbbf24" />
      <circle cx="15" cy="16" r="0.8" fill="#fb923c" />
      <circle cx="6" cy="13" r="0.8" fill="#f97316" />
      <circle cx="18" cy="13" r="0.8" fill="#fbbf24" />

      <defs>
        <linearGradient id="donutGradient" x1="2" y1="2" x2="22" y2="22">
          <stop offset="0%" stopColor="#fb923c" />
          <stop offset="50%" stopColor="#f97316" />
          <stop offset="100%" stopColor="#ea580c" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// Inline version for text - smaller and positioned better with text
export function DonutSymbol({ className }: { className?: string }) {
  return (
    <svg
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("inline-block align-middle", className)}
      style={{ marginTop: "-0.1em" }}
    >
      {/* Outer donut ring */}
      <circle
        cx="12"
        cy="12"
        r="10"
        fill="url(#donutSymbolGradient)"
        stroke="#c2410c"
        strokeWidth="1"
      />
      {/* Inner hole */}
      <circle
        cx="12"
        cy="12"
        r="4"
        fill="#18181b"
      />
      {/* Frosting highlight */}
      <path
        d="M6 8c1-2 3-3 6-3s5 1 6 3"
        stroke="#fcd34d"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
        opacity="0.8"
      />
      {/* Sprinkles */}
      <circle cx="7" cy="10" r="0.8" fill="#fbbf24" />
      <circle cx="17" cy="10" r="0.8" fill="#fb923c" />
      <circle cx="9" cy="16" r="0.8" fill="#fbbf24" />
      <circle cx="15" cy="16" r="0.8" fill="#fb923c" />

      <defs>
        <linearGradient id="donutSymbolGradient" x1="2" y1="2" x2="22" y2="22">
          <stop offset="0%" stopColor="#fb923c" />
          <stop offset="50%" stopColor="#f97316" />
          <stop offset="100%" stopColor="#ea580c" />
        </linearGradient>
      </defs>
    </svg>
  );
}
