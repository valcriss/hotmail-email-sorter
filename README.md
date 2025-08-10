# 📧 Hotmail Email Sorter

An automatic email sorter for Hotmail/Outlook using AI to classify and organize your emails into appropriate folders.

## 🚀 Features

- **Microsoft Graph API Authentication** (secure OAuth2)
- **AI Classification** (local Ollama/LLM)
- **Automatic sorting** into custom folders
- **Dry-run mode** for testing without modifications
- **Full Hotmail/Outlook.com support**
- **Configurable logging system** with different levels
- **Configurable email limit** to control processing volume

## 📋 Prerequisites

### Required Software

1. **Node.js** (version 18+)
2. **Ollama** for local AI
   ```bash
   # Install Ollama (Linux/macOS)
   curl -fsSL https://ollama.ai/install.sh | sh
   
   # Or download from https://ollama.ai/download for Windows
   ```

3. **A Microsoft/Hotmail account**

## 🛠️ Installation

1. **Clone and install dependencies**
   ```bash
   git clone <your-repo>
   cd hotmail-imap-sorter
   npm install
   ```

2. **Copy configuration file**
   ```bash
   cp .env.example .env
   ```

## ⚙️ Configuration

### Step 1: Microsoft Azure Configuration (Required)

#### 1.1 Create an Azure application

