-- Allow Request Files email template to be managed in Admin > Email templates
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'request_files' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'email_trigger_type')) THEN
    ALTER TYPE email_trigger_type ADD VALUE IF NOT EXISTS 'request_files';
  END IF;
END $$;
