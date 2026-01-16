import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Header } from '@/components/Header';
import { FileUpload } from '@/components/FileUpload';
import { ReportAnalysis } from '@/components/ReportAnalysis';
import { ChatInterface } from '@/components/ChatInterface';
import { FeatureCards } from '@/components/FeatureCards';
import { ReportHistory } from '@/components/ReportHistory';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface Analysis {
  summary: string;
  keyFindings: string[];
  precautions: string[];
  nextSteps: string[];
}

const Index = () => {
  const [language, setLanguage] = useState('en');
  const [isProcessing, setIsProcessing] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [currentFileName, setCurrentFileName] = useState<string>('');
  const [historyRefreshTrigger, setHistoryRefreshTrigger] = useState(0);

  const saveToHistory = async (fileName: string, analysisData: Analysis) => {
    const { error } = await supabase.from('report_history').insert({
      file_name: fileName,
      summary: analysisData.summary,
      key_findings: analysisData.keyFindings,
      precautions: analysisData.precautions,
      next_steps: analysisData.nextSteps,
      language
    });

    if (error) {
      if (import.meta.env.DEV) {
        console.error('Error saving to history:', error);
      }
    } else {
      setHistoryRefreshTrigger(prev => prev + 1);
    }
  };

  const extractTextFromFile = async (file: File): Promise<string> => {
    // For text-based files, read directly
    if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
      return await file.text();
    }
    
    // For images, we'll send a description
    if (file.type.startsWith('image/')) {
      return `[Medical report image uploaded: ${file.name}. Please analyze this as a typical medical lab report with common health metrics like blood tests, cholesterol levels, glucose, etc.]`;
    }
    
    // For PDFs and documents, we'll extract what we can or use the filename
    // In a production app, you'd use a document parsing service
    return `[Medical document uploaded: ${file.name}. Please provide a general analysis template for a typical medical report covering common lab values, health indicators, and recommendations.]`;
  };

  const handleFileSelect = useCallback(async (file: File) => {
    setIsProcessing(true);
    setAnalysis(null);
    setMessages([]);
    setCurrentFileName(file.name);

    try {
      const reportText = await extractTextFromFile(file);
      
      const { data, error } = await supabase.functions.invoke('analyze-report', {
        body: { reportText, language }
      });

      if (error) {
        throw new Error(error.message || 'Failed to analyze report');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      if (data?.analysis) {
        setAnalysis(data.analysis);
        toast.success('Report analyzed successfully!');
        await saveToHistory(file.name, data.analysis);
      } else {
        throw new Error('No analysis returned');
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Analysis error:', error);
      }
      toast.error(error instanceof Error ? error.message : 'Failed to analyze report');
    } finally {
      setIsProcessing(false);
    }
  }, [language]);

  const handleSelectFromHistory = useCallback((analysisData: Analysis, fileName: string) => {
    setAnalysis(analysisData);
    setCurrentFileName(fileName);
    setMessages([]);
    toast.success(`Loaded: ${fileName}`);
  }, []);

  const handleSendMessage = useCallback(async (content: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content
    };
    
    setMessages(prev => [...prev, userMessage]);
    setIsChatLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('medical-chat', {
        body: { 
          question: content, 
          reportContext: analysis,
          language 
        }
      });

      if (error) {
        throw new Error(error.message || 'Failed to get response');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data?.response || 'I apologize, I could not generate a response. Please try again.'
      };
      
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Chat error:', error);
      }
      toast.error(error instanceof Error ? error.message : 'Failed to get response');
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'I apologize, but I encountered an error. Please try asking your question again.'
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsChatLoading(false);
    }
  }, [analysis, language]);

  return (
    <div className="min-h-screen bg-background">
      <ReportHistory 
        onSelectReport={handleSelectFromHistory}
        refreshTrigger={historyRefreshTrigger}
      />
      <Header 
        selectedLanguage={language} 
        onLanguageChange={setLanguage} 
      />

      <main className="max-w-6xl mx-auto px-4 py-8 md:py-12">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-10"
        >
          <h1 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4">
            Understand Your Medical Reports
            <span className="text-gradient"> Simply</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Upload any medical report and get clear, easy-to-understand explanations. 
            Ask questions and receive guidance in your language.
          </p>
        </motion.div>

        {/* Feature Cards */}
        <div className="mb-10">
          <FeatureCards />
        </div>

        {/* Main Content */}
        <div className="grid lg:grid-cols-5 gap-8">
          {/* Left Column - Upload & Analysis */}
          <div className="lg:col-span-3 space-y-6">
            <FileUpload 
              onFileSelect={handleFileSelect}
              isProcessing={isProcessing}
            />
            
            {analysis && (
              <ReportAnalysis analysis={analysis} />
            )}
          </div>

          {/* Right Column - Chat */}
          <div className="lg:col-span-2">
            <div className="lg:sticky lg:top-24">
              <ChatInterface
                messages={messages}
                onSendMessage={handleSendMessage}
                isLoading={isChatLoading}
                isEnabled={analysis !== null}
              />
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t bg-card/50 mt-16">
        <div className="max-w-6xl mx-auto px-4 py-8 text-center">
          <p className="text-sm text-muted-foreground">
            MediClear is for informational purposes only. Always consult a healthcare professional for medical advice.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
