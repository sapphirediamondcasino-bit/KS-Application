# KS Bot Roblox Studio Plugin Setup Guide

## Overview
This guide explains how to set up the KS Bot Studio plugin to integrate your Roblox game with the Discord application bot.

## Prerequisites

### 1. Bot Backend Requirements
- ✅ Node.js server running (your Express API)
- ✅ API server accessible at: `https://api.ksbot.com/api/roblox` (or your configured URL)
- ✅ Database tables set up for:
  - `roblox_links.js` - Group/game connections
  - `submissions.js` - Application submissions
  - `sync_queue.js` - Role synchronization queue
- ✅ Environment variables configured:
  ```bash
  ROBLOX_COOKIE=your_cookie_here
  ENCRYPTION_KEY=your_hex_key_here
  API_KEY_SALT=your_salt_here
  ```

### 2. Roblox Requirements
- Roblox Studio installed
- A Roblox group (you must be the owner)
- One or more Roblox games (places)
- HTTP requests enabled for your game

---

## Step 1: Install the Studio Plugin

### Option A: From File
1. Save `KSBotPlugin.lua` to your computer
2. In Roblox Studio, go to **Plugins** → **Plugins Folder**
3. Create a new folder called `KSBot`
4. Place the `KSBotPlugin.lua` file inside
5. Restart Roblox Studio

### Option B: Via Studio Plugin Manager
1. In Studio, go to **View** → **Plugin Manager**
2. Click **Install Plugin**
3. Select the `KSBotPlugin.lua` file
4. Enable the plugin

---

## Step 2: Configure Discord Bot Integration

### 2.1 Set Up Roblox Link in Discord

Run this command in your Discord server:
```
/dashboard roblox setup
```

This will:
- Create a Roblox link entry in your database
- Generate an API key for your server
- Prompt you for your Roblox Group ID

### 2.2 Add Your Game's Place ID

After setup, add your game's Place ID:
```
/dashboard roblox add-place [place_id]
```

You can find your Place ID by:
- Opening your game in Studio
- Going to **Home** → **Game Settings** → **Basic Info**
- Looking at the URL or Place ID field

### 2.3 Get Your API Key

To get your API key for the plugin:
```
/dashboard roblox api-key
```

The bot will send you the API key **privately**. Save this - you'll need it for the plugin.

---

## Step 3: Configure the Plugin in Studio

### 3.1 Open Plugin Configuration

1. Open your game in Roblox Studio
2. Click the **KS Bot** toolbar button (or find it under Plugins)
3. Click **Configure**

### 3.2 Enter API Key

1. Paste your API key from Discord into the "API Key" field
2. Click **Test Connection**
3. Wait for verification ✅

If you see "Connected successfully!", proceed to the next step.

### 3.3 Generate In-Game Code

1. Click **Generate In-Game Code**
2. The plugin will automatically create:
   - `ReplicatedStorage/KSBot/Config` - Contains your API configuration
   - `ReplicatedStorage/KSBot/API` - API client module
   - `ReplicatedStorage/KSBot/UIHandler` - UI management
   - `ServerScriptService/KSBotServer` - Server validation script
   - `StarterPlayer/StarterPlayerScripts/KSBotClient` - Client script

---

## Step 4: Verify Group Ownership

### 4.1 Start Verification

In Discord, run:
```
/dashboard roblox verify
```

The bot will give you a verification code like: `KS_VERIFY_ABC12345`

### 4.2 Add Code to Group Description

1. Go to your Roblox group page
2. Click **Configure Group** (must be group owner)
3. Add the verification code **anywhere** in the group description
4. Click **Save**

### 4.3 Complete Verification

Back in Discord, click the **Verify** button (or run the command again)

If successful, you'll see: ✅ "Group ownership verified successfully!"

---

## Step 5: Configure Application Templates

### 5.1 Enable Templates for Roblox

By default, templates are Discord-only. To enable for Roblox:

```
/dashboard roblox enable-template [template_name]
```

This allows players to submit applications from inside your game.

