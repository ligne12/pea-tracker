-- Transactions table
create table if not exists transactions (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  date text not null,
  time text not null,
  type text not null check (type in ('ACHAT', 'VENTE')),
  name text not null,
  isin text not null,
  quantity integer not null,
  price numeric not null,
  gross_amount numeric not null,
  commission numeric not null default 0,
  fees numeric not null default 0,
  net_amount numeric not null,
  market text not null default '',
  reference text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index for fast user queries
create index if not exists idx_transactions_user_id on transactions(user_id);
create index if not exists idx_transactions_user_date on transactions(user_id, date);

-- Row Level Security
alter table transactions enable row level security;

-- Users can only see/modify their own transactions
create policy "Users can view own transactions"
  on transactions for select
  using (auth.uid() = user_id);

create policy "Users can insert own transactions"
  on transactions for insert
  with check (auth.uid() = user_id);

create policy "Users can update own transactions"
  on transactions for update
  using (auth.uid() = user_id);

create policy "Users can delete own transactions"
  on transactions for delete
  using (auth.uid() = user_id);

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger transactions_updated_at
  before update on transactions
  for each row execute function update_updated_at();
