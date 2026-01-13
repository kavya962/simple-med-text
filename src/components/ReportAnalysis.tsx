import { motion } from 'framer-motion';
import { 
  FileText, 
  AlertTriangle, 
  CheckCircle2, 
  ArrowRight, 
  Stethoscope,
  Shield,
  Calendar
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AnalysisSection {
  title: string;
  icon: React.ReactNode;
  content: string;
  type: 'summary' | 'findings' | 'precautions' | 'next-steps';
}

interface ReportAnalysisProps {
  analysis: {
    summary: string;
    keyFindings: string[];
    precautions: string[];
    nextSteps: string[];
  } | null;
}

const SectionCard = ({ 
  section, 
  index 
}: { 
  section: AnalysisSection; 
  index: number;
}) => {
  const getStyles = () => {
    switch (section.type) {
      case 'summary':
        return 'bg-gradient-card border-primary/20';
      case 'findings':
        return 'bg-gradient-card border-info/20';
      case 'precautions':
        return 'bg-gradient-card border-warning/20';
      case 'next-steps':
        return 'bg-gradient-card border-success/20';
      default:
        return 'bg-gradient-card';
    }
  };

  const getIconBg = () => {
    switch (section.type) {
      case 'summary':
        return 'bg-primary/10 text-primary';
      case 'findings':
        return 'bg-info/10 text-info';
      case 'precautions':
        return 'bg-warning/10 text-warning';
      case 'next-steps':
        return 'bg-success/10 text-success';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      className={cn(
        "rounded-xl border p-6 shadow-card transition-all duration-300 hover:shadow-elevated",
        getStyles()
      )}
    >
      <div className="flex items-start gap-4">
        <div className={cn("p-3 rounded-lg shrink-0", getIconBg())}>
          {section.icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-display font-semibold text-lg text-foreground mb-2">
            {section.title}
          </h3>
          <div className="text-muted-foreground leading-relaxed whitespace-pre-line">
            {section.content}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export const ReportAnalysis = ({ analysis }: ReportAnalysisProps) => {
  if (!analysis) return null;

  const sections: AnalysisSection[] = [
    {
      title: "Summary",
      icon: <FileText className="w-5 h-5" />,
      content: analysis.summary,
      type: 'summary'
    },
    {
      title: "Key Findings",
      icon: <Stethoscope className="w-5 h-5" />,
      content: analysis.keyFindings.map((f, i) => `• ${f}`).join('\n'),
      type: 'findings'
    },
    {
      title: "Precautions",
      icon: <Shield className="w-5 h-5" />,
      content: analysis.precautions.map((p, i) => `• ${p}`).join('\n'),
      type: 'precautions'
    },
    {
      title: "Recommended Next Steps",
      icon: <Calendar className="w-5 h-5" />,
      content: analysis.nextSteps.map((s, i) => `• ${s}`).join('\n'),
      type: 'next-steps'
    }
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="space-y-4"
    >
      <div className="flex items-center gap-2 mb-6">
        <CheckCircle2 className="w-5 h-5 text-success" />
        <h2 className="font-display font-semibold text-xl text-foreground">
          Your Report Explained
        </h2>
      </div>
      
      <div className="grid gap-4">
        {sections.map((section, index) => (
          <SectionCard key={section.type} section={section} index={index} />
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="mt-6 p-4 rounded-lg bg-muted/50 border border-border"
      >
        <p className="text-sm text-muted-foreground flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-warning" />
          <span>
            This analysis is for informational purposes only and should not replace professional medical advice. 
            Always consult with your healthcare provider for proper diagnosis and treatment.
          </span>
        </p>
      </motion.div>
    </motion.div>
  );
};
