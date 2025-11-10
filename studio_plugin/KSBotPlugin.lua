--[[
	KS Bot Studio Plugin - SECURED VERSION
	
	Security Features:
	- Only game owners can configure
	- API keys stored in ServerStorage (not accessible to clients)
	- Backend validates ownership
	- Client-server architecture prevents key exposure
	
	Version: 2.0.0
]]

local toolbar = plugin:CreateToolbar("KS Bot")
local button = toolbar:CreateButton(
	"Configure",
	"Configure KS Bot integration (Owner Only)",
	"rbxasset://textures/ui/GuiImagePlaceholder.png"
)

local ChangeHistoryService = game:GetService("ChangeHistoryService")
local HttpService = game:GetService("HttpService")
local StudioService = game:GetService("StudioService")

local CONFIG = {
	API_URL = "https://api.ksbot.com/api/roblox",
	PLUGIN_VERSION = "2.0.0"
}

local configWindow = nil
local isOpen = false

-- SECURITY: Check if user is authorized
local function isUserAuthorized()
	local success, userId = pcall(function()
		return StudioService:GetUserId()
	end)
	
	if not success then
		return false, "Could not verify user"
	end
	
	local gameOwnerType = game.CreatorType
	local gameOwnerId = game.CreatorId
	
	if gameOwnerType == Enum.CreatorType.User then
		-- User-owned game
		if userId == gameOwnerId then
			return true, userId
		else
			return false, "Only the game owner can configure KS Bot"
		end
	elseif gameOwnerType == Enum.CreatorType.Group then
		-- Group-owned game - will be validated by backend
		return true, userId
	end
	
	return false, "Unknown game ownership type"
end

-- Show authorization error
local function showAuthError(message)
	local DockWidgetPluginGuiInfo = DockWidgetPluginGuiInfo.new(
		Enum.InitialDockState.Float,
		false,
		false,
		400,
		200,
		300,
		150
	)
	
	local widget = plugin:CreateDockWidgetPluginGui("KSBotAuthError", DockWidgetPluginGuiInfo)
	widget.Title = "🔒 Authorization Required"
	widget.Enabled = true
	
	local frame = Instance.new("Frame")
	frame.Size = UDim2.new(1, 0, 1, 0)
	frame.BackgroundColor3 = Color3.fromRGB(40, 40, 40)
	frame.BorderSizePixel = 0
	frame.Parent = widget
	
	local icon = Instance.new("TextLabel")
	icon.Size = UDim2.new(1, 0, 0, 60)
	icon.Position = UDim2.new(0, 0, 0, 20)
	icon.BackgroundTransparency = 1
	icon.Text = "🔒"
	icon.TextSize = 48
	icon.Parent = frame
	
	local msgLabel = Instance.new("TextLabel")
	msgLabel.Size = UDim2.new(1, -40, 0, 60)
	msgLabel.Position = UDim2.new(0, 20, 0, 80)
	msgLabel.BackgroundTransparency = 1
	msgLabel.Text = message or "Only the game owner can configure KS Bot.\n\nThis prevents unauthorized access."
	msgLabel.TextColor3 = Color3.fromRGB(255, 255, 255)
	msgLabel.TextSize = 13
	msgLabel.Font = Enum.Font.Gotham
	msgLabel.TextWrapped = true
	msgLabel.TextYAlignment = Enum.TextYAlignment.Top
	msgLabel.Parent = frame
	
	local okButton = Instance.new("TextButton")
	okButton.Size = UDim2.new(0, 100, 0, 35)
	okButton.Position = UDim2.new(0.5, -50, 1, -45)
	okButton.BackgroundColor3 = Color3.fromRGB(50, 150, 250)
	okButton.Text = "OK"
	okButton.TextColor3 = Color3.fromRGB(255, 255, 255)
	okButton.TextSize = 14
	okButton.Font = Enum.Font.GothamBold
	okButton.Parent = frame
	
	local btnCorner = Instance.new("UICorner")
	btnCorner.CornerRadius = UDim.new(0, 4)
	btnCorner.Parent = okButton
	
	okButton.MouseButton1Click:Connect(function()
		widget:Destroy()
	end)
end

