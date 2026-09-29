package telegram

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"
)

type BotClient struct {
	botToken   string
	httpClient *http.Client
}

type GetChatMemberResponse struct {
	OK          bool   `json:"ok"`
	Description string `json:"description,omitempty"`
	Result      struct {
		Status string `json:"status"` // "creator", "administrator", "member", "restricted", "left", "kicked"
		User   struct {
			ID        int64  `json:"id"`
			FirstName string `json:"first_name"`
			Username  string `json:"username"`
		} `json:"user"`
	} `json:"result"`
}

type ChatInfo struct {
	ID          int64  `json:"id"`
	Type        string `json:"type"` // "channel", "group", "supergroup", "private"
	Title       string `json:"title"`
	Username    string `json:"username"`
	InviteLink  string `json:"invite_link"`
	Description string `json:"description"`
}

type GetChatResponse struct {
	OK          bool     `json:"ok"`
	Result      ChatInfo `json:"result"`
	Description string   `json:"description,omitempty"`
}

type CopyMessageResponse struct {
	OK          bool `json:"ok"`
	Result      struct {
		MessageID int64 `json:"message_id"`
	} `json:"result"`
	Description string `json:"description,omitempty"`
}

type LabeledPrice struct {
	Label  string `json:"label"`
	Amount int    `json:"amount"` // in Stars
}

type CreateInvoiceLinkResponse struct {
	OK          bool   `json:"ok"`
	Result      string `json:"result"` // invoice link
	Description string `json:"description,omitempty"`
}

