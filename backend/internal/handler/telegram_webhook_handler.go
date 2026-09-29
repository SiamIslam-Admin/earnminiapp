package handler

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"earnminiapp/internal/config"
	"earnminiapp/internal/db"
	"earnminiapp/internal/model"
	"earnminiapp/internal/repository"
	"earnminiapp/internal/telegram"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

type TelegramUpdate struct {
	UpdateID int64 `json:"update_id"`
	Message  *struct {
		MessageID int64 `json:"message_id"`
		From      *struct {
			ID        int64  `json:"id"`
			FirstName string `json:"first_name"`
			Username  string `json:"username"`
		} `json:"from,omitempty"`
		Chat *struct {
			ID       int64  `json:"id"`
			Type     string `json:"type"`
			Title    string `json:"title,omitempty"`
			Username string `json:"username,omitempty"`
		} `json:"chat,omitempty"`
		Text        string `json:"text,omitempty"`
		Caption     string `json:"caption,omitempty"`
		ChatShared  *struct {
			RequestID int   `json:"request_id"`
			ChatID    int64 `json:"chat_id"`
		} `json:"chat_shared,omitempty"`
		ChatsShared *struct {
			RequestID int     `json:"request_id"`
			ChatIDs   []int64 `json:"chat_ids"`
		} `json:"chats_shared,omitempty"`
		SuccessfulPayment *struct {
			Currency                string `json:"currency"`
			TotalAmount             int    `json:"total_amount"` // Stars amount
			InvoicePayload          string `json:"invoice_payload"`
			TelegramPaymentChargeID string `json:"telegram_payment_charge_id"`
			ProviderPaymentChargeID string `json:"provider_payment_charge_id"`
		} `json:"successful_payment,omitempty"`
	} `json:"message,omitempty"`
	PreCheckoutQuery *struct {
		ID             string `json:"id"`
		InvoicePayload string `json:"invoice_payload"`
		TotalAmount    int    `json:"total_amount"`
		Currency       string `json:"currency"`
	} `json:"pre_checkout_query,omitempty"`
	ChatJoinRequest *struct {
		Chat struct {
			ID       int64  `json:"id"`
			Type     string `json:"type"`
			Title    string `json:"title,omitempty"`
			Username string `json:"username,omitempty"`
		} `json:"chat"`
		From struct {
			ID        int64  `json:"id"`
			FirstName string `json:"first_name"`
			Username  string `json:"username,omitempty"`
		} `json:"from"`
		UserChatID int64 `json:"user_chat_id"`
		Date       int64 `json:"date"`
		InviteLink *struct {
			InviteLink string `json:"invite_link"`
		} `json:"invite_link,omitempty"`
	} `json:"chat_join_request,omitempty"`
}

type TelegramWebhookHandler struct {
	pool          *pgxpool.Pool
	redis         *db.RedisService
	botClient     *telegram.BotClient
	userRepo      *repository.UserRepository
	raffleRepo    *repository.RaffleRepository
	txRepo        *repository.TransactionRepository
	joinRequestRepo *repository.JoinRequestRepository
	cfg           *config.Config
}

func NewTelegramWebhookHandler(
	pool *pgxpool.Pool,
	redis *db.RedisService,
	botClient *telegram.BotClient,
	userRepo *repository.UserRepository,
	raffleRepo *repository.RaffleRepository,
	txRepo *repository.TransactionRepository,
	joinRequestRepo *repository.JoinRequestRepository,
	cfg *config.Config,
) *TelegramWebhookHandler {
	return &TelegramWebhookHandler{
		pool:            pool,
		redis:           redis,
		botClient:       botClient,
		userRepo:        userRepo,
		raffleRepo:      raffleRepo,
		txRepo:          txRepo,
		joinRequestRepo: joinRequestRepo,
		cfg:             cfg,
	}
}

