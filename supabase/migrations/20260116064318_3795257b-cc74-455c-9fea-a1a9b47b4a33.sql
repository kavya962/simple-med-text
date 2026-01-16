-- Create table for storing analyzed medical reports
CREATE TABLE public.report_history (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    file_name TEXT NOT NULL,
    summary TEXT NOT NULL,
    key_findings JSONB NOT NULL DEFAULT '[]'::jsonb,
    precautions JSONB NOT NULL DEFAULT '[]'::jsonb,
    next_steps JSONB NOT NULL DEFAULT '[]'::jsonb,
    language TEXT NOT NULL DEFAULT 'en',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.report_history ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access (no auth required for demo)
CREATE POLICY "Anyone can view reports" 
ON public.report_history 
FOR SELECT 
USING (true);

-- Create policy for public insert access
CREATE POLICY "Anyone can create reports" 
ON public.report_history 
FOR INSERT 
WITH CHECK (true);

-- Create policy for public delete access
CREATE POLICY "Anyone can delete reports" 
ON public.report_history 
FOR DELETE 
USING (true);