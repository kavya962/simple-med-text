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

// Demo analysis data - in production this would come from AI
const getDemoAnalysis = (): Analysis => ({
  summary: "Your blood test results show generally healthy values with a few areas to monitor. Most indicators are within normal ranges, suggesting good overall health. There are minor variations in cholesterol levels that warrant attention but are not immediately concerning.",
  keyFindings: [
    "Total cholesterol is slightly elevated at 215 mg/dL (normal: below 200 mg/dL)",
    "HDL (good cholesterol) is within healthy range at 55 mg/dL",
    "Blood glucose levels are normal at 92 mg/dL",
    "Complete blood count shows healthy red and white blood cell levels",
    "Kidney and liver function markers are within normal limits"
  ],
  precautions: [
    "Reduce intake of saturated fats and processed foods",
    "Increase consumption of fiber-rich foods like oats, beans, and vegetables",
    "Maintain regular physical activity (at least 150 minutes per week)",
    "Limit alcohol consumption to moderate levels",
    "Schedule a follow-up lipid panel in 3-6 months"
  ],
  nextSteps: [
    "Discuss cholesterol management options with your doctor",
    "Consider a heart-healthy diet plan like the Mediterranean diet",
    "Schedule a follow-up blood test in 3 months to monitor progress",
    "No immediate medical intervention required based on these results"
  ]
});

const getDemoResponses = (question: string): string => {
  const q = question.toLowerCase();
  
  if (q.includes('cholesterol')) {
    return "Your cholesterol level of 215 mg/dL is slightly above the recommended level of 200 mg/dL. This is considered borderline high, not critically elevated. It means your body is producing or consuming slightly more cholesterol than ideal. The good news is that lifestyle changes can often bring this down to normal levels within a few months.";
  }
  if (q.includes('worried') || q.includes('concern')) {
    return "Based on your results, there's no need for immediate concern. Your values are mostly within healthy ranges with only minor variations. However, it's always good to follow up with your healthcare provider to discuss any questions and create a personalized health plan.";
  }
  if (q.includes('lifestyle') || q.includes('change')) {
    return "Great question! Here are key lifestyle changes that can help: 1) Eat more fiber-rich foods like oats and legumes, 2) Exercise for at least 30 minutes most days, 3) Choose healthy fats from fish, nuts, and olive oil, 4) Reduce processed foods and added sugars, 5) Maintain a healthy weight. These changes can significantly improve your cholesterol levels.";
  }
  if (q.includes('doctor') || q.includes('see')) {
    return "While your results don't indicate an urgent need for medical attention, I recommend scheduling a routine follow-up with your doctor within the next month. They can provide personalized advice and determine if any additional tests or treatments might benefit you. Bring a copy of this report to your appointment.";
  }
  
  return "I understand your question. Based on your medical report, here's what I can tell you: Your overall health indicators are generally positive. For specific medical advice tailored to your situation, I recommend discussing this with your healthcare provider who can consider your complete medical history.";
};

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
      console.error('Error saving to history:', error);
    } else {
      setHistoryRefreshTrigger(prev => prev + 1);
    }
  };

  const handleFileSelect = useCallback(async (file: File) => {
    setIsProcessing(true);
    setAnalysis(null);
    setMessages([]);
    setCurrentFileName(file.name);

    // Simulate AI processing
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const newAnalysis = getDemoAnalysis();
    setAnalysis(newAnalysis);
    setIsProcessing(false);
    toast.success('Report analyzed successfully!');

    // Save to history
    await saveToHistory(file.name, newAnalysis);
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

    // Simulate AI response
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: getDemoResponses(content)
    };
    
    setMessages(prev => [...prev, assistantMessage]);
    setIsChatLoading(false);
  }, []);

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
