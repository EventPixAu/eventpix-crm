UPDATE auth.users
SET encrypted_password = crypt('EPX1300850021', gen_salt('bf')),
    updated_at = now()
WHERE email = 'admin@eventpix.com.au';