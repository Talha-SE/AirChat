# GlobalTalk Chat Application

A multilingual chat application with real-time translation capabilities using multiple AI services.

## Translation Services

GlobalTalk uses a fallback system for the most reliable translations:
1. DeepSeek AI via Hugging Face (primary)
2. Google Gemini (first fallback)
3. DeepL (second fallback)

## Environment Setup

1. Copy `.env.example` to `.env`
2. Fill in your API keys and configuration values:
   - `HUGGINGFACE_API_KEY` - For DeepSeek AI translation service
   - `GEMINI_API_KEY` - For Google Gemini translation service
   - `DEEPL_API_KEY` - For DeepL translation service

### For Render Deployment:

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
