package handler_test

import (
	"encoding/json"
	"testing"

	"earnminiapp/internal/handler"
)

func TestTelegramUpdatePayloads(t *testing.T) {
	// 1. Test /start update parsing
	startJSON := `{
		"update_id": 1001,
		"message": {
			"message_id": 42,
			"from": { "id": 123456, "first_name": "Alex", "username": "alex_ton" },
			"text": "/start"
		}
	}`
	var update1 handler.TelegramUpdate
	if err := json.Unmarshal([]byte(startJSON), &update1); err != nil {
		t.Fatalf("Failed to parse /start update: %v", err)
	}
	if update1.Message.Text != "/start" || update1.Message.From.ID != 123456 {
		t.Errorf("Unexpected message parsing: %+v", update1.Message)
	}

	// 2. Test chat_shared (Bot API 6.5)
	chatSharedJSON := `{
		"update_id": 1002,
		"message": {
			"message_id": 43,
			"from": { "id": 123456, "first_name": "Alex" },
			"chat_shared": {
				"request_id": 1,
				"chat_id": -1001928374650
			}
		}
	}`
	var update2 handler.TelegramUpdate
	if err := json.Unmarshal([]byte(chatSharedJSON), &update2); err != nil {
		t.Fatalf("Failed to parse chat_shared update: %v", err)
	}
	if update2.Message.ChatShared == nil || update2.Message.ChatShared.ChatID != -1001928374650 {
		t.Errorf("Unexpected chat_shared parsing: %+v", update2.Message.ChatShared)
	}

	// 3. Test chats_shared (Bot API 7.0+)
	chatsSharedJSON := `{
		"update_id": 1003,
		"message": {
			"message_id": 44,
			"from": { "id": 123456, "first_name": "Alex" },
			"chats_shared": {
				"request_id": 2,
				"chat_ids": [-1009876543210]
			}
		}
	}`
	var update3 handler.TelegramUpdate
	if err := json.Unmarshal([]byte(chatsSharedJSON), &update3); err != nil {
		t.Fatalf("Failed to parse chats_shared update: %v", err)
	}
	if update3.Message.ChatsShared == nil || len(update3.Message.ChatsShared.ChatIDs) == 0 || update3.Message.ChatsShared.ChatIDs[0] != -1009876543210 {
		t.Errorf("Unexpected chats_shared parsing: %+v", update3.Message.ChatsShared)
	}
}