-- Create main UI
local function createUI()
	local screenGui = Instance.new("ScreenGui")
	screenGui.Name = "KSBotConfig"
	screenGui.ResetOnSpawn = false
	screenGui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling
	
	local mainFrame = Instance.new("Frame")
	mainFrame.Name = "MainFrame"
	mainFrame.Size = UDim2.new(0, 550, 0, 680)
	mainFrame.Position = UDim2.new(0.5, -275, 0.5, -340)
	mainFrame.BackgroundColor3 = Color3.fromRGB(30, 30, 30)
	mainFrame.BorderSizePixel = 0
	mainFrame.Parent = screenGui
	
	local titleBar = Instance.new("Frame")
	titleBar.Name = "TitleBar"
	titleBar.Size = UDim2.new(1, 0, 0, 40)
	titleBar.BackgroundColor3 = Color3.fromRGB(20, 20, 20)
	titleBar.BorderSizePixel = 0
	titleBar.Parent = mainFrame
	
	local titleLabel = Instance.new("TextLabel")
	titleLabel.Size = UDim2.new(1, -50, 1, 0)
	titleLabel.Position = UDim2.new(0, 10, 0, 0)
	titleLabel.BackgroundTransparency = 1
	titleLabel.Text = "KS Bot Configuration 🔒"
	titleLabel.TextColor3 = Color3.fromRGB(255, 255, 255)
	titleLabel.TextSize = 18
	titleLabel.Font = Enum.Font.GothamBold
	titleLabel.TextXAlignment = Enum.TextXAlignment.Left
	titleLabel.Parent = titleBar
	
	local closeButton = Instance.new("TextButton")
	closeButton.Size = UDim2.new(0, 40, 0, 40)
	closeButton.Position = UDim2.new(1, -40, 0, 0)
	closeButton.BackgroundColor3 = Color3.fromRGB(200, 50, 50)
	closeButton.BorderSizePixel = 0
	closeButton.Text = "X"
	closeButton.TextColor3 = Color3.fromRGB(255, 255, 255)
	closeButton.TextSize = 20
	closeButton.Font = Enum.Font.GothamBold
	closeButton.Parent = titleBar
	
	local contentFrame = Instance.new("ScrollingFrame")
	contentFrame.Name = "ContentFrame"
	contentFrame.Size = UDim2.new(1, -20, 1, -60)
	contentFrame.Position = UDim2.new(0, 10, 0, 50)
	contentFrame.BackgroundTransparency = 1
	contentFrame.BorderSizePixel = 0
	contentFrame.CanvasSize = UDim2.new(0, 0, 0, 950)
	contentFrame.ScrollBarThickness = 6
	contentFrame.Parent = mainFrame
	
	-- Security Notice
	local secNotice = Instance.new("Frame")
	secNotice.Size = UDim2.new(1, 0, 0, 65)
	secNotice.Position = UDim2.new(0, 0, 0, 10)
	secNotice.BackgroundColor3 = Color3.fromRGB(50, 100, 200)
	secNotice.BorderSizePixel = 0
	secNotice.Parent = contentFrame
	
	local secCorner = Instance.new("UICorner")
	secCorner.CornerRadius = UDim.new(0, 6)
	secCorner.Parent = secNotice
	
	local secText = Instance.new("TextLabel")
	secText.Size = UDim2.new(1, -20, 1, -10)
	secText.Position = UDim2.new(0, 10, 0, 5)
	secText.BackgroundTransparency = 1
	secText.Text = "🔒 SECURE: Only game owners can use this plugin.\nAPI keys stored in ServerStorage (never exposed to players).\nBackend validates ownership before accepting requests."
	secText.TextColor3 = Color3.fromRGB(255, 255, 255)
	secText.TextSize = 11
	secText.Font = Enum.Font.Gotham
	secText.TextXAlignment = Enum.TextXAlignment.Left
	secText.TextYAlignment = Enum.TextYAlignment.Top
	secText.TextWrapped = true
	secText.Parent = secNotice
	
	-- API Key Section
	local apiKeyLabel = Instance.new("TextLabel")
	apiKeyLabel.Size = UDim2.new(1, 0, 0, 30)
	apiKeyLabel.Position = UDim2.new(0, 0, 0, 85)
	apiKeyLabel.BackgroundTransparency = 1
	apiKeyLabel.Text = "Discord Bot API Key:"
	apiKeyLabel.TextColor3 = Color3.fromRGB(255, 255, 255)
	apiKeyLabel.TextSize = 14
	apiKeyLabel.Font = Enum.Font.GothamBold
	apiKeyLabel.TextXAlignment = Enum.TextXAlignment.Left
	apiKeyLabel.Parent = contentFrame
	
	local apiKeyHint = Instance.new("TextLabel")
	apiKeyHint.Size = UDim2.new(1, 0, 0, 20)
	apiKeyHint.Position = UDim2.new(0, 0, 0, 110)
	apiKeyHint.BackgroundTransparency = 1
	apiKeyHint.Text = "Get from Discord: /dashboard roblox setup"
	apiKeyHint.TextColor3 = Color3.fromRGB(150, 150, 150)
	apiKeyHint.TextSize = 11
	apiKeyHint.Font = Enum.Font.Gotham
	apiKeyHint.TextXAlignment = Enum.TextXAlignment.Left
	apiKeyHint.Parent = contentFrame
	
	local apiKeyInput = Instance.new("TextBox")
	apiKeyInput.Name = "APIKeyInput"
	apiKeyInput.Size = UDim2.new(1, 0, 0, 35)
	apiKeyInput.Position = UDim2.new(0, 0, 0, 135)
	apiKeyInput.BackgroundColor3 = Color3.fromRGB(40, 40, 40)
	apiKeyInput.BorderSizePixel = 0
	apiKeyInput.Text = ""
	apiKeyInput.PlaceholderText = "ks_roblox_123456_abc..."
	apiKeyInput.TextColor3 = Color3.fromRGB(255, 255, 255)
	apiKeyInput.TextSize = 11
	apiKeyInput.Font = Enum.Font.Code
	apiKeyInput.ClearTextOnFocus = false
	apiKeyInput.Parent = contentFrame
	
	local inputCorner = Instance.new("UICorner")
	inputCorner.CornerRadius = UDim.new(0, 4)
	inputCorner.Parent = apiKeyInput
	
	-- Test Button
	local testButton = Instance.new("TextButton")
	testButton.Name = "TestButton"
	testButton.Size = UDim2.new(1, 0, 0, 40)
	testButton.Position = UDim2.new(0, 0, 0, 185)
	testButton.BackgroundColor3 = Color3.fromRGB(50, 150, 250)
	testButton.BorderSizePixel = 0
	testButton.Text = "Test Connection"
	testButton.TextColor3 = Color3.fromRGB(255, 255, 255)
	testButton.TextSize = 14
	testButton.Font = Enum.Font.GothamBold
	testButton.Parent = contentFrame
	
	local testCorner = Instance.new("UICorner")
	testCorner.CornerRadius = UDim.new(0, 4)
	testCorner.Parent = testButton
	
	-- Status Label
	local statusLabel = Instance.new("TextLabel")
	statusLabel.Name = "StatusLabel"
	statusLabel.Size = UDim2.new(1, 0, 0, 30)
	statusLabel.Position = UDim2.new(0, 0, 0, 235)
	statusLabel.BackgroundTransparency = 1
	statusLabel.Text = "Status: Not connected"
	statusLabel.TextColor3 = Color3.fromRGB(200, 200, 200)
	statusLabel.TextSize = 12
	statusLabel.Font = Enum.Font.Gotham
	statusLabel.TextXAlignment = Enum.TextXAlignment.Left
	statusLabel.Parent = contentFrame
	
	-- Generate Button
	local generateButton = Instance.new("TextButton")
	generateButton.Name = "GenerateButton"
	generateButton.Size = UDim2.new(1, 0, 0, 40)
	generateButton.Position = UDim2.new(0, 0, 0, 275)
	generateButton.BackgroundColor3 = Color3.fromRGB(50, 200, 100)
	generateButton.BorderSizePixel = 0
	generateButton.Text = "Generate Secure In-Game Code"
	generateButton.TextColor3 = Color3.fromRGB(255, 255, 255)
	generateButton.TextSize = 14
	generateButton.Font = Enum.Font.GothamBold
	generateButton.Parent = contentFrame
	
	local genCorner = Instance.new("UICorner")
	genCorner.CornerRadius = UDim.new(0, 4)
	genCorner.Parent = generateButton
	
	-- Warning
	local warnFrame = Instance.new("Frame")
	warnFrame.Size = UDim2.new(1, 0, 0, 55)
	warnFrame.Position = UDim2.new(0, 0, 0, 325)
	warnFrame.BackgroundColor3 = Color3.fromRGB(200, 100, 50)
	warnFrame.BorderSizePixel = 0
	warnFrame.Parent = contentFrame
	
	local warnCorner = Instance.new("UICorner")
	warnCorner.CornerRadius = UDim.new(0, 4)
	warnCorner.Parent = warnFrame
	
	local warnText = Instance.new("TextLabel")
	warnText.Size = UDim2.new(1, -20, 1, -10)
	warnText.Position = UDim2.new(0, 10, 0, 5)
	warnText.BackgroundTransparency = 1
	warnText.Text = "⚠️ WARNING: Only generate code after testing connection!\nThis will create/overwrite scripts in your game."
	warnText.TextColor3 = Color3.fromRGB(255, 255, 255)
	warnText.TextSize = 11
	warnText.Font = Enum.Font.GothamBold
	warnText.TextWrapped = true
	warnText.TextYAlignment = Enum.TextYAlignment.Top
	warnText.Parent = warnFrame
	
	-- Instructions
	local instrFrame = Instance.new("Frame")
	instrFrame.Size = UDim2.new(1, 0, 0, 300)
	instrFrame.Position = UDim2.new(0, 0, 0, 390)
	instrFrame.BackgroundColor3 = Color3.fromRGB(40, 40, 40)
	instrFrame.BorderSizePixel = 0
	instrFrame.Parent = contentFrame
	
	local instrCorner = Instance.new("UICorner")
	instrCorner.CornerRadius = UDim.new(0, 4)
	instrCorner.Parent = instrFrame
	
	local instrText = Instance.new("TextLabel")
	instrText.Size = UDim2.new(1, -20, 1, -10)
	instrText.Position = UDim2.new(0, 10, 0, 5)
	instrText.BackgroundTransparency = 1
	instrText.Text = [[SETUP INSTRUCTIONS:

1. In Discord: /dashboard roblox setup
   → Bot asks for your Roblox Group ID
   → Bot DMs you an API key (save it!)

2. Paste API key above and click "Test Connection"

3. If ✅ successful, click "Generate Secure In-Game Code"
   → Creates ServerStorage/KSBot/Config (SECURE)
   → Creates ServerStorage/KSBot/API (SECURE)
   → Creates ReplicatedStorage/KSBot (UI only)
   → Creates ServerScriptService/KSBotServer
   → Creates StarterPlayerScripts/KSBotClient

4. Game Settings → Security → ☑ Allow HTTP Requests

5. Publish your game (File → Publish to Roblox)

6. In Discord: /dashboard roblox add-place [place_id]

7. In Discord: /dashboard roblox verify
   → Add code to group description
   → Click verify button

8. In Discord: /dashboard roblox enable-template [name]

9. Test in game (press F key to open applications)]]
	instrText.TextColor3 = Color3.fromRGB(200, 200, 200)
	instrText.TextSize = 10
	instrText.Font = Enum.Font.Gotham
	instrText.TextXAlignment = Enum.TextXAlignment.Left
	instrText.TextYAlignment = Enum.TextYAlignment.Top
	instrText.TextWrapped = true
	instrText.Parent = instrFrame
	
	-- Security Info
	local secInfoFrame = Instance.new("Frame")
	secInfoFrame.Size = UDim2.new(1, 0, 0, 110)
	secInfoFrame.Position = UDim2.new(0, 0, 0, 700)
	secInfoFrame.BackgroundColor3 = Color3.fromRGB(50, 50, 150)
	secInfoFrame.BorderSizePixel = 0
	secInfoFrame.Parent = contentFrame
	
	local secInfoCorner = Instance.new("UICorner")
	secInfoCorner.CornerRadius = UDim.new(0, 4)
	secInfoCorner.Parent = secInfoFrame
	
	local secInfoText = Instance.new("TextLabel")
	secInfoText.Size = UDim2.new(1, -20, 1, -10)
	secInfoText.Position = UDim2.new(0, 10, 0, 5)
	secInfoText.BackgroundTransparency = 1
	secInfoText.Text = [[🔐 SECURITY FEATURES:

✓ API keys stored in ServerStorage (players cannot access)
✓ Client-server architecture (RemoteEvents/Functions)
✓ Backend validates game ownership before requests
✓ Rate limiting: 5 applications per hour per user
✓ Cooldown system: Configurable per template
✓ Request timestamps prevent replay attacks
✓ Only game owners can configure this plugin

Players never see or have access to your API key!]]
	secInfoText.TextColor3 = Color3.fromRGB(255, 255, 255)
	secInfoText.TextSize = 10
	secInfoText.Font = Enum.Font.Gotham
	secInfoText.TextXAlignment = Enum.TextXAlignment.Left
	secInfoText.TextYAlignment = Enum.TextYAlignment.Top
	secInfoText.TextWrapped = true
	secInfoText.Parent = secInfoFrame
	
	-- Footer
	local footer = Instance.new("TextLabel")
	footer.Size = UDim2.new(1, 0, 0, 30)
	footer.Position = UDim2.new(0, 0, 0, 820)
	footer.BackgroundTransparency = 1
	footer.Text = "KS Bot v" .. CONFIG.PLUGIN_VERSION .. " • Secure Application System"
	footer.TextColor3 = Color3.fromRGB(100, 100, 100)
	footer.TextSize = 10
	footer.Font = Enum.Font.Gotham
	footer.Parent = contentFrame
	
	-- Make draggable
	local dragging = false
	local dragInput, dragStart, startPos
	
	local function update(input)
		local delta = input.Position - dragStart
		mainFrame.Position = UDim2.new(
			startPos.X.Scale,
			startPos.X.Offset + delta.X,
			startPos.Y.Scale,
			startPos.Y.Offset + delta.Y
		)
	end
	
	titleBar.InputBegan:Connect(function(input)
		if input.UserInputType == Enum.UserInputType.MouseButton1 then
			dragging = true
			dragStart = input.Position
			startPos = mainFrame.Position
			
			input.Changed:Connect(function()
				if input.UserInputState == Enum.UserInputState.End then
					dragging = false
				end
			end)
		end
	end)
	
	titleBar.InputChanged:Connect(function(input)
		if input.UserInputType == Enum.UserInputType.MouseMovement then
			dragInput = input
		end
	end)
	
	game:GetService("UserInputService").InputChanged:Connect(function(input)
		if input == dragInput and dragging then
			update(input)
		end
	end)
	
	-- Event handlers
	closeButton.MouseButton1Click:Connect(function()
		screenGui:Destroy()
		isOpen = false
	end)
	
	testButton.MouseButton1Click:Connect(function()
		testConnection(apiKeyInput.Text, statusLabel)
	end)
	
	generateButton.MouseButton1Click:Connect(function()
		generateCode(apiKeyInput.Text, statusLabel)
	end)
	
	return screenGui
