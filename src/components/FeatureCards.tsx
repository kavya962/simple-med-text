import { motion } from 'framer-motion';
import { FileSearch, Languages, MessageSquareText, ShieldCheck } from 'lucide-react';

const features = [
  {
    icon: <FileSearch className="w-6 h-6" />,
    title: "Smart Analysis",
    description: "AI-powered reading of complex medical terminology"
  },
  {
    icon: <Languages className="w-6 h-6" />,
    title: "Multilingual",
    description: "Get explanations in your preferred language"
  },
  {
    icon: <MessageSquareText className="w-6 h-6" />,
    title: "Ask Questions",
    description: "Interactive Q&A to clarify your doubts"
  },
  {
    icon: <ShieldCheck className="w-6 h-6" />,
    title: "Private & Secure",
    description: "Your health data stays confidential"
  }
];

export const FeatureCards = () => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {features.map((feature, index) => (
        <motion.div
          key={feature.title}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 * index }}
          className="p-4 rounded-xl bg-card border shadow-soft hover:shadow-card transition-all duration-300 text-center"
        >
          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-3 text-primary">
            {feature.icon}
          </div>
          <h3 className="font-display font-semibold text-sm text-foreground mb-1">
            {feature.title}
          </h3>
          <p className="text-xs text-muted-foreground">
            {feature.description}
          </p>
        </motion.div>
      ))}
    </div>
  );
};
