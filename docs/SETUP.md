# Production setup

About 25 minutes, done once by an admin. Everything fits in the free Firebase **Spark** plan.

## 1. Firebase project
1. In the [Firebase console](https://console.firebase.google.com), create a project (Analytics not needed).
2. **Build → Firestore Database → Create database**: Standard edition, a region close to your team, **production mode**.
3. **Build → Authentication → Get started → Google → Enable** (set a public name and support e-mail).
4. **Project settings → General → Your apps → Web (`</>`)**: register an app and copy `apiKey` and `projectId`.

## 2. Security rules
Edit the domain regex and brand list in `firebase/firestore.rules`, paste it in **Firestore → Rules** and **Publish**.

## 3. Admins
In **Firestore → Data**, create the collection `admins`. For each admin add a document whose ID is the exact e-mail, with the field `role` = `admin`. Everyone else is an operator (can log and view, cannot edit or delete).

## 4. Load the extension and get its ID
`chrome://extensions` → **Developer mode** → **Load unpacked** → select `extension/`. Copy the extension **ID**.

> The ID of an unpacked extension depends on the folder path. Before rolling out to several machines, pin it with a `"key"` in `manifest.json` or publish it privately on the Chrome Web Store.

## 5. OAuth client
1. In [Google Cloud → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials), open **Web client (auto created by Google Service)**.
2. Under **Authorized redirect URIs**, add `https://<EXTENSION-ID>.chromiumapp.org/` and save. Copy the **Client ID**.
3. **Google Auth Platform → Audience**: *Internal* if all users share one Google Workspace; *External* + *In production* if they span several domains (the rules still restrict access).
4. Firebase → **Authentication → Settings → Authorized domains**: add `<EXTENSION-ID>.chromiumapp.org`.

## 6. Configure
In `extension/src/config.js` set `MODE: 'firebase'`, `apiKey`, `projectId`, `GOOGLE_OAUTH_CLIENT_ID` and `ALLOWED_DOMAINS`, then click **Reload** in `chrome://extensions`. Keep this file out of public repositories.

## 7. Google Sheets mirror (optional)
1. In the spreadsheet: **Extensions → Apps Script**, paste `apps-script/Code.gs` and set `PROJECT_ID`.
2. Show `appsscript.json` in the project settings and paste `apps-script/appsscript.json`.
3. Run `installTrigger` once and authorize. "Data (auto)" and "Summary (auto)" refresh every hour.
