# Going Live: Setup Checklist

The app now stores data in a shared cloud database (Supabase) and requires
sign-in. Follow these steps once to get it live. Everything here is on free
tiers — no credit card needed.

## 1. Create the Supabase project (~5 min)

1. Go to [supabase.com](https://supabase.com) and sign up (GitHub login is easiest).
2. Click **New project**. Name it `no2vance`, pick a strong database password
   (save it somewhere safe — you rarely need it, but don't lose it), choose the
   region closest to you, and create.
3. When it finishes provisioning, open **SQL Editor** in the left sidebar,
   click **New query**, paste the entire contents of
   [`supabase/schema.sql`](supabase/schema.sql) from this repo, and click **Run**.
   You should see "Success. No rows returned."

## 2. Lock down sign-ups and invite your team (~3 min)

1. In the Supabase dashboard go to **Authentication → Sign In / Providers**
   and turn **off** "Allow new users to sign up". This means only people you
   invite can ever get an account — important since the site will be on the
   public internet.
2. Go to **Authentication → Users → Add user → Create new user** and create
   an account (email + password) for yourself and each teammate. Tell them
   their password; they can't self-register.

## 3. Connect the app locally (~2 min)

1. In the Supabase dashboard go to **Project Settings → API** (or
   **Project Settings → Data API** depending on dashboard version).
2. Copy the **Project URL** and the **anon / public** key.
3. Open `.env.local` in this project and replace the placeholder values:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR-ANON-KEY
   ```

4. Run `npm run dev`, open http://localhost:3000, and sign in with the
   account you created in step 2.

## 4. Move your existing data in (~1 min, one time)

From the browser you've been using the app in (the one with all your
bookings), sign in and go to the **Import** page. A yellow "Move Local Data
to the Cloud" card will be at the top — click **Move Data to Cloud**. That
pushes every booking, customer, vendor, and custom event type into the
shared database. It only appears in browsers that have old local data.

## 5. Deploy to Vercel (~5 min)

1. Push this repo to GitHub if it isn't there yet.
2. Go to [vercel.com](https://vercel.com), sign up with GitHub, click
   **Add New → Project**, and import the `no2vance` repo. Vercel detects
   Next.js automatically.
3. Before clicking Deploy, expand **Environment Variables** and add the same
   two variables from step 3 (`NEXT_PUBLIC_SUPABASE_URL` and
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
4. Deploy. You'll get a URL like `no2vance.vercel.app` — share it with your
   team. Every push to `main` on GitHub auto-deploys from now on.

## 6. Contract links (one time, when you're ready to send agreements)

The contract acceptance page is opened by customers who have no account here,
so it can't use the normal signed-in database access. It reads through the
server with a separate key instead.

1. **Run the migration.** Supabase dashboard → **SQL Editor → New query**,
   paste the contents of
   [`supabase/002-contract-links.sql`](supabase/002-contract-links.sql), Run.
   This adds the contract fields to bookings and creates the two tables that
   hold links and acceptances. Safe to run twice.

2. **Get the service role key.** Supabase dashboard → **Project Settings →
   API**. Under "Project API keys" copy the **`service_role`** key — *not* the
   anon key you used earlier.

   This key bypasses all database security. Never paste it into the app's
   code, a browser, or anywhere public. It belongs only in the two places
   below.

3. **Add it locally.** In `.env.local`, add a third line:

   ```
   SUPABASE_SERVICE_ROLE_KEY=YOUR-SERVICE-ROLE-KEY
   ```

   Note there is no `NEXT_PUBLIC_` prefix. That prefix is what makes a value
   visible in the browser, and this one must not be.

4. **Add it to Vercel.** Project → **Settings → Environment Variables** → add
   `SUPABASE_SERVICE_ROLE_KEY` with the same value, then redeploy.

Once that's done, a booking with its event details, rate, and deposit filled in
gets a **Create contract link** button in the Contract section. The link works
for anyone who opens it, so treat it like a private share link.

## Ongoing: backups

Until you upgrade Supabase to Pro, there are no automatic database backups.
**Once a week**, open the **Import** page and click **Download Full Backup
(JSON)**. Keep the file somewhere safe (e.g. a cloud drive folder).

Two free-tier quirks to know:

- Supabase **pauses** free projects after ~1 week with no traffic. Nothing is
  lost — you just click "Restore" in the dashboard and wait a minute. Normal
  weekly use keeps it awake.
- When you're ready for automatic daily backups, point-in-time recovery, and
  no pausing: Supabase dashboard → **Settings → Billing** → upgrade the
  project to Pro ($25/mo). No code changes needed.