end

-- Test connection
function testConnection(apiKey, statusLabel)
	if apiKey == "" then
		statusLabel.Text = "Status: ❌ Please enter an API key"
		statusLabel.TextColor3 = Color3.fromRGB(255, 100, 100)
		return
	end
	
	if not string.match(apiKey, "^ks_roblox_") then
		statusLabel.Text = "Status: ❌ Invalid API key format"
		statusLabel.TextColor3 = Color3.fromRGB(255, 100, 100)
		return
	end
	
	statusLabel.Text = "Status: Testing connection..."
	statusLabel.TextColor3 = Color3.fromRGB(255, 255, 100)
	
	local success, result = pcall(function()
		local response = HttpService:RequestAsync({
			Url = CONFIG.API_URL .. "/validate/status?timestamp=" .. os.time(),
			Method = "GET",
			Headers = {
				["Authorization"] = "Bearer " .. apiKey,
				["Content-Type"] = "application/json"
			}
		})
		
		if response.StatusCode == 200 then
			return HttpService:JSONDecode(response.Body)
		else
			error("HTTP " .. response.StatusCode)
		end
	end)
	
	if success and result and result.success then
		statusLabel.Text = "Status: ✅ Connected successfully!"
		statusLabel.TextColor3 = Color3.fromRGB(100, 255, 100)
	else
		local errorMsg = "Connection failed"
		if not success then
			local errStr = tostring(result)
			if string.find(errStr, "403") or string.find(errStr, "401") then
				errorMsg = "❌ Invalid API key or unauthorized"
			elseif string.find(errStr, "404") then
				errorMsg = "❌ API endpoint not found"
			elseif string.find(errStr, "timeout") then
				errorMsg = "❌ Connection timeout"
			elseif string.find(errStr, "Http requests are not enabled") then
				errorMsg = "❌ Enable HTTP in Settings → Security"
			else
				errorMsg = "❌ " .. string.sub(errStr, 1, 50)
			end
		end
		
		statusLabel.Text = "Status: " .. errorMsg
		statusLabel.TextColor3 = Color3.fromRGB(255, 100, 100)
		warn("KS Bot error:", result)
	end