### 5.2 Set Up Role Mappings (Optional)

If you want approved applications to automatically set Roblox ranks:

```
/dashboard roblox map-role [template_name] [discord_role] [roblox_rank]
```

Example:
```
/dashboard roblox map-role "Staff Application" @Staff 100
```

When someone's staff application is approved:
- They get the Discord @Staff role
- They automatically get rank 100 in your Roblox group

---

## Step 6: Enable HTTP Requests in Game

### 6.1 Game Settings

1. In Studio, go to **Home** → **Game Settings**
2. Navigate to **Security**
3. Enable **Allow HTTP Requests**
4. Click **Save**

### 6.2 Publish Your Game

The plugin's generated code will only work in published games:

1. Click **File** → **Publish to Roblox**
2. Choose your game
3. Click **Publish**

---

## Step 7: Test In-Game Integration

### 7.1 Start a Test Server

1. In Studio, click **Test** → **Play**
2. Wait for the server to start
3. Check the Output window for:
   ```
   KS Bot: Connected successfully!
   Server: [your_server_id]
   Templates available: [count]
   ```

### 7.2 Test Application UI

In the game, press **F** (default keybind) to open the applications menu.

You should see all enabled templates listed.

### 7.3 Submit Test Application

1. Click on a template
2. Fill out the questions
3. Click **Submit**
4. Check Discord - the application should appear in your review channel

---

## Configuration Reference

### API Endpoints Used

```
GET  /api/roblox/validate/status
POST /api/roblox/validate
GET  /api/roblox/templates
GET  /api/roblox/templates/:id
POST /api/roblox/templates/check-eligibility
POST /api/roblox/submit
GET  /api/roblox/submit/status/:userId
GET  /api/roblox/notify/poll/:userId
```

### Generated Code Structure

```
ReplicatedStorage
└── KSBot
    ├── Config          (API URL, API Key, Place ID)
    ├── API             (HTTP request handler)
    └── UIHandler       (Application UI creator)

ServerScriptService
└── KSBotServer         (Validates connection on startup)

StarterPlayer/StarterPlayerScripts
└── KSBotClient         (Creates UI, handles input)
```

### Environment Variables Needed

```env
# In your Node.js backend (.env file)
ROBLOX_COOKIE=_|WARNING:-DO-NOT-...    # For rank changes
ENCRYPTION_KEY=64_hex_characters        # For API security
API_KEY_SALT=your_random_salt           # For hashing
```

---

## Troubleshooting

### "Connection failed" Error

**Possible causes:**
- API server not running
- Incorrect API key
- HTTP requests not enabled
- Game not published

**Solutions:**
1. Verify API server is running: `npm start` or `node index.js`
2. Check API key is correct (regenerate if needed)
3. Enable HTTP requests in Game Settings
4. Publish your game to Roblox

### "Templates not loading" Error

**Possible causes:**
- Templates not enabled for Roblox
- Server not linked properly
- Database connection issues

**Solutions:**
1. Run `/dashboard roblox enable-template [name]` for each template
2. Verify link with `/dashboard roblox status`
3. Check backend logs for database errors

### "Group not verified" Error

**Solutions:**
1. Re-run verification: `/dashboard roblox verify`
2. Ensure verification code is in group description
3. You must be the group owner
4. Code expires after 10 minutes - get a new one if needed

### "User already has pending sync" Error

**Solutions:**
1. Check sync queue: `/dashboard roblox sync-status`
2. Cancel pending syncs: `/dashboard roblox cancel-sync [user_id]`
3. Wait for current sync to complete (~30 seconds)

### Rate Limiting Issues

If you see "Rate limited" errors:
1. The API has built-in rate limiting (60 requests/minute)
2. Reduce polling frequency in your game
3. Implement caching for template data
4. Spread out API calls over time

---

## Advanced Configuration

### Custom UI Keybind

To change the default F key, edit `KSBotClient`:

```lua
-- Change Enum.KeyCode.F to your preferred key
if input.KeyCode == Enum.KeyCode.E then
    appUI.Visible = not appUI.Visible
end
```

