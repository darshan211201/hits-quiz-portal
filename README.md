# HITS Quiz Portal - Clean Rebuild

A clean Next.js + Firebase live quiz platform for department-wise or common quiz events.

## What changed

- Removed Fun With Maths branding
- Removed default maths questions
- Clean structure: only root `app/`, no duplicate `src/`
- Admin can add quiz questions manually
- Admin can set quiz title, subject/event name, department, and duration
- Live leaderboard and Excel export included
- Firebase Firestore realtime database support

## Local Run

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Vercel Environment Variables

Add these in Vercel Project Settings → Environment Variables:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_ADMIN_PASSWORD=hits2026
```

## Firebase Firestore Rules for testing

Use only for event testing:

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

## Deploy

1. Create new GitHub repository
2. Upload all files from this folder
3. Import repo in Vercel
4. Add Firebase environment variables
5. Deploy
