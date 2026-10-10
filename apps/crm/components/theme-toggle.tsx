'use client';

import { useState } from 'react';

type Theme = 'system' | 'light' | 'dark';
const OPTIONS: { value: Theme; label: string }[] = [
  { value: 'system', label: 'Auto' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

function applyTheme(value: Theme) {
  document.cookie = `hw_theme=${value}; path=/; max-age=31536000; samesite=lax`;
  const root = document.documentElement;
  if (value === 'system') delete root.dataset.theme;
  else root.dataset.theme = value;
}

/** Light, dark or follow the system. Stored in a cookie so the server renders the right theme. */
export function ThemeToggle({ initial }: { initial: Theme }) {
  const [theme, setTheme] = useState<Theme>(initial);
  const choose = (value: Theme) => {
    setTheme(value);
    applyTheme(value);
  };
  return (
    <fieldset className="flex rounded-full border border-line bg-surface p-0.5 text-xs">
      <legend className="sr-only">Colour theme</legend>
      {OPTIONS.map((option) => (
        <label
          key={option.value}
          className="flex-1 cursor-pointer rounded-full px-2.5 py-1 text-center font-semibold text-ink-muted has-checked:bg-primary has-checked:text-on-primary has-focus-visible:outline-2 has-focus-visible:outline-focus"
        >
          <input
            type="radio"
            name="theme"
            value={option.value}
            checked={theme === option.value}
            onChange={() => choose(option.value)}
            className="sr-only"
          />
          {option.label}
        </label>
      ))}
    </fieldset>
  );
}