### Auto-Open UI on Join

Add to `KSBotClient` after UIHandler initialization:

```lua
-- Show UI automatically when player joins
wait(3) -- Wait 3 seconds for player to load
appUI.Visible = true
```

### Custom Application Button

Instead of keyboard shortcut, create a button:

```lua
-- In your GUI script
local button = script.Parent
button.MouseButton1Click:Connect(function()
    local appUI = player.PlayerGui:FindFirstChild("KSBotApplications")
    if appUI then
        appUI.MainFrame.Visible = not appUI.MainFrame.Visible
    end
end)
```

### Notification System

To show in-game notifications when applications are reviewed:

```lua
-- In KSBotClient, add polling
local function pollNotifications()
    while true do
        wait(60) -- Check every minute
        local success, result = API:GetApplicationStatus(player.UserId)
        if success and result.status ~= "pending" then
            -- Show notification to player
            print("Application", result.status .. "!")
        end
    end
end

spawn(pollNotifications)
```

---

## Security Best Practices

### ⚠️ Never Expose API Keys

- **DO NOT** hardcode API keys in client scripts
- **DO NOT** send API keys to clients
- **ALWAYS** keep API keys in server-side code only

The generated Config module is in ReplicatedStorage for convenience, but in production:

1. Move Config to ServerStorage or ServerScriptService
2. Use RemoteEvents/Functions for client-server communication
3. Validate all requests on the server

### Rate Limiting

The backend implements automatic rate limiting:
- 60 requests per minute per endpoint
- 5 application submissions per hour per user
- Cooldowns configurable per template

### Request Signing

For enhanced security, implement request signatures:

```lua
-- In API module, add signature
local HttpService = game:GetService("HttpService")
local timestamp = os.time()
local signature = HttpService:GetHashAsync(
    requestData.Body .. timestamp,
    Enum.HashAlgorithm.SHA256
)

requestData.Headers["X-Request-Signature"] = signature
```

---

## Maintenance

### Updating the Plugin

When you update the backend API:

1. Update plugin version in Studio
2. Regenerate in-game code
3. Publish updated game
4. Test thoroughly in Studio first

### Monitoring

Check these regularly:

- Application submission rate: `/dashboard applications stats`
- Sync queue status: `/dashboard roblox sync-status`
- API usage: Check backend logs
- Error rates: Monitor Discord error channel

### Database Cleanup

Run periodic cleanup:

```bash
# In your backend
node scripts/cleanup.js --submissions --days 90
node scripts/cleanup.js --sync-jobs --hours 24
```

---

## Support & Resources

### Documentation Links

- Main bot docs: Check your bot's documentation
- Roblox API: https://create.roblox.com/docs/reference/engine
- HTTP Service: https://create.roblox.com/docs/reference/engine/classes/HttpService

### Common Commands

```
/dashboard roblox status          - View current setup
/dashboard roblox api-key         - Get API key
/dashboard roblox add-place       - Add game to link
/dashboard roblox enable-template - Enable template for Roblox
/dashboard roblox map-role        - Set up role syncing
/dashboard roblox sync-status     - Check sync queue
```

### Getting Help

If you encounter issues:

1. Check the Output window in Studio for errors
2. Check backend logs: `npm run logs` or check log files
3. Verify all prerequisites are met
4. Review this guide step-by-step

---

## Checklist

Before going live, ensure:

- [ ] Backend API server is running and accessible
- [ ] API key generated and tested
- [ ] Group ownership verified
- [ ] HTTP requests enabled in game settings
- [ ] Game published to Roblox
- [ ] Templates enabled for Roblox
- [ ] Role mappings configured (if using auto-sync)
- [ ] Tested application submission in-game
- [ ] Tested application review in Discord
- [ ] Tested role synchronization (if enabled)
- [ ] Monitoring and logging set up

---

**Version:** 1.0.0  
**Last Updated:** 2025  
**Compatibility:** Roblox Studio 2024+, KS Bot v2.0+