func NewBotClient(botToken string) *BotClient {
	return &BotClient{
		botToken: botToken,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// SendMessage sends a text message to a telegram chat with optional replyMarkup
func (b *BotClient) SendMessage(chatID int64, text string, replyMarkup interface{}) error {
	if b.botToken == "" {
		return nil
	}

	apiURL := fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", b.botToken)
	reqBody := map[string]interface{}{
		"chat_id":    chatID,
		"text":       text,
		"parse_mode": "HTML",
	}
	if replyMarkup != nil {
		reqBody["reply_markup"] = replyMarkup
	}

	jsonBytes, err := json.Marshal(reqBody)
	if err != nil {
		return fmt.Errorf("failed to marshal sendMessage payload: %w", err)
	}

	resp, err := b.httpClient.Post(apiURL, "application/json", bytes.NewBuffer(jsonBytes))
	if err != nil {
		log.Printf("[ERROR] HTTP post to Telegram failed for chat %d: %v", chatID, err)
		return err
	}
	defer resp.Body.Close()

	var result struct {
		OK          bool   `json:"ok"`
		ErrorCode   int    `json:"error_code,omitempty"`
		Description string `json:"description,omitempty"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		log.Printf("[ERROR] Failed to decode Telegram response for chat %d: %v", chatID, err)
		return err
	}

	if !result.OK {
		log.Printf("[ERROR] Telegram SendMessage to chat %d rejected (HTTP %d): %s", chatID, result.ErrorCode, result.Description)
		return fmt.Errorf("telegram API error (%d): %s", result.ErrorCode, result.Description)
	}

	log.Printf("[INFO] Telegram message sent successfully to chat %d", chatID)
	return nil
}

// CopyMessage copies any message (text, photo, video, sticker, etc.) to another chat using Telegram API
func (b *BotClient) CopyMessage(toChatID, fromChatID, messageID int64) (int64, error) {
	if b.botToken == "" {
		return 1, nil
	}

	apiURL := fmt.Sprintf("https://api.telegram.org/bot%s/copyMessage", b.botToken)
	reqBody := map[string]interface{}{
		"chat_id":      toChatID,
		"from_chat_id": fromChatID,
		"message_id":   messageID,
	}

	jsonBytes, _ := json.Marshal(reqBody)
	resp, err := b.httpClient.Post(apiURL, "application/json", bytes.NewBuffer(jsonBytes))
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()

	var result CopyMessageResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return 0, err
	}
	if !result.OK {
		return 0, fmt.Errorf("telegram API error: %s", result.Description)
	}

	return result.Result.MessageID, nil
}

// GetChat fetches metadata for a channel or group
func (b *BotClient) GetChat(chatID int64) (*ChatInfo, error) {
	return b.GetChatByString(fmt.Sprintf("%d", chatID))
}

// GetChatByString fetches metadata for a channel or group by string ID or @username
func (b *BotClient) GetChatByString(chatID string) (*ChatInfo, error) {
	if b.botToken == "" {
		return &ChatInfo{
			Type:  "channel",
			Title: fmt.Sprintf("Mock Channel (%s)", chatID),
		}, nil
	}

	apiURL := fmt.Sprintf("https://api.telegram.org/bot%s/getChat?chat_id=%s", b.botToken, chatID)
	resp, err := b.httpClient.Get(apiURL)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result GetChatResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	if !result.OK {
		return nil, fmt.Errorf("failed to get chat: %s", result.Description)
	}

	return &result.Result, nil
}

// ExportChatInviteLink exports the official permanent primary invite link for a channel or group
func (b *BotClient) ExportChatInviteLink(chatID string) (string, error) {
	if b.botToken == "" {
		return "https://t.me/SpinCraftCommunity", nil
	}

	apiURL := fmt.Sprintf("https://api.telegram.org/bot%s/exportChatInviteLink?chat_id=%s", b.botToken, chatID)
	resp, err := b.httpClient.Get(apiURL)
	if err != nil {
		return "", fmt.Errorf("failed to call exportChatInviteLink: %w", err)
	}
	defer resp.Body.Close()

	var result struct {
		OK          bool   `json:"ok"`
		Result      string `json:"result"`
		Description string `json:"description,omitempty"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}
	if !result.OK {
		return "", fmt.Errorf("telegram error: %s", result.Description)
	}

	return result.Result, nil
}

// SendStartWelcome sends the welcome card with the WebApp launcher button
func (b *BotClient) SendStartWelcome(chatID int64, firstName, miniAppURL string) error {
	welcomeText := fmt.Sprintf(
		"👋 <b>Hello %s! Welcome to EarnMiniApp!</b> 🚀\n\n"+
			"🎰 Spin the Lucky Wheel to earn <b>real USDT cash</b>, diamonds, and free tickets!\n"+
			"👥 Invite friends to earn <b>+3 Free Spins</b> and build your passive team!\n"+
			"🏆 Compete in our <b>$500 Weekly Contest</b> and win big!\n\n"+
			"👇 Click the button below to launch the app now!",
		firstName,
	)

	// In Telegram Bot API:
	// If the miniAppURL is a t.me link (e.g. https://t.me/Bot/app), Telegram requires a standard "url" button.
	// If the miniAppURL is a direct HTTPS web app (e.g. https://domain.com), Telegram supports a "web_app" button.
	var launchButton map[string]interface{}
	if strings.HasPrefix(miniAppURL, "https://t.me/") || strings.HasPrefix(miniAppURL, "tg://") {
		launchButton = map[string]interface{}{
			"text": "🚀 Launch EarnMiniApp & Win USDT",
			"url":  miniAppURL,
		}
	} else {
		launchButton = map[string]interface{}{
			"text": "🚀 Launch EarnMiniApp & Win USDT",
			"web_app": map[string]string{
				"url": miniAppURL,
			},
		}
	}

	replyMarkup := map[string]interface{}{
		"inline_keyboard": [][]map[string]interface{}{
			{
				launchButton,
			},
			{
				{
					"text": "📣 Official Channel",
					"url":  "https://t.me/SpinCraftCommunity",
				},
			},
		},
	}

	return b.SendMessage(chatID, welcomeText, replyMarkup)
}

// SendConnectChatsKeyboard sends the reply keyboard for connecting channels & groups (Bot API 6.5+ request_chat)
func (b *BotClient) SendConnectChatsKeyboard(chatID int64) error {
	text := "📢 <b>Channel & Group Connector</b>\n\n" +
		"Please click one of the buttons below to select and connect a Channel or Group where this bot is an Admin.\n\n" +
		"Once connected, you can turn it into a task in the Mini App with 1 click!"

	replyMarkup := map[string]interface{}{
		"keyboard": [][]map[string]interface{}{
			{
				{
					"text": "📢 Connect Channel",
					"request_chat": map[string]interface{}{
						"request_id":       1,
						"chat_is_channel":  true,
						"bot_is_member":    true,
						"request_title":    true,
						"request_username": true,
						"bot_administrator_rights": map[string]interface{}{
							"can_manage_chat": true,
						},
					},
				},
				{
					"text": "👥 Connect Group",
					"request_chat": map[string]interface{}{
						"request_id":       2,
						"chat_is_channel":  false,
						"bot_is_member":    true,
						"request_title":    true,
						"request_username": true,
						"bot_administrator_rights": map[string]interface{}{
							"can_manage_chat": true,
						},
					},
				},
			},
		},
		"resize_keyboard":   true,
		"one_time_keyboard": true,
	}

	return b.SendMessage(chatID, text, replyMarkup)
}

// IsUserInChannel checks if a telegram user is a member/admin/creator in a given channel/chat
func (b *BotClient) IsUserInChannel(chatID string, userID int64) (bool, error) {
	if b.botToken == "" {
		return true, nil
	}

	apiURL := fmt.Sprintf("https://api.telegram.org/bot%s/getChatMember?chat_id=%s&user_id=%d", b.botToken, chatID, userID)
	resp, err := b.httpClient.Get(apiURL)
	if err != nil {
		return false, fmt.Errorf("failed to call getChatMember API: %w", err)
	}
	defer resp.Body.Close()

	var result GetChatMemberResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return false, fmt.Errorf("failed to decode getChatMember response: %w", err)
	}

	if !result.OK {
		return false, nil
	}

	status := result.Result.Status
	isMember := status == "creator" || status == "administrator" || status == "member" || status == "restricted"
	return isMember, nil
}

// CreateStarsInvoiceLink creates a Telegram Stars invoice link
func (b *BotClient) CreateStarsInvoiceLink(title, description, payload string, starsCount int) (string, error) {
	if b.botToken == "" {
		return fmt.Sprintf("https://t.me/$mock_invoice_%d_stars", starsCount), nil
	}

	apiURL := fmt.Sprintf("https://api.telegram.org/bot%s/createInvoiceLink", b.botToken)
	reqBody := map[string]interface{}{
		"title":       title,
		"description": description,
		"payload":     payload,
		"currency":    "XTR", // Telegram Stars currency
		"prices": []LabeledPrice{
			{Label: title, Amount: starsCount},
		},
	}

	jsonBytes, _ := json.Marshal(reqBody)
	resp, err := b.httpClient.Post(apiURL, "application/json", bytes.NewBuffer(jsonBytes))
	if err != nil {
		return "", fmt.Errorf("failed to call createInvoiceLink: %w", err)
	}
	defer resp.Body.Close()

	var result CreateInvoiceLinkResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("failed to decode response: %w", err)
	}

	if !result.OK {
		return "", fmt.Errorf("telegram API error: %s", result.Description)
	}

	return result.Result, nil
}

