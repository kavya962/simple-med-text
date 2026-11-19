create type public.app_role as enum ('admin', 'user');
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id = _user_id and role = _role) $$;
create policy "Users see own roles" on public.user_roles for select to authenticated using (auth.uid() = user_id);

create table public.help_articles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.help_articles to authenticated;
grant all on public.help_articles to service_role;
alter table public.help_articles enable row level security;
create policy "Signed-in users read articles" on public.help_articles for select to authenticated using (true);
create policy "Admins insert articles" on public.help_articles for insert to authenticated with check (public.has_role(auth.uid(), 'admin'));
create policy "Admins update articles" on public.help_articles for update to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "Admins delete articles" on public.help_articles for delete to authenticated using (public.has_role(auth.uid(), 'admin'));

create table public.support_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  user_email text,
  status text not null default 'bot',
  handoff_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.support_conversations to authenticated;
grant all on public.support_conversations to service_role;
alter table public.support_conversations enable row level security;
create policy "Users read own conversation" on public.support_conversations for select to authenticated using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));
create policy "Users create own conversation" on public.support_conversations for insert to authenticated with check (auth.uid() = user_id);
create policy "Admins update conversations" on public.support_conversations for update to authenticated using (public.has_role(auth.uid(), 'admin'));

create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.support_conversations(id) on delete cascade,
  sender text not null,
  content text not null,
  created_at timestamptz not null default now()
);
grant select, insert on public.support_messages to authenticated;
grant all on public.support_messages to service_role;
alter table public.support_messages enable row level security;
create policy "Read own or admin messages" on public.support_messages for select to authenticated using (
  public.has_role(auth.uid(), 'admin') or exists (select 1 from public.support_conversations c where c.id = conversation_id and c.user_id = auth.uid()));
create policy "Admins send agent messages" on public.support_messages for insert to authenticated with check (
  sender = 'agent' and public.has_role(auth.uid(), 'admin'));
create index on public.support_messages (conversation_id, created_at);