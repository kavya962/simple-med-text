import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { History, FileText, Trash2, ChevronRight, Clock, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface Analysis {
  summary: string;
  keyFindings: string[];
  precautions: string[];
  nextSteps: string[];
}

interface ReportHistoryItem {
  id: string;
  file_name: string;
  summary: string;
  key_findings: string[];
  precautions: string[];
  next_steps: string[];
  language: string;
  created_at: string;
}

interface ReportHistoryProps {
  onSelectReport: (analysis: Analysis, fileName: string) => void;
  refreshTrigger?: number;
}

export const ReportHistory = ({ onSelectReport, refreshTrigger }: ReportHistoryProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [reports, setReports] = useState<ReportHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchReports = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('report_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      if (import.meta.env.DEV) {
        console.error('Error fetching reports:', error);
      }
      toast.error('Failed to load history');
    } else {
      const typedData = (data || []).map(item => ({
        ...item,
        key_findings: item.key_findings as string[],
        precautions: item.precautions as string[],
        next_steps: item.next_steps as string[]
      }));
      setReports(typedData);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchReports();
  }, [refreshTrigger]);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const { error } = await supabase
      .from('report_history')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Failed to delete report');
    } else {
      setReports(prev => prev.filter(r => r.id !== id));
      toast.success('Report deleted');
    }
  };

  const handleSelect = (report: ReportHistoryItem) => {
    const analysis: Analysis = {
      summary: report.summary,
      keyFindings: report.key_findings,
      precautions: report.precautions,
      nextSteps: report.next_steps
    };
    onSelectReport(analysis, report.file_name);
    setIsOpen(false);
  };

  return (
    <>
      {/* Toggle Button */}
      <motion.button
        onClick={() => {
          setIsOpen(true);
          fetchReports();
        }}
        className={cn(
          "fixed left-0 top-1/2 -translate-y-1/2 z-40",
          "bg-primary text-primary-foreground",
          "px-2 py-4 rounded-r-lg shadow-elevated",
          "flex items-center gap-1 group",
          "hover:px-3 transition-all duration-200"
        )}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <History className="w-5 h-5" />
        <span className="text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
          History
        </span>
      </motion.button>

      {/* Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
            onClick={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed left-0 top-0 h-full w-80 bg-card border-r shadow-elevated z-50"
          >
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="p-4 border-b flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History className="w-5 h-5 text-primary" />
                  <h2 className="font-display font-semibold text-lg">Report History</h2>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsOpen(false)}
                  className="h-8 w-8"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Content */}
              <ScrollArea className="flex-1">
                <div className="p-3 space-y-2">
                  {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
                    </div>
                  ) : reports.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="w-10 h-10 mx-auto mb-3 opacity-50" />
                      <p>No analyzed reports yet</p>
                      <p className="text-sm mt-1">Upload a report to get started</p>
                    </div>
                  ) : (
                    reports.map((report, index) => (
                      <motion.button
                        key={report.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        onClick={() => handleSelect(report)}
                        className={cn(
                          "w-full p-3 rounded-lg text-left",
                          "bg-muted/50 hover:bg-muted transition-colors",
                          "border border-transparent hover:border-primary/20",
                          "group relative"
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-md bg-primary/10 text-primary shrink-0">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate text-foreground">
                              {report.file_name}
                            </p>
                            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              <span>{format(new Date(report.created_at), 'MMM d, yyyy h:mm a')}</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                              {report.summary}
                            </p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                        </div>

                        {/* Delete Button */}
                        <button
                          onClick={(e) => handleDelete(e, report.id)}
                          className={cn(
                            "absolute top-2 right-2 p-1.5 rounded-md",
                            "bg-destructive/10 text-destructive",
                            "opacity-0 group-hover:opacity-100 transition-opacity",
                            "hover:bg-destructive/20"
                          )}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </motion.button>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
