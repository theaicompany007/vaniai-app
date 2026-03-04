---
name: Owner role and invite users
overview: Introduce Owner/Admin/Member roles, invite flow for Owner and Admin, and email validation and confirmation for future org creators only. Existing users (e.g. rajvins@theaicompany.co) get a one-time role backfill to Owner with no re-verification.
todos: []
isProject: false
---

# Platform Owner role + Admin invite users

## Your situation

- You created the account (signed up, not invited); the app created an org and gave you `role: 'admin'` in `org_memberships`.
- `organizations.owner_user_id` is already set to your user id in [auth/callback](src/app/auth/callback/route.ts) when the org is created.
- You want a clear **Platform Owner** (or Super User) distinct from **Admin**, so the person who created the org has full control.

## Recommended model: Owner | Admin | Member


| Role       | Who gets it                   | Can invite | Can manage team (change role, remove) | Can delete org / transfer ownership |
| ---------- | ----------------------------- | ---------- | ------------------------------------- | ----------------------------------- |
| **Owner**  | Org creator only (first user) | Yes        | Yes                                   | Yes (only Owner)                    |
| **Admin**  | Invited or promoted by Owner  | Yes        | Yes (except demote/remove Owner)      | No                                  |
| **Member** | Invited or default            | No         | No                                    | No                                  |


- **Owner** = Platform Owner. One per org; the user who created the org.
- **Admin** = Can do everything except delete org and transfer ownership.
- **Member** = Normal user.

No separate "Super User" table: we use `org_memberships.role` and treat `organizations.owner_user_id` as the canonical owner for destructive actions (delete org, transfer ownership).

---

## 1. Schema and data

**1.1 Allow `role = 'owner'` in org_memberships**