1. Go to [Azure Portal](https://portal.azure.com)
2. Sign in with your Microsoft/Hotmail account
3. Search for **"App registrations"** in the search bar
4. Click **"New registration"**

#### 1.2 Basic settings

```
Name: Hotmail Email Sorter
Supported account types: ✅ Personal Microsoft accounts only
Redirect URI: (Leave empty for now)
```

Click **"Register"**

#### 1.3 Get the Client ID

1. In your application's **Overview** page
2. Copy the **"Application (client) ID"**
3. Paste it in `.env`:
   ```bash
   MICROSOFT_CLIENT_ID=your_client_id_here
   ```

#### 1.4 Configure permissions

1. Go to **"API permissions"**
2. Click **"Add a permission"**
3. Select **"Microsoft Graph"**
4. Choose **"Delegated permissions"**
5. Add these permissions:
   - `Mail.Read` - Read emails
   - `Mail.ReadWrite` - Modify/move emails
   - `offline_access` - Persistent access
6. Click **"Add permissions"**

#### 1.5 Configure authentication

1. Go to **"Authentication"**
2. Click **"Add a platform"**
3. Select **"Mobile and desktop applications"**
4. Add this Redirect URI:
   ```
   http://localhost:8080/callback
   ```
5. Click **"Configure"**

#### 1.6 Advanced configuration (Important)

1. In **"Authentication"** > **"Advanced settings"**
2. Find **"Allow public client flows"**
3. ✅ **Enable this option** (set to "Yes")
4. Click **"Save"**

> **Note:** This step is crucial to avoid the "client_secret required" error

#### 1.7 Optional Client Secret configuration

**For more secure applications (optional):**

1. Go to **"Certificates & secrets"**
2. Click **"New client secret"**
3. Add a description (e.g., "Hotmail Sorter Secret")
4. Choose an expiration (recommended: 24 months)
5. Click **"Add"**
6. **Immediately copy** the secret value (it won't be visible again)
7. If using a client secret:
   - Add it to `.env`: `MICROSOFT_CLIENT_SECRET=your_secret_here`
   - **Disable** "Allow public client flows" in Authentication

> **Note:** The client secret is not required if "Allow public client flows" is enabled

### Step 2: Ollama (AI) Configuration

#### 2.1 Start Ollama

```bash
# Start the Ollama service
ollama serve
```

#### 2.2 Install an AI model

```bash
# Option 1: Lightweight model (recommended)
ollama pull mistral:7b-instruct

# Option 2: More advanced model
ollama pull llama3.1:latest

# Option 3: Original project model
ollama pull qwen2:7b-instruct
```

#### 2.3 Configuration in .env

```bash
OLLAMA_HOST=http://localhost:11434
MODEL=mistral:7b-instruct  # or the installed model
```

### Step 3: Environment variables configuration

Edit the `.env` file with your values:

```bash
# Microsoft Graph API Configuration
MICROSOFT_CLIENT_ID=your_client_id_here                    # Required: Client ID from Azure App Registration
MICROSOFT_CLIENT_SECRET=                                   # Optional: Leave empty if "Allow public client flows" = Yes
MICROSOFT_TENANT_ID=consumers                              # For personal Microsoft accounts (Hotmail/Outlook.com)
MICROSOFT_REDIRECT_URI=http://localhost:8080/callback      # Must match Azure App Registration

# Ollama/AI Configuration
OLLAMA_HOST=http://localhost:11434                         # Ollama server URL
MODEL=mistral:7b-instruct                                  # AI model name

# Application Mode
DRY_RUN=1                                                  # 1 = test mode only, 0 = real sorting

# Logging Configuration (debug, info, warn, error)
LOG_LEVEL=info                                             # Default: info

# Email Processing Limit (default: 20)
EMAIL_LIMIT=20                                             # Maximum number of emails to process
```

### Detailed Microsoft environment variables

#### MICROSOFT_CLIENT_ID
- **Required**: Unique identifier of your Azure application
- **Where to find**: Azure Portal > App registrations > Overview > Application (client) ID
- **Format**: UUID (e.g., `12345678-1234-1234-1234-123456789abc`)

#### MICROSOFT_CLIENT_SECRET
- **Optional**: Application secret for enhanced security
- **When to use**: If you disable "Allow public client flows"
- **Where to find**: Azure Portal > App registrations > Certificates & secrets
- **⚠️ Important**: Do not expose publicly, add to `.gitignore`

#### MICROSOFT_TENANT_ID
- **Recommended value**: `consumers` for personal Hotmail/Outlook.com accounts
- **Alternatives**:
  - `common`: Personal AND business accounts
  - `organizations`: Business accounts only
  - `{tenant-guid}`: Specific tenant

#### MICROSOFT_REDIRECT_URI
- **Fixed value**: `http://localhost:8080/callback`
- **Must match**: Exactly the Azure configuration
- **Modification**: Possible, but must be updated in both Azure AND `.env`

## 🎮 Available Commands

### Test Mode (Dry Run)

```bash
npm run dry
```

1. Your browser will open automatically
2. Sign in with your Hotmail account
3. Accept the permissions
4. The application will analyze your emails without modifying them
5. You will see sorting decisions in the terminal

### Production Mode

```bash
# Enable real sorting
echo "DRY_RUN=0" >> .env

# Launch the application
npm start
```

⚠️ **Warning:** In production mode, emails will actually be moved!

### Advanced Configuration

#### Logging level control

```bash
LOG_LEVEL=debug npm run dry    # Verbose mode (all information)
LOG_LEVEL=info npm start       # Normal mode (important information)
LOG_LEVEL=warn npm start       # Quiet mode (warnings and errors)
LOG_LEVEL=error npm start      # Very quiet mode (errors only)
```

#### Limit the number of emails processed

By default, the application processes up to 20 emails. You can adjust this limit:

```bash
# In the .env file
EMAIL_LIMIT=50  # Process up to 50 emails

# Or directly via command line
EMAIL_LIMIT=10 npm run dry     # Test with only 10 emails
EMAIL_LIMIT=100 npm start      # Production with max 100 emails
```

**Recommended values:**
- `EMAIL_LIMIT=5`: Quick test with a few emails
- `EMAIL_LIMIT=20`: **Default** - Normal daily usage
- `EMAIL_LIMIT=50`: Medium volume processing
- `EMAIL_LIMIT=100`: Large inbox cleanup

#### Parameter combinations

```bash
# Detailed test with 10 emails
EMAIL_LIMIT=10 LOG_LEVEL=debug npm run dry

# Silent production with 100 emails
EMAIL_LIMIT=100 LOG_LEVEL=warn DRY_RUN=0 npm start

# Quick and quiet test
EMAIL_LIMIT=5 LOG_LEVEL=info npm run dry
```

## 📁 Classification Rules

The AI automatically classifies your emails according to these rules:

| Category | Action | Destination Folder | Examples |
|----------|--------|-------------------|----------|
| **Orders** | `move` | Orders | Amazon, e-commerce, purchase confirmations, deliveries |
| **Hotels and Travel** | `move` | Hotels and Travel | Booking, SNCF, airlines, Airbnb |
| **Advertisement** | `move` | Advertisement | Commercial newsletters, promotions, marketing |
| **Bills** | `move` | Bills | Bank, EDF, taxes, insurance, invoices |
| **Personal** | `move` | Personal | Friends, family, non-commercial personal emails |
| **Tech** | `move` | Tech | GitHub, Stack Overflow, tech training, Azure, development |

## 📝 Logging System

### Available log levels

| Level | Description | Content |
|-------|-------------|---------|
| `error` | Errors only | Connection failures, fatal errors |
| `warn` | Errors + warnings | + Non-critical issues, fallbacks |
| `info` | **Default** | + Important information, progress |
| `debug` | Verbose mode | + Technical details, complete debugging |

### Message format

All messages include a timestamp and emojis for easy reading:

```
[2025-08-10T10:30:00.000Z] [INFO] 🔐 Microsoft authentication...
[2025-08-10T10:30:01.000Z] [INFO] 📬 Retrieving unread emails (max 20)...
[2025-08-10T10:30:02.000Z] [INFO] 📊 5 unread emails found
[2025-08-10T10:30:03.000Z] [INFO] 📧 [AB123456] Email from Amazon
[2025-08-10T10:30:04.000Z] [INFO] 🤖 Decision: {category: "Orders", action: "move"}
[2025-08-10T10:30:05.000Z] [DEBUG] 🔍 Email moved: AB123456
```

### Log usage examples

```bash
# Normal startup with essential information
npm run dry

# Debug mode to identify issues
LOG_LEVEL=debug npm run dry

# Silent mode for production
LOG_LEVEL=warn npm start

# Quick test with minimal logging
EMAIL_LIMIT=3 LOG_LEVEL=error npm run dry
```

## 🔧 Troubleshooting

### "client_secret required" error

**Solution:** Enable "Allow public client flows" in Azure:
1. Azure Portal > your app > Authentication
2. Advanced settings > "Allow public client flows" = **Yes**
3. Save

### "Invalid LLM output" error

**Possible causes:**
1. Ollama is not started: `ollama serve`
2. Model not installed: `ollama pull mistral:7b-instruct`
3. Wrong model name in `.env`

**Diagnosis:**
```bash
# Check installed models
ollama list

# Test Ollama
curl http://localhost:11434/api/tags
```

### "AADSTS50011: No reply URL registered" error

**Solution:** Check Redirect URIs in Azure:
1. Authentication > Platform configurations
2. Mobile and desktop applications
3. Must contain: `http://localhost:8080/callback`

### Authentication not working

**Checks:**
1. Correct Client ID in `.env`
2. Permissions granted (Mail.Read, Mail.ReadWrite)
3. "Personal Microsoft accounts only" selected
4. Port 8080 free on your machine

### Log control for debugging

**For more debugging information:**
```bash
LOG_LEVEL=debug npm run dry
```

**To analyze a specific problem:**
```bash
# Test with few emails and detailed logs
EMAIL_LIMIT=3 LOG_LEVEL=debug npm run dry
```

### Slow performance

**Solutions:**
1. Reduce email limit: `EMAIL_LIMIT=10`
2. Use a lighter AI model
3. Check network connection
4. Ensure Ollama is working correctly

## 📜 Available Scripts

```bash
npm run build      # TypeScript compilation
npm run dry        # Test mode with Microsoft Graph API
npm start          # Production mode with Microsoft Graph API
npm test           # Alias for npm run dry
```

## 🏗️ Architecture

```
src/
├── main.ts        # Main application (Microsoft Graph API)
├── graph.ts       # Microsoft Graph client with OAuth2 authentication
├── llm.ts         # AI classification (Ollama)
└── logger.ts      # Configurable logging system
```

## 🔒 Security

- **OAuth2**: Modern authentication without passwords
- **Temporary tokens**: Time-limited access
- **Granular permissions**: Access only to emails
- **Local AI**: Your data stays on your machine
- **Open source code**: Complete transparency

## 📊 Usage Examples

### First test
```bash
# Start with a minimal test
EMAIL_LIMIT=3 LOG_LEVEL=debug npm run dry
```

### Daily usage
```bash
# Configuration in .env for regular usage
EMAIL_LIMIT=20
LOG_LEVEL=info
DRY_RUN=0

# Then simply
npm start
```

### Inbox cleanup
```bash
# Preliminary test with large volume
EMAIL_LIMIT=100 npm run dry

# If satisfied, switch to production
EMAIL_LIMIT=100 npm start
```

### Problem debugging
```bash
# Detailed analysis of a small number of emails
EMAIL_LIMIT=5 LOG_LEVEL=debug npm run dry
```

## 📝 License

ISC License

## 🆘 Support

In case of problems:

1. Check Azure configuration (troubleshooting section)
2. Test Ollama: `ollama list`
3. Use debug mode: `LOG_LEVEL=debug npm run dry`
4. Reduce email limit: `EMAIL_LIMIT=5`
5. Check logs in the terminal

---

**Note:** This application uses Microsoft Graph API for better compatibility and security with Hotmail/Outlook.com.