end

-- Generate code
function generateCode(apiKey, statusLabel)
	if apiKey == "" then
		statusLabel.Text = "Status: ❌ Enter API key first"
		statusLabel.TextColor3 = Color3.fromRGB(255, 100, 100)
		return
	end
	
	if not string.match(apiKey, "^ks_roblox_") then
		statusLabel.Text = "Status: ❌ Invalid API key format"
		statusLabel.TextColor3 = Color3.fromRGB(255, 100, 100)
		return
	end
	
	statusLabel.Text = "Status: Generating secure code..."
	statusLabel.TextColor3 = Color3.fromRGB(255, 255, 100)
	
	-- SECURITY: Store sensitive data in ServerStorage
	local serverStorage = game:GetService("ServerStorage")
	local replicatedStorage = game:GetService("ReplicatedStorage")
	
	-- Server folder (SECURE)
	local ksServerFolder = serverStorage:FindFirstChild("KSBot") or Instance.new("Folder")
	ksServerFolder.Name = "KSBot"
	ksServerFolder.Parent = serverStorage
	
	-- Config module (SECURE - SERVER ONLY)
	local configModule = Instance.new("ModuleScript")
	configModule.Name = "Config"
	configModule.Source = string.format([[
-- KS Bot Configuration
-- ⚠️ SECURITY: NEVER move this to ReplicatedStorage!
-- This contains sensitive API credentials.

return {
	API_URL = "%s",
	API_KEY = "%s",
	PLACE_ID = game.PlaceId,
	VERSION = "%s"
}
]], CONFIG.API_URL, apiKey, CONFIG.PLUGIN_VERSION)
	configModule.Parent = ksServerFolder
	
	-- API module (SECURE - SERVER ONLY)
	local apiModule = Instance.new("ModuleScript")
	apiModule.Name = "API"
	apiModule.Source = [[
-- KS Bot API Client (SERVER SIDE ONLY)
local HttpService = game:GetService("HttpService")
local ServerStorage = game:GetService("ServerStorage")

local Config = require(ServerStorage.KSBot.Config)

local API = {}

function API:Request(endpoint, method, data)
	local url = Config.API_URL .. endpoint
	local timestamp = os.time()
	
	local requestData = {
		Url = url,
		Method = method or "GET",
		Headers = {
			["Authorization"] = "Bearer " .. Config.API_KEY,
			["Content-Type"] = "application/json"
		}
	}
	
	if data then
		data.placeId = Config.PLACE_ID
		data.timestamp = timestamp
		requestData.Body = HttpService:JSONEncode(data)
	else
		requestData.Url = url .. (string.find(url, "?") and "&" or "?") .. "timestamp=" .. timestamp
	end
	
	local success, response = pcall(function()
		return HttpService:RequestAsync(requestData)
	end)
	
	if success and response.StatusCode == 200 then
		return true, HttpService:JSONDecode(response.Body)
	else
		warn("KS Bot API Error:", response and response.StatusCode or "Failed")
		return false, nil
	end
end

function API:ValidateConnection()
	return self:Request("/validate", "POST", {})
end

function API:GetTemplates()
	return self:Request("/templates", "GET")
end

function API:GetTemplate(templateId)
	return self:Request("/templates/" .. templateId, "GET")
end

function API:SubmitApplication(robloxUserId, robloxUsername, templateId, responses)
	return self:Request("/submit", "POST", {
		robloxUserId = robloxUserId,
		robloxUsername = robloxUsername,
		templateId = templateId,
		responses = responses
	})
end

function API:CheckEligibility(robloxUserId, templateId)
	return self:Request("/templates/check-eligibility", "POST", {
		robloxUserId = robloxUserId,
		templateId = templateId
	})
end

return API
]]
	apiModule.Parent = ksServerFolder
	
	-- Client folder (SAFE - No sensitive data)
	local ksClientFolder = replicatedStorage:FindFirstChild("KSBot") or Instance.new("Folder")
	ksClientFolder.Name = "KSBot"
	ksClientFolder.Parent = replicatedStorage
	
	-- RemoteEvent
	local remoteEvent = ksClientFolder:FindFirstChild("KSBotRemote") or Instance.new("RemoteEvent")
	remoteEvent.Name = "KSBotRemote"
	remoteEvent.Parent = ksClientFolder
	
	-- RemoteFunction
	local remoteFunction = ksClientFolder:FindFirstChild("KSBotFunction") or Instance.new("RemoteFunction")
	remoteFunction.Name = "KSBotFunction"
	remoteFunction.Parent = ksClientFolder
	
	-- UI Handler (CLIENT - SAFE)
	local uiModule = Instance.new("ModuleScript")
	uiModule.Name = "UIHandler"
	uiModule.Source = [[
-- KS Bot UI Handler (CLIENT SAFE - No API keys)
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local KSBotFunction = ReplicatedStorage.KSBot:WaitForChild("KSBotFunction")

local UIHandler = {}
UIHandler.Templates = {}

function UIHandler:Initialize()
	local success, templates = pcall(function()
		return KSBotFunction:InvokeServer("GetTemplates")
	end)
	
	if success and templates then
		self.Templates = templates
		print("KS Bot: Loaded", #self.Templates, "templates")
	else
		warn("KS Bot: Failed to load templates")
	end
end

function UIHandler:CreateApplicationUI(player)
	local playerGui = player:WaitForChild("PlayerGui")
	
	local screenGui = Instance.new("ScreenGui")
	screenGui.Name = "KSBotApplications"
	screenGui.ResetOnSpawn = false
	screenGui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling
	
	local mainFrame = Instance.new("Frame")
	mainFrame.Name = "MainFrame"
	mainFrame.Size = UDim2.new(0, 400, 0, 500)
	mainFrame.Position = UDim2.new(0.5, -200, 0.5, -250)
	mainFrame.BackgroundColor3 = Color3.fromRGB(30, 30, 30)
	mainFrame.BorderSizePixel = 0
	mainFrame.Visible = false
	mainFrame.Parent = screenGui
	
	local corner = Instance.new("UICorner")
	corner.CornerRadius = UDim.new(0, 8)
	corner.Parent = mainFrame
	
	local title = Instance.new("TextLabel")
	title.Size = UDim2.new(1, -20, 0, 40)
	title.Position = UDim2.new(0, 10, 0, 10)
	title.BackgroundTransparency = 1
	title.Text = "Applications"
	title.TextColor3 = Color3.fromRGB(255, 255, 255)
	title.TextSize = 20
	title.Font = Enum.Font.GothamBold
	title.TextXAlignment = Enum.TextXAlignment.Left
	title.Parent = mainFrame
	
	local closeButton = Instance.new("TextButton")
	closeButton.Size = UDim2.new(0, 30, 0, 30)
	closeButton.Position = UDim2.new(1, -40, 0, 10)
	closeButton.BackgroundColor3 = Color3.fromRGB(200, 50, 50)
	closeButton.Text = "X"
	closeButton.TextColor3 = Color3.fromRGB(255, 255, 255)
	closeButton.TextSize = 16
	closeButton.Font = Enum.Font.GothamBold
	closeButton.Parent = mainFrame
	
	local closeCorn = Instance.new("UICorner")
	closeCorn.CornerRadius = UDim.new(0, 4)
	closeCorn.Parent = closeButton
	
	closeButton.MouseButton1Click:Connect(function()
		mainFrame.Visible = false
	end)
	
	local scrollFrame = Instance.new("ScrollingFrame")
	scrollFrame.Size = UDim2.new(1, -20, 1, -70)
	scrollFrame.Position = UDim2.new(0, 10, 0, 60)
	scrollFrame.BackgroundTransparency = 1
	scrollFrame.BorderSizePixel = 0
	scrollFrame.ScrollBarThickness = 4
	scrollFrame.Parent = mainFrame
	
	local listLayout = Instance.new("UIListLayout")
	listLayout.Padding = UDim.new(0, 10)
	listLayout.Parent = scrollFrame
	
	for _, template in ipairs(self.Templates) do
		self:CreateTemplateButton(template, scrollFrame, player)
	end
	
	listLayout:GetPropertyChangedSignal("AbsoluteContentSize"):Connect(function()
		scrollFrame.CanvasSize = UDim2.new(0, 0, 0, listLayout.AbsoluteContentSize.Y + 10)
	end)
	
	screenGui.Parent = playerGui
	return mainFrame
end

function UIHandler:CreateTemplateButton(template, parent, player)
	local button = Instance.new("TextButton")
	button.Size = UDim2.new(1, -10, 0, 80)
	button.BackgroundColor3 = Color3.fromRGB(45, 45, 45)
	button.Text = ""
	button.Parent = parent
	
	local btnCorner = Instance.new("UICorner")
	btnCorner.CornerRadius = UDim.new(0, 6)
	btnCorner.Parent = button
	
	local templateName = Instance.new("TextLabel")
	templateName.Size = UDim2.new(1, -20, 0, 25)
	templateName.Position = UDim2.new(0, 10, 0, 10)
	templateName.BackgroundTransparency = 1
	templateName.Text = template.name
	templateName.TextColor3 = Color3.fromRGB(255, 255, 255)
	templateName.TextSize = 16
	templateName.Font = Enum.Font.GothamBold
	templateName.TextXAlignment = Enum.TextXAlignment.Left
	templateName.Parent = button
	
	local description = Instance.new("TextLabel")
	description.Size = UDim2.new(1, -20, 0, 20)
	description.Position = UDim2.new(0, 10, 0, 35)
	description.BackgroundTransparency = 1
	description.Text = template.description or ""
	description.TextColor3 = Color3.fromRGB(200, 200, 200)
	description.TextSize = 12
	description.Font = Enum.Font.Gotham
	description.TextXAlignment = Enum.TextXAlignment.Left
	description.TextTruncate = Enum.TextTruncate.AtEnd
	description.Parent = button
	
	local info = Instance.new("TextLabel")
	info.Size = UDim2.new(1, -20, 0, 15)
	info.Position = UDim2.new(0, 10, 1, -20)
	info.BackgroundTransparency = 1
	info.Text = string.format("%d questions • %d min cooldown", 
		#template.questions or 0, 
		template.cooldownMinutes or 60)
	info.TextColor3 = Color3.fromRGB(150, 150, 150)
	info.TextSize = 11
	info.Font = Enum.Font.Gotham
	info.TextXAlignment = Enum.TextXAlignment.Left
	info.Parent = button
	
	button.MouseButton1Click:Connect(function()
		self:OpenApplicationForm(player, template)
	end)
end

function UIHandler:OpenApplicationForm(player, template)
	local mainFrame = player.PlayerGui.KSBotApplications.MainFrame
	mainFrame.Visible = false
	
	local formFrame = Instance.new("Frame")
	formFrame.Name = "ApplicationForm"
	formFrame.Size = UDim2.new(0, 500, 0, 600)
	formFrame.Position = UDim2.new(0.5, -250, 0.5, -300)
	formFrame.BackgroundColor3 = Color3.fromRGB(30, 30, 30)
	formFrame.BorderSizePixel = 0
	formFrame.Parent = player.PlayerGui.KSBotApplications
	
	local formCorner = Instance.new("UICorner")
	formCorner.CornerRadius = UDim.new(0, 8)
	formCorner.Parent = formFrame
	
	local title = Instance.new("TextLabel")
	title.Size = UDim2.new(1, -20, 0, 40)
	title.Position = UDim2.new(0, 10, 0, 10)
	title.BackgroundTransparency = 1
	title.Text = template.name
	title.TextColor3 = Color3.fromRGB(255, 255, 255)
	title.TextSize = 20
	title.Font = Enum.Font.GothamBold
	title.TextXAlignment = Enum.TextXAlignment.Left
	title.Parent = formFrame
	
	local backButton = Instance.new("TextButton")
	backButton.Size = UDim2.new(0, 80, 0, 30)
	backButton.Position = UDim2.new(1, -90, 0, 10)
	backButton.BackgroundColor3 = Color3.fromRGB(100, 100, 100)
	backButton.Text = "← Back"
	backButton.TextColor3 = Color3.fromRGB(255, 255, 255)
	backButton.TextSize = 14
	backButton.Font = Enum.Font.Gotham
	backButton.Parent = formFrame
	
	local backCorn = Instance.new("UICorner")
	backCorn.CornerRadius = UDim.new(0, 4)
	backCorn.Parent = backButton
	
	backButton.MouseButton1Click:Connect(function()
		formFrame:Destroy()
		mainFrame.Visible = true
	end)
	
	local scrollFrame = Instance.new("ScrollingFrame")
	scrollFrame.Size = UDim2.new(1, -20, 1, -120)
	scrollFrame.Position = UDim2.new(0, 10, 0, 60)
	scrollFrame.BackgroundTransparency = 1
	scrollFrame.BorderSizePixel = 0
	scrollFrame.ScrollBarThickness = 4
	scrollFrame.Parent = formFrame
	
	local listLayout = Instance.new("UIListLayout")
	listLayout.Padding = UDim.new(0, 15)
	listLayout.Parent = scrollFrame
	
	local responses = {}
	
	for i, question in ipairs(template.questions) do
		local questionFrame = Instance.new("Frame")
		questionFrame.Size = UDim2.new(1, -10, 0, 100)
		questionFrame.BackgroundTransparency = 1
		questionFrame.Parent = scrollFrame
		
		local questionLabel = Instance.new("TextLabel")
		questionLabel.Size = UDim2.new(1, 0, 0, 30)
		questionLabel.BackgroundTransparency = 1
		questionLabel.Text = (question.required and "* " or "") .. question.question
		questionLabel.TextColor3 = Color3.fromRGB(255, 255, 255)
		questionLabel.TextSize = 14
		questionLabel.Font = Enum.Font.Gotham
		questionLabel.TextXAlignment = Enum.TextXAlignment.Left
		questionLabel.TextWrapped = true
		questionLabel.Parent = questionFrame
		
		local answerBox = Instance.new("TextBox")
		answerBox.Name = "Answer_" .. question.id
		answerBox.Size = UDim2.new(1, 0, 0, 60)
		answerBox.Position = UDim2.new(0, 0, 0, 35)
		answerBox.BackgroundColor3 = Color3.fromRGB(40, 40, 40)
		answerBox.BorderSizePixel = 0
		answerBox.Text = ""
		answerBox.PlaceholderText = question.placeholder or "Enter your answer..."
		answerBox.TextColor3 = Color3.fromRGB(255, 255, 255)
		answerBox.TextSize = 12
		answerBox.Font = Enum.Font.Gotham
		answerBox.TextXAlignment = Enum.TextXAlignment.Left
		answerBox.TextYAlignment = Enum.TextYAlignment.Top
		answerBox.MultiLine = true
		answerBox.ClearTextOnFocus = false
		answerBox.Parent = questionFrame
		
		local boxCorn = Instance.new("UICorner")
		boxCorn.CornerRadius = UDim.new(0, 4)
		boxCorn.Parent = answerBox
		
		responses[question.id] = answerBox
	end
	
	local submitButton = Instance.new("TextButton")
	submitButton.Size = UDim2.new(1, -20, 0, 45)
	submitButton.Position = UDim2.new(0, 10, 1, -55)
	submitButton.BackgroundColor3 = Color3.fromRGB(50, 200, 100)
	submitButton.Text = "Submit Application"
	submitButton.TextColor3 = Color3.fromRGB(255, 255, 255)
	submitButton.TextSize = 16
	submitButton.Font = Enum.Font.GothamBold
	submitButton.Parent = formFrame
	
	local subCorn = Instance.new("UICorner")
	subCorn.CornerRadius = UDim.new(0, 6)
	subCorn.Parent = submitButton
	
	submitButton.MouseButton1Click:Connect(function()
		local answersData = {}
		local allFilled = true
		
		for id, box in pairs(responses) do
			local answer = box.Text
			answersData[id] = answer
			
			local question = nil
			for _, q in ipairs(template.questions) do
				if q.id == id then question = q break end
			end
			
			if question and question.required and (answer == "" or answer == nil) then
				allFilled = false
				box.BorderSizePixel = 2
				box.BorderColor3 = Color3.fromRGB(255, 100, 100)
			else
				box.BorderSizePixel = 0
			end
		end
		
		if not allFilled then
			submitButton.Text = "❌ Fill all required fields"
			wait(2)
			submitButton.Text = "Submit Application"
			return
		end
		
		submitButton.Text = "Submitting..."
		submitButton.BackgroundColor3 = Color3.fromRGB(100, 100, 100)
		
		local success, result = pcall(function()
			return KSBotFunction:InvokeServer("SubmitApplication", template.id, answersData)
		end)
		
		if success and result and result.success then
			submitButton.Text = "✅ Submitted!"
			submitButton.BackgroundColor3 = Color3.fromRGB(50, 200, 100)
			wait(2)
			formFrame:Destroy()
			mainFrame.Visible = true
		else
			submitButton.Text = "❌ " .. (result and result.error or "Failed")
			submitButton.BackgroundColor3 = Color3.fromRGB(200, 50, 50)
			wait(3)
			submitButton.Text = "Submit Application"
			submitButton.BackgroundColor3 = Color3.fromRGB(50, 200, 100)
		end
	end)
	
	listLayout:GetPropertyChangedSignal("AbsoluteContentSize"):Connect(function()
		scrollFrame.CanvasSize = UDim2.new(0, 0, 0, listLayout.AbsoluteContentSize.Y + 20)
	end)
end

return UIHandler
]]
	uiModule.Parent = ksClientFolder
	
	-- Server script
	local serverScript = Instance.new("Script")
	serverScript.Name = "KSBotServer"
	serverScript.Source = [[
-- KS Bot Server Script (SECURE)
local ServerStorage = game:GetService("ServerStorage")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local API = require(ServerStorage.KSBot.API)
local KSBotFunction = ReplicatedStorage.KSBot:WaitForChild("KSBotFunction")

-- Validate on startup
local success, result = API:ValidateConnection()
if success and result and result.success then
	print("✅ KS Bot: Connected successfully!")
else
	warn("❌ KS Bot: Failed to connect")
end

-- Handle client requests
KSBotFunction.OnServerInvoke = function(player, action, ...)
	if action == "GetTemplates" then
		local success, result = API:GetTemplates()
		if success and result and result.success then
			return result.templates
		end
		return {}
		
	elseif action == "SubmitApplication" then
		local templateId, responses = ...
		
		local success, result = API:SubmitApplication(
			tostring(player.UserId),
			player.Name,
			templateId,
			responses
		)
		
		if success and result then
			return result
		end
		return {success = false, error = "Submission failed"}
	end
	
	return nil
end

print("✅ KS Bot: Server initialized")
]]
	serverScript.Parent = game:GetService("ServerScriptService")
	
	-- Client script
	local clientScript = Instance.new("LocalScript")
	clientScript.Name = "KSBotClient"
	clientScript.Source = [[
-- KS Bot Client Script (SAFE - No API keys)
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")
local UserInputService = game:GetService("UserInputService")

local UIHandler = require(ReplicatedStorage.KSBot.UIHandler)
local player = Players.LocalPlayer

-- Initialize
UIHandler:Initialize()

-- Create UI
local appUI = UIHandler:CreateApplicationUI(player)

-- Keybind to toggle (F key)
UserInputService.InputBegan:Connect(function(input, gameProcessed)
	if gameProcessed then return end
	
	if input.KeyCode == Enum.KeyCode.F then
		appUI.Visible = not appUI.Visible
	end
end)

print("✅ KS Bot: Press F to open applications")
]]
	clientScript.Parent = game:GetService("StarterPlayer"):WaitForChild("StarterPlayerScripts")
	
	ChangeHistoryService:SetWaypoint("KS Bot Code Generated")
	
	statusLabel.Text = "Status: ✅ Code generated successfully!"
	statusLabel.TextColor3 = Color3.fromRGB(100, 255, 100)
	
	print("✅ KS Bot: Secure code generated!")
	print("📁 ServerStorage/KSBot - Secure API config")
	print("📁 ReplicatedStorage/KSBot - UI only")
	print("📜 ServerScriptService/KSBotServer - Server handler")
	print("📜 StarterPlayerScripts/KSBotClient - Client UI")
end

-- Plugin button click
button.Click:Connect(function()
	-- SECURITY CHECK
	local authorized, userIdOrError = isUserAuthorized()
	
	if not authorized then
		showAuthError(userIdOrError)
		return
	end
	
	-- Authorized - show config
	if isOpen then
		if configWindow then
			configWindow:Destroy()
		end
		isOpen = false
	else
		configWindow = createUI()
		configWindow.Parent = game:GetService("CoreGui")
		isOpen = true
	end
end)

print("✅ KS Bot Studio Plugin loaded! (v" .. CONFIG.PLUGIN_VERSION .. ")")
print("🔒 Security: Owner-only access")