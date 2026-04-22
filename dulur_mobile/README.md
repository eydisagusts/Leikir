# Dulur Mobile App

Welcome to the Dulur Mobile App repository! This project is the native companion to the Dulur web platform, bringing the Icelandic puzzle experience directly to iOS and Android devices.

## 🛠 Tech Stack

- **Framework**: [Expo](https://expo.dev/) (React Native) + [Expo Router](https://docs.expo.dev/router/introduction/)
- **Styling**: [NativeWind](https://www.nativewind.dev/) (Tailwind CSS for React Native)
- **Database & Auth**: [Supabase](https://supabase.com/)
- **Animations**: React Native Reanimated & React Native SVG
- **Deployment**: [EAS (Expo Application Services)](https://expo.dev/eas)

---

## 🚦 Getting Started

### 1. Prerequisites
Ensure you have the following installed on your machine:
- Node.js (v18+)
- [EAS CLI](https://github.com/expo/eas-cli) (`npm install -g eas-cli`)
- iOS Simulator (via Xcode) or Android Emulator (via Android Studio)

### 2. Installation
Run the following commands to install dependencies:
```bash
npm install
```

### 3. Environment Variables
Create a `.env` file in the root of `dulur_mobile`. You will need to map the Supabase URLs and API urls from the production environment:
```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EXPO_PUBLIC_API_URL=https://dulur.is
```

### 4. Running Locally
To start the Expo development server:
```bash
npx expo start
```
Press `i` to open in the iOS simulator, or `a` to open in the Android emulator.

---

## 🔐 Authentication

Dulur mobile uses **Supabase Native Authentication**:
- **Apple Sign-In**: Powered by `expo-apple-authentication` and Supabase's `signInWithIdToken` for seamless, native biometric login.
- **Google / Facebook**: Uses `expo-auth-session` and `WebBrowser` to handle dynamic OAuth callbacks via `Linking.createURL('auth')`.

> **Important**: Apple Sign-In is a pure native module. It cannot be tested via standard "Expo Go" without a development build.

---

## 🎮 Game Architecture

All native game screens are located under `app/game/native/`.
- **`MobileGameLayout.tsx`**: The foundational wrapper for all games. It handles the universal back button, settings dropdown, safe area spacing, responsive tablet scaling, and common headers.
- **`NativeGameEndModal.tsx`**: The consistent victory screen that displays XP gains and completion messages.

If you add a new game:
1. Create the screen under `app/game/native/YOUR_GAME.tsx`
2. Wrap it entirely with `<MobileGameLayout>`
3. Emit global events like `DeviceEventEmitter.emit('xp-earned', amount)` to sync UI navigation badges.

---

## 🚀 Deployment & Updates

This app uses EAS for both physical builds (App Store) and Over-The-Air (OTA) JavaScript updates.

### Over-The-Air (OTA) Updates
If you only changed JavaScript, TypeScript, or CSS files, you **do not** need to submit a new app to Apple. Run an OTA update:
```bash
eas update --branch production --message "Description of fix"
```
Users will automatically download the patch the next time they launch the app.

### Submitting to App Store Connect (New Build)
If you add new libraries to `package.json`, modify `app.json` (like Entitlements), or change native assets, you **must** build a new `.ipa`:
```bash
eas build --platform ios
eas submit -p ios
```
Select the latest build when prompted to send it directly to TestFlight & Apple Review.
