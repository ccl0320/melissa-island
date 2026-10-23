-- Melissa 的小島：雲端存檔資料表（在 Supabase 的 SQL Editor 貼上後按 Run）
create table if not exists public.island_docs (
  path text primary key,
  col text not null,
  id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create index if not exists island_docs_col on public.island_docs (col);
alter table public.island_docs enable row level security;
drop policy if exists "island app" on public.island_docs;
create policy "island app" on public.island_docs for all to anon using (true) with check (true);
grant select, insert, update, delete on public.island_docs to anon;
