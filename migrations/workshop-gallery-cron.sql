-- Prerequisites: deploy purge-expired-games with JWT verification enabled.
-- Store current project URL and service_role JWT in Vault under the exact names below.
-- Secrets must be set privately by the deployer; never commit keys to this file.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'workshop_project_url')
     OR NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'workshop_cleanup_service_key') THEN
    RAISE EXCEPTION 'Configure workshop_project_url and workshop_cleanup_service_key in Vault first';
  END IF;
END $$;

SELECT cron.schedule(
  'purge-expired-workshop-games',
  '17 * * * *',
  $job$
    SELECT net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'workshop_project_url') || '/functions/v1/purge-expired-games',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'workshop_cleanup_service_key')
      ),
      body := '{"dryRun":false}'::jsonb,
      timeout_milliseconds := 120000
    );
  $job$
);