// AnswerPreCheckoutQuery responds to Telegram Stars pre_checkout_query
func (b *BotClient) AnswerPreCheckoutQuery(queryID string, ok bool, errorMessage string) error {
	if b.botToken == "" {
		return nil
	}

	apiURL := fmt.Sprintf("https://api.telegram.org/bot%s/answerPreCheckoutQuery", b.botToken)
	reqBody := map[string]interface{}{
		"pre_checkout_query_id": queryID,
		"ok":                    ok,
	}
	if !ok && errorMessage != "" {
		reqBody["error_message"] = errorMessage
	}

	jsonBytes, _ := json.Marshal(reqBody)
	resp, err := b.httpClient.Post(apiURL, "application/json", bytes.NewBuffer(jsonBytes))
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	return nil
}

// SetWebhook automatically registers the webhook URL with Telegram's Bot API
func (b *BotClient) SetWebhook(webhookURL string) error {
	if b.botToken == "" || webhookURL == "" {
		return nil
	}

	apiURL := fmt.Sprintf("https://api.telegram.org/bot%s/setWebhook", b.botToken)
	reqBody := map[string]interface{}{
		"url":             webhookURL,
		"allowed_updates": []string{"message", "pre_checkout_query", "chat_member", "my_chat_member"},
	}

	jsonBytes, _ := json.Marshal(reqBody)
	resp, err := b.httpClient.Post(apiURL, "application/json", bytes.NewBuffer(jsonBytes))
	if err != nil {
		return fmt.Errorf("failed to call setWebhook: %w", err)
	}
	defer resp.Body.Close()

	var result struct {
		OK          bool   `json:"ok"`
		Description string `json:"description"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return err
	}
	if !result.OK {
		return fmt.Errorf("setWebhook failed: %s", result.Description)
	}

	return nil
}

// SendBroadcastMessage delivers formatted broadcast message with media and inline buttons
func (b *BotClient) SendBroadcastMessage(chatID int64, text, parseMode, mediaURL, mediaType string, buttons [][]map[string]interface{}) error {
	if b.botToken == "" {
		return nil
	}

	if parseMode == "" {
		parseMode = "HTML"
	}

	var apiMethod string
	reqBody := map[string]interface{}{
		"chat_id": chatID,
	}

	if len(buttons) > 0 {
		reqBody["reply_markup"] = map[string]interface{}{
			"inline_keyboard": buttons,
		}
	}

	if mediaURL != "" && mediaType == "photo" {
		apiMethod = "sendPhoto"
		reqBody["photo"] = mediaURL
		reqBody["caption"] = text
		reqBody["parse_mode"] = parseMode
	} else if mediaURL != "" && mediaType == "video" {
		apiMethod = "sendVideo"
		reqBody["video"] = mediaURL
		reqBody["caption"] = text
		reqBody["parse_mode"] = parseMode
	} else {
		apiMethod = "sendMessage"
		reqBody["text"] = text
		reqBody["parse_mode"] = parseMode
	}

	apiURL := fmt.Sprintf("https://api.telegram.org/bot%s/%s", b.botToken, apiMethod)
	jsonBytes, err := json.Marshal(reqBody)
	if err != nil {
		return fmt.Errorf("failed to marshal broadcast request: %w", err)
	}

	// Retry on 429 with backoff
	maxRetries := 2
	for attempt := 0; attempt <= maxRetries; attempt++ {
		resp, err := b.httpClient.Post(apiURL, "application/json", bytes.NewBuffer(jsonBytes))
		if err != nil {
			if attempt == maxRetries {
				return err
			}
			time.Sleep(time.Duration(attempt+1) * 200 * time.Millisecond)
			continue
		}

		var result struct {
			OK          bool   `json:"ok"`
			ErrorCode   int    `json:"error_code,omitempty"`
			Description string `json:"description,omitempty"`
			Parameters  struct {
				RetryAfter int `json:"retry_after,omitempty"`
			} `json:"parameters,omitempty"`
		}
		_ = json.NewDecoder(resp.Body).Decode(&result)
		resp.Body.Close()

		if result.OK {
			return nil
		}

		if result.ErrorCode == 429 {
			retrySec := result.Parameters.RetryAfter
			if retrySec <= 0 {
				retrySec = 1
			}
			if attempt < maxRetries {
				time.Sleep(time.Duration(retrySec) * time.Second)
				continue
			}
		}

		return fmt.Errorf("telegram error %d: %s", result.ErrorCode, result.Description)
	}

	return nil
}
