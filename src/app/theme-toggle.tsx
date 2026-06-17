'use client';

import { useEffect, useState } from 'react';
import styles from './theme-toggle.module.css';

export function ThemeToggle() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [mounted, setMounted] = useState(false);

  // Carrega o tema salvo ao montar o componente
  useEffect(() => {
    setMounted(true);
    const saved = (localStorage.getItem('theme') as 'dark' | 'light') || 'dark';
    setTheme(saved);
    document.documentElement.setAttribute('data-theme', saved);
  }, []);

  // Alterna entre temas
  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  // Evita renderização no servidor
  if (!mounted) {
    return null;
  }

  return (
    <button
      className={styles.themeToggle}
      onClick={toggleTheme}
      title={`Ativar tema ${theme === 'dark' ? 'claro' : 'escuro'}`}
      aria-label="Alternar tema"
    >
      {theme === 'dark' ? (
        <i className="fa-solid fa-sun"></i>
      ) : (
        <i className="fa-solid fa-moon"></i>
      )}
    </button>
  );
}
