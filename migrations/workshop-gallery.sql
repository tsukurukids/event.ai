-- Apply once in Supabase SQL Editor before deploying the gallery.
BEGIN;
ALTER TABLE public.games ALTER COLUMN session_id DROP NOT NULL;
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS genre_id text
  CHECK (genre_id IN ('athletic', 'shooting', 'puzzle'));
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- The server, not the participant's PC clock, determines the public period.
CREATE OR REPLACE FUNCTION public.set_workshop_expiry()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.storage_path LIKE 'workshop/%' THEN
    NEW.uploaded_at := now();
    NEW.expires_at := (NEW.uploaded_at AT TIME ZONE 'UTC' + interval '2 months') AT TIME ZONE 'UTC';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS workshop_expiry ON public.games;
CREATE TRIGGER workshop_expiry BEFORE INSERT ON public.games
FOR EACH ROW EXECUTE FUNCTION public.set_workshop_expiry();

UPDATE public.games SET expires_at = (uploaded_at AT TIME ZONE 'UTC' + interval '2 months') AT TIME ZONE 'UTC'
WHERE storage_path LIKE 'workshop/%' AND expires_at IS NULL;

DROP POLICY IF EXISTS "Auth read all games" ON public.games;
DROP POLICY IF EXISTS "Auth manage games" ON public.games;
DROP POLICY IF EXISTS "Public read games" ON public.games;
CREATE POLICY "Public read games" ON public.games FOR SELECT TO anon, authenticated
USING (is_published AND (expires_at IS NULL OR expires_at > now()));
DROP POLICY IF EXISTS "Workshop anon insert games" ON public.games;
CREATE POLICY "Workshop anon insert games" ON public.games FOR INSERT TO anon, authenticated
WITH CHECK (is_published AND storage_path LIKE 'workshop/%' AND genre_id IS NOT NULL AND expires_at IS NOT NULL AND session_id IS NULL);

-- Public clients can add new files but cannot overwrite someone else's work.
DROP POLICY IF EXISTS "Auth manage game-files" ON storage.objects;
DROP POLICY IF EXISTS "Workshop anon update game-files" ON storage.objects;
DROP POLICY IF EXISTS "Workshop anon upload game-files" ON storage.objects;
CREATE POLICY "Workshop anon upload game-files" ON storage.objects FOR INSERT TO anon, authenticated
WITH CHECK (bucket_id = 'game-files' AND name LIKE 'workshop/%');
CREATE INDEX IF NOT EXISTS games_gallery_uploaded_idx ON public.games (uploaded_at DESC, id DESC) WHERE is_published;
COMMENT ON COLUMN public.games.expires_at IS 'Workshop: server upload time + 2 calendar months. Public access ends at expiry; scheduled Storage/API cleanup follows.';
COMMIT;
