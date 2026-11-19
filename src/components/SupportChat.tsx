import { useEffect, useRef, useState, useCallback } from 'react';
import { LifeBuoy, X, Send, Loader2, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

type Msg = { id: string; sender: string; content: string; created_at: string };

export const SupportChat = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [status, setStatus] = useState<string>('bot');
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const { data: convo } = await supabase.from('support_conversations').select('id, status').eq('user_id', user.id).maybeSingle();
    if (!convo) { setMessages([]); setStatus('bot'); return; }
    setStatus(convo.status);
    const { data } = await supabase.from('support_messages').select('id, sender, content, created_at')
      .eq('conversation_id', convo.id).order('created_at');
    setMessages(data ?? []);
  }, [user]);

  useEffect(() => {
    if (!open || !user) return;
    load();
    const t = setInterval(load, 5000); // pick up replies from the support team
    return () => clearInterval(t);
  }, [open, user, load]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, sending]);
  useEffect(() => { if (open && !sending) inputRef.current?.focus(); }, [open, sending]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    setSending(true);
    setMessages((m) => [...m, { id: `tmp-${Date.now()}`, sender: 'user', content: text, created_at: new Date().toISOString() }]);
    const { data, error } = await supabase.functions.invoke('support-chat', { body: { message: text } });
    if (error || data?.error) { toast.error(data?.error ?? 'Could not send message'); setInput(text); }
    await load();
    setSending(false);
  };

  return (
    <>
      {!open && (
        <Button onClick={() => setOpen(true)} className="fixed bottom-5 right-5 z-50 rounded-full h-14 px-5 shadow-lg gap-2">
          <LifeBuoy className="w-5 h-5" /> Help
        </Button>
      )}
      {open && (
        <div className="fixed bottom-5 right-5 z-50 w-[calc(100vw-2.5rem)] max-w-sm h-[min(560px,calc(100vh-2.5rem))] bg-card border border-border rounded-2xl shadow-xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-primary text-primary-foreground">
            <div className="flex items-center gap-2">
              <LifeBuoy className="w-5 h-5" />
              <div>
                <p className="font-semibold text-sm">MediClear Support</p>
                <p className="text-xs opacity-80">{status === 'needs_human' ? 'A team member will reply here' : 'Ask about the app or your reports'}</p>
              </div>
            </div>
            <button aria-label="Close support chat" onClick={() => setOpen(false)}><X className="w-5 h-5" /></button>
          </div>

          {!user ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
              <p className="text-sm text-muted-foreground">Please log in so we can look up your reports and keep your chat.</p>
              <Button onClick={() => navigate('/auth')}>Log in</Button>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center mt-8">Hi! How can we help you today?</p>
                )}
                {messages.map((m) => (
                  <div key={m.id} className={m.sender === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                    <div className={m.sender === 'user'
                      ? 'max-w-[85%] rounded-2xl rounded-br-sm bg-primary text-primary-foreground px-3 py-2 text-sm whitespace-pre-wrap'
                      : 'max-w-[85%] text-sm text-foreground whitespace-pre-wrap'}>
                      {m.sender === 'agent' && (
                        <span className="flex items-center gap-1 text-xs font-medium text-accent mb-1"><UserRound className="w-3 h-3" /> Support team</span>
                      )}
                      {m.content}
                    </div>
                  </div>
                ))}
                {sending && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="w-3 h-3 animate-spin" /> Typing…</div>}
                <div ref={endRef} />
              </div>
              <div className="border-t border-border p-3 flex gap-2 items-end">
                <Textarea ref={inputRef} value={input} rows={1} maxLength={2000} placeholder="Type your question…"
                  className="min-h-[40px] max-h-28 resize-none"
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
                <Button size="icon" aria-label="Send" onClick={send} disabled={sending || !input.trim()}><Send className="w-4 h-4" /></Button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
};
