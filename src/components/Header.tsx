import { motion } from 'framer-motion';
import { Heart, Globe } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

const languages = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'hi', name: 'हिन्दी' },
  { code: 'zh', name: '中文' },
];

interface HeaderProps {
  selectedLanguage: string;
  onLanguageChange: (code: string) => void;
}

export const Header = ({ selectedLanguage, onLanguageChange }: HeaderProps) => {
  const currentLanguage = languages.find(l => l.code === selectedLanguage) || languages[0];

  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full py-4 px-6 border-b bg-card/80 backdrop-blur-sm sticky top-0 z-50"
    >
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-hero flex items-center justify-center shadow-soft">
            <Heart className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display font-bold text-lg text-foreground">
              MediClear
            </h1>
            <p className="text-xs text-muted-foreground">
              Understand your health
            </p>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Globe className="w-4 h-4" />
              {currentLanguage.name}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {languages.map((lang) => (
              <DropdownMenuItem
                key={lang.code}
                onClick={() => onLanguageChange(lang.code)}
                className={selectedLanguage === lang.code ? 'bg-muted' : ''}
              >
                {lang.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </motion.header>
  );
};
