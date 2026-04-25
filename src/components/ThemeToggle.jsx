import { Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useThemeStore } from '@/store/themeStore';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useThemeStore();

  return (
    <Button variant="outline" size="sm" onClick={toggleTheme}>
      {theme === 'dark' ? <Sun className="h-4 w-4 mr-2" /> : <Moon className="h-4 w-4 mr-2" />}
      {theme === 'dark' ? 'Light' : 'Dark'}
    </Button>
  );
}
