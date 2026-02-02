-- Add user_id column to track report ownership
ALTER TABLE public.report_history 
ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Delete existing data (no way to associate with users)
DELETE FROM public.report_history;

-- Make user_id required for all new records
ALTER TABLE public.report_history 
ALTER COLUMN user_id SET NOT NULL;

-- Add index for performance
CREATE INDEX idx_report_history_user_id ON public.report_history(user_id);

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Anyone can view reports" ON public.report_history;
DROP POLICY IF EXISTS "Anyone can create reports" ON public.report_history;
DROP POLICY IF EXISTS "Anyone can delete reports" ON public.report_history;

-- Create user-scoped policies
CREATE POLICY "Users can view own reports" 
ON public.report_history 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own reports" 
ON public.report_history 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reports" 
ON public.report_history 
FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own reports" 
ON public.report_history 
FOR DELETE 
TO authenticated
USING (auth.uid() = user_id);