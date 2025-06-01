# GlobalTalk Chat Application

A multilingual chat application with real-time translation capabilities using multiple AI services.

## Translation Services

GlobalTalk uses a fallback system for the most reliable translations:
1. DeepSeek AI via Hugging Face (primary)
2. Google Gemini (first fallback)
3. DeepL (second fallback)

## Features

### Tone Understanding for Translations
- Optional feature that analyzes the tone of messages before translation
- Preserves emotional context and nuance in translations
- Uses DeepSeek AI to detect message tone (formal, friendly, serious, etc.)
- Toggle on/off in the language selection dropdown

## Environment Setup

1. Copy `.env.example` to `.env`
2. Fill in your API keys and configuration values:
   - `HUGGINGFACE_API_KEY` - For DeepSeek AI translation service and tone analysis
   - `GEMINI_API_KEY` - For Google Gemini translation service
   - `DEEPL_API_KEY` - For DeepL translation service

## Deployment

### Vercel Deployment

1. **Install Vercel CLI** (if not already installed):
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Deploy to Vercel**:
   ```bash
   vercel
   ```

4. **Set Environment Variables in Vercel Dashboard**:
   - Go to your project settings in Vercel dashboard
   - Navigate to "Environment Variables"
   - Add all required variables:
     - `HUGGINGFACE_API_KEY`
     - `GEMINI_API_KEY`
     - `DEEPL_API_KEY`
     - `FIREBASE_API_KEY`
     - `FIREBASE_AUTH_DOMAIN`
     - `FIREBASE_PROJECT_ID`
     - `FIREBASE_STORAGE_BUCKET`
     - `FIREBASE_MESSAGING_SENDER_ID`
     - `FIREBASE_APP_ID`
     - `FIREBASE_MEASUREMENT_ID`
     - `CLOUDINARY_CLOUD_NAME`
     - `CLOUDINARY_API_KEY`
     - `CLOUDINARY_API_SECRET`
     - `NODE_ENV` (set to "production")

5. **Firebase Service Account**:
   - For Vercel, convert your `serviceAccountKey.json` to environment variables:
     - `FIREBASE_PRIVATE_KEY` (the private key from the JSON file)
     - `FIREBASE_CLIENT_EMAIL` (the client email from the JSON file)
     - `FIREBASE_PROJECT_ID` (same as above)

6. **Redeploy after setting environment variables**:
   ```bash
   vercel --prod
   ```

### Render Deployment (Alternative)

1. Go to your Render dashboard
2. Select your service
3. Navigate to the "Environment" tab
4. Add all required environment variables:
   - `PORT`
   - `HUGGINGFACE_API_KEY`
   - `GEMINI_API_KEY`
   - `DEEPL_API_KEY`
   - All `FIREBASE_*` variables
   - All `CLOUDINARY_*` variables
5. Click "Save Changes"

## Service Account Key

The Firebase service account key (`serviceAccountKey.json`) is not included in the repository for security reasons. For development:

1. Generate your own service account key from the Firebase console
2. Save it as `serviceAccountKey.json` in the project root

For Render deployment, you can either:
- Upload the file directly to Render, or
- Use environment variables for the service account credentials

## License

This project is licensed under the **Creative Commons Attribution 4.0 International License (CC BY 4.0)** - see the [LICENSE.md](LICENSE.md) file for details.

License valid until December 31, 2025.

Under this license, you are free to:
- Share — copy and redistribute the material in any medium or format
- Adapt — remix, transform, and build upon the material for any purpose, even commercially

Under the following terms:
- **Attribution** — You must give appropriate credit, provide a link to the license, and indicate if changes were made.

© 2023-2025 GlobalTalk Chat Application
