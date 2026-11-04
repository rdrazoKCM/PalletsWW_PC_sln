import React, { createContext, useContext, useEffect, useState } from 'react';
import type { ChromeTheme } from '../types';
import { storageService } from '../services/storageService';

interface ThemeContextType {
  theme: ChromeTheme;
  setTheme: (theme: ChromeTheme) => void;
  availableThemes: { id: ChromeTheme; name: string; color: string }[];
}

const THEMES: { id: ChromeTheme; name: string; color: string }[] = [
  { id: 'royal-navy', name: 'Royal Navy (Oficial)', color: '#0f172a' },
  { id: 'kcm-deep-blue', name: 'KCM Deep Blue', color: '#002244' },
  { id: 'kcm-cyan-pro', name: 'KCM Cyan Pro', color: '#082f49' },
  { id: 'kcm-sapphire-plat', name: 'Sapphire Platinum', color: '#1e293b' },
  { id: 'kcm-emerald', name: 'Industrial Emerald', color: '#064e3b' },
  { id: 'kcm-amber-sunset', name: 'Amber Sunset', color: '#78350f' },
];

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ChromeTheme>(() => storageService.getTheme());

  const setTheme = (newTheme: ChromeTheme) => {
    setThemeState(newTheme);
    storageService.setTheme(newTheme);
  };

  useEffect(() => {
    // Aplicar clase al body o html para cromo
    document.body.classList.remove(
      'theme-royal-navy',
      'theme-kcm-deep-blue',
      'theme-kcm-cyan-pro',
      'theme-kcm-sapphire-plat',
      'theme-kcm-emerald',
      'theme-kcm-amber-sunset'
    );
    document.body.classList.add(`theme-${theme}`);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, availableThemes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
};
