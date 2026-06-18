-- Storico conversazioni con il consulente AI
create table if not exists chat_conversations (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table chat_conversations enable row level security;

create policy "own chat conversations"
  on chat_conversations
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists chat_conversations_user_updated_idx
  on chat_conversations (user_id, updated_at desc);