- In [supabase/schema.sql](supabase/schema.sql), document or enforce that `org_memberships.role` is one of `'owner' | 'admin' | 'member'` (today it's only `'admin'|'member'`). No structural change required if the column is plain text; just use `'owner'` in code.

**1.2 Set first user as Owner when org is created**

- In [src/app/auth/callback/route.ts](src/app/auth/callback/route.ts), when creating the first membership for the new org, set `role: 'owner'` instead of `role: 'admin'` (line 56). Keep `owner_user_id` on the org as is.

**1.3 Backfill existing orgs (you and any other creators)**

- One-time migration or script: for each org, set `org_memberships.role = 'owner'` where `user_id = organizations.owner_user_id`. Run once so your account (e.g. [rajvins@theaicompany.co](mailto:rajvins@theaicompany.co)) and any other org creators become Owner.
- **Existing users are left unchanged:** no re-verification, no forced email confirmation, no breaking changes. We only update their role from `admin` to `owner`. All new checks below apply only to **future** org creators.

---

## 2. API: who can do what

**2.1 Expose current user role (and “is owner”)**

- In [src/app/api/settings/members/route.ts](src/app/api/settings/members/route.ts), extend **GET** so the response includes the **current user’s role** for this org (e.g. add `current_user_role: 'owner' | 'admin' | 'member'`). Derive from the same org_memberships row used for auth. Optionally also `is_owner: boolean` (true if `user_id === org.owner_user_id` or `role === 'owner'`).

**2.2 Invite endpoint: only Owner or Admin**

- In **POST /api/settings/members/invite** (new file), after `requireAuth()`, load the requester’s membership for `ctx.orgId` and ensure `role` is `'owner'` or `'admin'`. If not, return 403. Then implement the rest of the invite flow (pending_invites, email, etc.) as in the previous plan.

**2.3 Destructive actions (later)**

- For “delete org” or “transfer ownership”, enforce that the requester is the org owner: either `org.owner_user_id === ctx.userId` or the membership row has `role === 'owner'`. Not part of the invite task but good to align with this model.

---

## 3. UI: show Owner and gate Invite

**3.1 Team Members list**

- In [src/app/settings/page.tsx](src/app/settings/page.tsx) (UserSettings), when rendering the role badge, if `m.role === 'owner'` show **“Owner”** or **“Platform owner”** (and a distinct style, e.g. same as current admin pill or a different one). Keep “Admin” and “Member” for the other two.

**3.2 Invite button**

- Fetch or pass `current_user_role` from the members API. Show **“Invite member”** only if `current_user_role === 'owner' || current_user_role === 'admin'`. If you already have `current_user_role` in the GET response, use that; no need for a separate “me” endpoint unless you prefer it.

---

## 4. Invite flow (unchanged from earlier plan)

- **pending_invites** table (email, org_id, role, token, expires_at).
- **POST /api/settings/members/invite** (admin-only as above): create invite, send email with link.
- **POST /api/settings/members/accept-invite**: consume token, add org_memberships (role = invited role), delete invite.
- **/auth/accept-invite** page: require auth, call accept-invite, redirect to /home.
- New members get role **member** or **admin** (never owner via invite); only the org creator is owner.

---

## 5. Email validation for future org creators only

**Scope:** These checks apply only to **new** signups and org creation. Existing users (e.g. [rajvins@theaicompany.co](mailto:rajvins@theaicompany.co)) are not re-verified or changed.

**5.1 Email format validation**

- Validate email format (e.g. RFC-style or a simple regex) in:
  - **POST /api/auth/signup** – reject invalid format before calling Supabase.
  - **POST /api/auth/create-org** – if email is still accepted in body, validate format.
  - **POST /api/settings/members/invite** – validate invitee email format.
- Optional: same validation on the client (signup and invite forms) for immediate feedback.

**5.2 Create-org: use authenticated user’s email**

- **POST /api/auth/create-org** must not trust email from the request body for “who is the creator”.
- Require a valid session (e.g. verify session cookie or token server-side). Read the creator’s email from the **authenticated user** (Supabase auth.getUser() or session). Use that email when creating the org, sending welcome, and for owner_user_id. If the client sends org_name/website, still use server-side email for the owner. This avoids mismatches (e.g. typo or wrong email in request).

**5.3 Email confirmation before org creation (recommended)**

- In **Supabase**: enable “Confirm email” for email/password auth so new users receive a confirmation link.
- In the app (email/password flow):
  - After **signUp**, if the user is not yet confirmed (`!data.session`), do **not** call create-org. Show “Check your email (e.g. [you@company.com](mailto:you@company.com)) to confirm, then sign in.” and stop.
  - Create the org only when the user **returns after confirming** (e.g. they sign in after clicking the link). That can be: (a) in the auth callback after sign-in, or (b) on first successful login after signup, check “user has no org and email is confirmed” then create org (or redirect to a “Complete setup” page that creates org). Ensure the flow uses the session’s email (server-side) for the org creator.
- **OAuth** (Google): no change; provider already verifies email. Continue creating org in callback for OAuth users with no org.

**5.4 Existing users**

- Do not require existing org creators to confirm email again or re-validate. Backfill (1.3) only updates role to `owner`. No extra checks for users who already have an org.

---

## 6. Summary of changes


| Item                      | Action                                                                  |
| ------------------------- | ----------------------------------------------------------------------- |
| Auth callback             | Set first membership to `role: 'owner'`                                 |
| Schema / backfill         | Use role `owner`; backfill existing orgs; **existing users unchanged**  |
| GET /api/settings/members | Return `current_user_role` (and optionally `is_owner`)                  |
| POST .../invite           | Require role in `['owner','admin']`; validate email format; invite flow |
| POST .../accept-invite    | Consume token, insert org_memberships                                   |
| accept-invite page        | Auth + call accept-invite + redirect                                    |
| Settings UI               | Show Owner badge; show Invite only for owner/admin                      |
| email.ts                  | Add sendInviteEmail                                                     |
| **Signup / create-org**   | **Future only:** email format validation; create-org uses session email |
| **Email confirmation**    | **Future only:** enable in Supabase; create org only after confirm      |


This gives you a clear **Platform Owner** (you, for your org), keeps existing users like [rajvins@theaicompany.co](mailto:rajvins@theaicompany.co) untouched (except role backfill to owner), and applies email validation and confirmation only to **future** org creators.