// HandleTelegramWebhook handles Telegram Bot updates
func (h *TelegramWebhookHandler) HandleTelegramWebhook(c *gin.Context) {
	var update TelegramUpdate
	if err := c.ShouldBindJSON(&update); err != nil {
		c.JSON(http.StatusOK, gin.H{"ok": true})
		return
	}

	ctx := context.Background()

	// 0. Handle chat_join_request (For "Request to Join" private channels / groups)
	if update.ChatJoinRequest != nil {
		req := update.ChatJoinRequest
		chatIDStr := fmt.Sprintf("%d", req.Chat.ID)
		chatUsername := req.Chat.Username
		userID := req.From.ID
		var inviteLink string
		if req.InviteLink != nil {
			inviteLink = req.InviteLink.InviteLink
		}

		log.Printf("[INFO] Telegram Chat Join Request received: User %d for Chat %s (@%s)", userID, chatIDStr, chatUsername)
		if h.joinRequestRepo != nil {
			_ = h.joinRequestRepo.RecordJoinRequest(ctx, chatIDStr, chatUsername, userID, inviteLink)
		}
		c.JSON(http.StatusOK, gin.H{"ok": true})
		return
	}

	// 1. Handle pre_checkout_query (Mandatory for Stars checkout)
	if update.PreCheckoutQuery != nil {
		_ = h.botClient.AnswerPreCheckoutQuery(update.PreCheckoutQuery.ID, true, "")
		c.JSON(http.StatusOK, gin.H{"ok": true})
		return
	}

	if update.Message == nil {
		c.JSON(http.StatusOK, gin.H{"ok": true})
		return
	}

	msg := update.Message
	fromUser := msg.From
	var fromID int64
	var firstName string
	if fromUser != nil {
		fromID = fromUser.ID
		firstName = fromUser.FirstName
	}

	// 2. Handle successful_payment
	if msg.SuccessfulPayment != nil {
		h.handleSuccessfulPayment(ctx, msg.SuccessfulPayment)
		c.JSON(http.StatusOK, gin.H{"ok": true})
		return
	}

	// 3. Handle Native Channel/Group Sharing (chat_shared / chats_shared)
	var sharedChatID int64 = 0
	if msg.ChatShared != nil && msg.ChatShared.ChatID != 0 {
		sharedChatID = msg.ChatShared.ChatID
	} else if msg.ChatsShared != nil && len(msg.ChatsShared.ChatIDs) > 0 {
		sharedChatID = msg.ChatsShared.ChatIDs[0]
	}

	if sharedChatID != 0 {
		h.handleSharedChat(ctx, fromID, sharedChatID)
		c.JSON(http.StatusOK, gin.H{"ok": true})
		return
	}

	// 4. Handle Commands & Messages
	text := strings.TrimSpace(msg.Text)

	// Check if admin is currently in broadcast mode
	if h.redis != nil && fromID != 0 {
		broadcastKey := fmt.Sprintf("admin:broadcast:%d", fromID)
		state, _ := h.redis.Get(ctx, broadcastKey)
		if state == "waiting" {
			if text == "/cancel" {
				_ = h.redis.Del(ctx, broadcastKey)
				_ = h.botClient.SendMessage(fromID, "❌ <b>Broadcast cancelled.</b>", nil)
				c.JSON(http.StatusOK, gin.H{"ok": true})
				return
			}

			// Clear broadcast state
			_ = h.redis.Del(ctx, broadcastKey)
			_ = h.botClient.SendMessage(fromID, "⏳ <b>Broadcasting message to all registered users in background...</b>", nil)

			// Broadcast in background
			go h.dispatchBroadcast(fromID, msg.MessageID)
			c.JSON(http.StatusOK, gin.H{"ok": true})
			return
		}
	}

	// /start or /start ref_123
	if strings.HasPrefix(text, "/start") {
		miniAppURL := h.cfg.MiniAppURL
		if miniAppURL == "" {
			miniAppURL = "https://t.me/EarnMiniAppBot/app"
		}
		if err := h.botClient.SendStartWelcome(fromID, firstName, miniAppURL); err != nil {
			log.Printf("[ERROR] Failed to send /start welcome message to %d: %v", fromID, err)
		}
		c.JSON(http.StatusOK, gin.H{"ok": true})
		return
	}

	// /connect or /channels (Opens native request_chat keyboard)
	if text == "/connect" || text == "/channels" {
		if h.isUserAdmin(ctx, fromID) {
			_ = h.botClient.SendConnectChatsKeyboard(fromID)
		} else {
			_ = h.botClient.SendMessage(fromID, "⛔ <i>This command is restricted to administrators.</i>", nil)
		}
		c.JSON(http.StatusOK, gin.H{"ok": true})
		return
	}

	// /br (Broadcast command)
	if text == "/br" {
		if h.isUserAdmin(ctx, fromID) {
			if h.redis != nil {
				_ = h.redis.Set(ctx, fmt.Sprintf("admin:broadcast:%d", fromID), "waiting", 10*time.Minute)
			}
			prompt := "📢 <b>Broadcast Mode Activated!</b>\n\n" +
				"Please send the message you would like to broadcast (Text, Photo with Caption, Video, Sticker, Audio, etc.).\n\n" +
				"👉 <i>The exact layout, media, and formatting will be copied to all users.</i>\n\n" +
				"Send <code>/cancel</code> anytime to abort."
			_ = h.botClient.SendMessage(fromID, prompt, nil)
		} else {
			_ = h.botClient.SendMessage(fromID, "⛔ <i>Access Denied: Only administrators can broadcast.</i>", nil)
		}
		c.JSON(http.StatusOK, gin.H{"ok": true})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// isUserAdmin checks if telegram ID is an admin
func (h *TelegramWebhookHandler) isUserAdmin(ctx context.Context, telegramID int64) bool {
	if telegramID == 0 {
		return false
	}
	var id int64
	err := h.pool.QueryRow(ctx, "SELECT id FROM users WHERE telegram_id = $1", telegramID).Scan(&id)
	return err == nil && id > 0
}

// handleSharedChat saves connected channel/group into connected_chats
func (h *TelegramWebhookHandler) handleSharedChat(ctx context.Context, adminTelegramID, chatID int64) {
	chatInfo, err := h.botClient.GetChat(chatID)
	title := fmt.Sprintf("Channel %d", chatID)
	username := ""
	inviteLink := ""
	chatType := "channel"

	if err == nil && chatInfo != nil {
		if chatInfo.Title != "" {
			title = chatInfo.Title
		}
		username = chatInfo.Username
		inviteLink = chatInfo.InviteLink
		if chatInfo.Type != "" {
			chatType = chatInfo.Type
		}
	}

	var adminUserID *int64
	var uid int64
	if err := h.pool.QueryRow(ctx, "SELECT id FROM users WHERE telegram_id = $1", adminTelegramID).Scan(&uid); err == nil {
		adminUserID = &uid
	}

	query := `
		INSERT INTO connected_chats (chat_id, type, title, username, invite_link, connected_by, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, NOW())
		ON CONFLICT (chat_id) DO UPDATE
		SET title = EXCLUDED.title, username = EXCLUDED.username, invite_link = EXCLUDED.invite_link, type = EXCLUDED.type
	`
	_, _ = h.pool.Exec(ctx, query, chatID, chatType, title, username, inviteLink, adminUserID)

	replyText := fmt.Sprintf(
		"✅ <b>%s Connected Successfully!</b>\n\n"+
			"📌 <b>Title:</b> %s\n"+
			"🆔 <b>Chat ID:</b> <code>%d</code>\n"+
			"🔗 <b>Username / Link:</b> %s\n\n"+
			"👉 Open the <b>Admin Panel</b> inside the Mini App to turn this into a task with 1 click!",
		strings.Title(chatType), title, chatID, username,
	)

	_ = h.botClient.SendMessage(adminTelegramID, replyText, nil)
}

// dispatchBroadcast sends copied message to all registered users with rate-limiting
func (h *TelegramWebhookHandler) dispatchBroadcast(adminTelegramID, messageID int64) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
	defer cancel()

	rows, err := h.pool.Query(ctx, "SELECT telegram_id FROM users WHERE is_banned = false")
	if err != nil {
		_ = h.botClient.SendMessage(adminTelegramID, fmt.Sprintf("❌ Broadcast failed to query users: %v", err), nil)
		return
	}
	defer rows.Close()

	var userIDs []int64
	for rows.Next() {
		var uid int64
		if err := rows.Scan(&uid); err == nil && uid != 0 && uid != adminTelegramID {
			userIDs = append(userIDs, uid)
		}
	}

	total := len(userIDs)
	success := 0
	failed := 0

	for _, uid := range userIDs {
		_, err := h.botClient.CopyMessage(uid, adminTelegramID, messageID)
		if err != nil {
			failed++
		} else {
			success++
		}

		// Rate limit: 35ms sleep = ~28 messages per second (Telegram safe limit is 30/sec)
		time.Sleep(35 * time.Millisecond)
	}

	report := fmt.Sprintf(
		"✅ <b>Broadcast Complete!</b>\n\n"+
			"🎯 <b>Total Users:</b> %d\n"+
			"✅ <b>Delivered:</b> %d\n"+
			"❌ <b>Failed / Blocked:</b> %d",
		total, success, failed,
	)
	_ = h.botClient.SendMessage(adminTelegramID, report, nil)
}

func (h *TelegramWebhookHandler) handleSuccessfulPayment(ctx context.Context, sp *struct {
	Currency                string `json:"currency"`
	TotalAmount             int    `json:"total_amount"` // Stars amount
	InvoicePayload          string `json:"invoice_payload"`
	TelegramPaymentChargeID string `json:"telegram_payment_charge_id"`
	ProviderPaymentChargeID string `json:"provider_payment_charge_id"`
}) {
	parts := strings.Split(sp.InvoicePayload, ":")
	if len(parts) >= 3 && parts[0] == "stars" {
		userID, _ := strconv.ParseInt(parts[1], 10, 64)
		purpose := parts[2]
		raffleID := ""
		if len(parts) >= 4 {
			raffleID = parts[3]
		}
		ticketCount := 0
		if len(parts) >= 5 {
			ticketCount, _ = strconv.Atoi(parts[4])
		}

		user, _ := h.userRepo.GetByID(ctx, userID)

		if purpose == "raffle_tickets" && raffleID != "" {
			if ticketCount <= 0 {
				ticketCount = 1
				if sp.TotalAmount >= 125 {
					ticketCount = 5
				} else if sp.TotalAmount >= 50 {
					ticketCount = 2
				}
			}

			_ = h.raffleRepo.AddTicketsWithDetails(ctx, raffleID, userID, ticketCount, "stars", "stars", sp.TelegramPaymentChargeID)
			_ = h.txRepo.Create(ctx, &model.Transaction{
				UserID:        userID,
				Category:      "raffles",
				Title:         fmt.Sprintf("Raffle Tickets (%s)", raffleID),
				AmountTickets: ticketCount,
				Status:        "completed",
				ReferenceID:   sp.TelegramPaymentChargeID,
				Description:   fmt.Sprintf("+%d Tickets (Paid %d Stars ⭐)", ticketCount, sp.TotalAmount),
			})

			// Notify user in Telegram
			if h.botClient != nil && user != nil && user.TelegramID != 0 {
				confText := fmt.Sprintf(
					"🎟️ <b>Raffle Tickets Confirmed!</b> ⭐\n\n"+
						"✅ Successfully purchased <b>+%d Tickets</b> for <b>%s</b>!\n"+
						"⭐ <b>Amount Paid:</b> %d Telegram Stars\n\n"+
						"🏆 Best of luck in the grand prize draw!",
					ticketCount, raffleID, sp.TotalAmount,
				)
				_ = h.botClient.SendMessage(user.TelegramID, confText, nil)
			}
		} else {
			diamonds := int64(sp.TotalAmount * 100)
			_, _ = h.userRepo.MutateBalances(ctx, userID, 0, diamonds, 0, 0)
			_ = h.txRepo.Create(ctx, &model.Transaction{
				UserID:         userID,
				Category:       "deposit",
				Title:          "Telegram Stars Purchase",
				AmountDiamonds: diamonds,
				Status:         "completed",
				ReferenceID:    sp.TelegramPaymentChargeID,
				Description:    fmt.Sprintf("+%d 💎 (Paid %d Stars ⭐)", diamonds, sp.TotalAmount),
			})

			// Notify user in Telegram
			if h.botClient != nil && user != nil && user.TelegramID != 0 {
				confText := fmt.Sprintf(
					"💎 <b>Stars Purchase Credited!</b> ⭐\n\n"+
						"✅ <b>+%d Diamonds</b> credited to your balance!\n"+
						"⭐ <b>Amount Paid:</b> %d Telegram Stars",
					diamonds, sp.TotalAmount,
				)
				_ = h.botClient.SendMessage(user.TelegramID, confText, nil)
			}
		}

		log.Printf("[INFO] Telegram Stars payment of %d XTR completed for user %d (Charge ID: %s)",
			sp.TotalAmount, userID, sp.TelegramPaymentChargeID)
	}
}
