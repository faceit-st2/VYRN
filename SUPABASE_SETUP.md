# Supabase setup

The browser contains only the Supabase project URL and publishable key. Telegram identity is verified against Telegram's production Ed25519 public key in the Edge Function. The Telegram bot token and Supabase service-role key must never be added to frontend files.

1. In the Supabase SQL Editor for project `umhrceixwdakatnozccz`, run [`supabase/schema.sql`](supabase/schema.sql).
2. Install the Supabase CLI and run these commands from the project directory:

   ```powershell
   supabase link --project-ref umhrceixwdakatnozccz
   supabase functions deploy telegram-auth
   ```

Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to the deployed function. The function verifies Telegram `initData` and calls a restricted database RPC. New profiles receive 100 stars and an empty NFT array. Subsequent logins preserve the saved balance, profile fields, and NFTs.

The integration runs only inside Telegram Mini Apps and only when `Telegram.WebApp.initData` is present. A regular browser preview does not authenticate or create a database row. Telegram's Ed25519 verification uses bot ID `8800928224`, which must match the bot that owns the Mini App.
