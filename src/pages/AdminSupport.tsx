import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Trash2, Send, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { toast } from 'sonner';

type Convo = { id: string; user_email: string | null; status: string; handoff_reason: string | null; updated_at: string };
type Msg = { id: string; sender: string; content: string; created_at: string };
type Article = { id: string; title: string; content: string };

const Inbox = () => {
  const [convos, setConvos] = useState<Convo[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [reply, setReply] = useState('');

  const loadConvos = useCallback(async () => {
    const { data } = await supabase.from('support_conversations').select('id, user_email, status, handoff_reason, updated_at')
      .order('updated_at', { ascending: false });
    setConvos(data ?? []);
  }, []);
  const loadMsgs = useCallback(async () => {
    if (!active) return;
    const { data } = await supabase.from('support_messages').select('id, sender, content, created_at')
      .eq('conversation_id', active).order('created_at');
    setMsgs(data ?? []);
  }, [active]);

  useEffect(() => { loadConvos(); loadMsgs(); const t = setInterval(() => { loadConvos(); loadMsgs(); }, 5000); return () => clearInterval(t); }, [loadConvos, loadMsgs]);

  const send = async () => {
    if (!active || !reply.trim()) return;
    const { error } = await supabase.from('support_messages').insert({ conversation_id: active, sender: 'agent', content: reply.trim() });
    if (error) return toast.error('Could not send reply');
    await supabase.from('support_conversations').update({ updated_at: new Date().toISOString() }).eq('id', active);
    setReply(''); loadMsgs();
  };
  const resolve = async () => {
    if (!active) return;
    await supabase.from('support_conversations').update({ status: 'bot', handoff_reason: null }).eq('id', active);
    toast.success('Handed back to the assistant'); loadConvos();
  };
  const current = convos.find((c) => c.id === active);

  return (
    <div className="grid md:grid-cols-[280px_1fr] gap-4 min-h-[520px]">
      <div className="border border-border rounded-xl overflow-y-auto max-h-[600px]">
        {convos.length === 0 && <p className="p-4 text-sm text-muted-foreground">No conversations yet.</p>}
        {convos.map((c) => (
          <button key={c.id} onClick={() => setActive(c.id)}
            className={`w-full text-left p-3 border-b border-border hover:bg-muted ${active === c.id ? 'bg-muted' : ''}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium truncate">{c.user_email ?? 'Patient'}</span>
              {c.status === 'needs_human' && <Badge variant="destructive">Needs you</Badge>}
            </div>
            <span className="text-xs text-muted-foreground">{new Date(c.updated_at).toLocaleString()}</span>
          </button>
        ))}
      </div>
      <div className="border border-border rounded-xl flex flex-col">
        {!current ? <p className="m-auto text-sm text-muted-foreground">Pick a conversation</p> : (
          <>
            <div className="p-3 border-b border-border flex items-center justify-between gap-2">
              <div>
                <p className="font-medium text-sm">{current.user_email}</p>
                {current.handoff_reason && <p className="text-xs text-muted-foreground">Why: {current.handoff_reason}</p>}
              </div>
              {current.status === 'needs_human' && <Button size="sm" variant="outline" onClick={resolve} className="gap-1"><CheckCircle2 className="w-4 h-4" />Hand back to assistant</Button>}
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2 max-h-[440px]">
              {msgs.map((m) => (
                <div key={m.id} className={m.sender === 'user' ? '' : 'text-right'}>
                  <span className="text-xs text-muted-foreground">{m.sender === 'user' ? 'Patient' : m.sender === 'agent' ? 'You' : 'Assistant'}</span>
                  <p className={`inline-block w-full text-sm whitespace-pre-wrap rounded-lg px-3 py-2 ${m.sender === 'user' ? 'bg-muted' : m.sender === 'agent' ? 'bg-primary/10' : 'bg-secondary'}`}>{m.content}</p>
                </div>
              ))}
            </div>
            <div className="p-3 border-t border-border flex gap-2">
              <Textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Reply as support team…" rows={2} />
              <Button onClick={send} size="icon" aria-label="Send reply"><Send className="w-4 h-4" /></Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const Articles = () => {
  const [items, setItems] = useState<Article[]>([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const load = async () => {
    const { data } = await supabase.from('help_articles').select('id, title, content').order('updated_at', { ascending: false });
    setItems(data ?? []);
  };
  useEffect(() => { load(); }, []);
  const add = async () => {
    if (!title.trim() || !content.trim()) return;
    const { error } = await supabase.from('help_articles').insert({ title: title.trim(), content: content.trim() });
    if (error) return toast.error('Could not save article');
    setTitle(''); setContent(''); load(); toast.success('Article saved');
  };
  const del = async (id: string) => { await supabase.from('help_articles').delete().eq('id', id); load(); };
  return (
    <div className="space-y-6">
      <div className="space-y-2 border border-border rounded-xl p-4">
        <Input placeholder="Question or title, e.g. How do I upload a PDF?" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Textarea placeholder="Answer…" rows={5} value={content} onChange={(e) => setContent(e.target.value)} />
        <Button onClick={add}>Add article</Button>
      </div>
      {items.map((a) => (
        <div key={a.id} className="border border-border rounded-xl p-4 flex justify-between gap-4">
          <div><p className="font-medium">{a.title}</p><p className="text-sm text-muted-foreground whitespace-pre-wrap">{a.content}</p></div>
          <Button variant="ghost" size="icon" aria-label="Delete article" onClick={() => del(a.id)}><Trash2 className="w-4 h-4" /></Button>
        </div>
      ))}
    </div>
  );
};

const AdminSupport = () => {
  const { isAdmin, checking } = useIsAdmin();
  if (checking) return null;
  if (!isAdmin) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3">
      <p className="text-muted-foreground">This page is for the support team only.</p>
      <Link to="/" className="text-primary underline">Back home</Link>
    </div>
  );
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground mb-4"><ArrowLeft className="w-4 h-4" />Back</Link>
        <h1 className="text-2xl font-semibold mb-6">Support</h1>
        <Tabs defaultValue="inbox">
          <TabsList><TabsTrigger value="inbox">Inbox</TabsTrigger><TabsTrigger value="articles">Help articles</TabsTrigger></TabsList>
          <TabsContent value="inbox" className="mt-4"><Inbox /></TabsContent>
          <TabsContent value="articles" className="mt-4"><Articles /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
};
export default AdminSupport;
