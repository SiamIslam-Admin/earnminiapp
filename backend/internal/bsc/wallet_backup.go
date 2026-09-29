package bsc

import (
	"crypto/ecdsa"
	"encoding/hex"
	"encoding/json"
	"log"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/ethereum/go-ethereum/crypto"
)

var (
	backupMutex sync.Mutex
	walletFilePaths = []string{
		"wallet.json",
		"./wallet.json",
		"/app/wallet.json",
	}
)

type MasterWalletBackup struct {
	Address        string `json:"address"`
	SeedPhrase     string `json:"seed_phrase,omitempty"`
	PrivateKey     string `json:"private_key,omitempty"`
	DerivationPath string `json:"derivation_path,omitempty"`
	Network        string `json:"network"`
	ChainID        int64  `json:"chain_id"`
	UsdtContract   string `json:"usdt_contract"`
	Timestamp      string `json:"timestamp"`
}

type TemporaryDepositAddressBackup struct {
	InvoiceID      string  `json:"invoice_id"`
	UserID         int64   `json:"user_id"`
	WalletIndex    int64   `json:"wallet_index"`
	DepositAddress string  `json:"deposit_address"`
	PrivateKey     string  `json:"private_key"`
	AmountUSD      float64 `json:"amount_usd,omitempty"`
	CreatedAt      string  `json:"created_at"`
}

type WalletFileBackup struct {
	LastUpdated               string                          `json:"last_updated"`
	Network                   string                          `json:"network"`
	ChainID                   int64                           `json:"chain_id"`
	UsdtContract              string                          `json:"usdt_contract"`
	ActiveMasterWallet        *MasterWalletBackup             `json:"active_master_wallet,omitempty"`
	HistoricalMasterWallets   []MasterWalletBackup            `json:"historical_master_wallets"`
	TemporaryDepositAddresses []TemporaryDepositAddressBackup `json:"temporary_deposit_addresses"`
}

func getBackupFilePath() string {
	for _, p := range walletFilePaths {
		dir := filepath.Dir(p)
		if dir == "." || dir == "" {
			return p
		}
		if fi, err := os.Stat(dir); err == nil && fi.IsDir() {
			return p
		}
	}
	return "wallet.json"
}

func loadOrCreateBackup() WalletFileBackup {
	filePath := getBackupFilePath()
	var backup WalletFileBackup

	data, err := os.ReadFile(filePath)
	if err == nil && len(data) > 0 {
		_ = json.Unmarshal(data, &backup)
	}

	if backup.HistoricalMasterWallets == nil {
		backup.HistoricalMasterWallets = make([]MasterWalletBackup, 0)
	}
	if backup.TemporaryDepositAddresses == nil {
		backup.TemporaryDepositAddresses = make([]TemporaryDepositAddressBackup, 0)
	}
	if backup.Network == "" {
		backup.Network = "BNB Smart Chain (BEP-20)"
	}
	if backup.ChainID == 0 {
		backup.ChainID = 56
	}
	if backup.UsdtContract == "" {
		backup.UsdtContract = "0x55d398326f99059fF775485246999027B3197955"
	}

	return backup
}

func writeBackupFile(backup WalletFileBackup) error {
	filePath := getBackupFilePath()
	data, err := json.MarshalIndent(backup, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(filePath, data, 0644)
}

// SaveMasterWalletToBackup updates wallet.json with the active master wallet and adds to historical history
func SaveMasterWalletToBackup(mnemonic, privateKeyHex, address, derivationPath, usdtContract string, chainID int64) {
	backupMutex.Lock()
	defer backupMutex.Unlock()

	backup := loadOrCreateBackup()
	now := time.Now().UTC().Format(time.RFC3339)

	master := MasterWalletBackup{
		Address:        address,
		SeedPhrase:     mnemonic,
		PrivateKey:     privateKeyHex,
		DerivationPath: derivationPath,
		Network:        "BNB Smart Chain (BEP-20)",
		ChainID:        chainID,
		UsdtContract:   usdtContract,
		Timestamp:      now,
	}

	backup.LastUpdated = now
	backup.ChainID = chainID
	backup.UsdtContract = usdtContract
	backup.ActiveMasterWallet = &master

	// Check if already in historical list
	exists := false
	for _, h := range backup.HistoricalMasterWallets {
		if h.Address == address && (h.PrivateKey == privateKeyHex || privateKeyHex == "") {
			exists = true
			break
		}
	}
	if !exists && address != "" {
		backup.HistoricalMasterWallets = append(backup.HistoricalMasterWallets, master)
	}

	if err := writeBackupFile(backup); err != nil {
		log.Printf("[WARN] Failed to write wallet.json backup: %v", err)
	} else {
		log.Printf("[INFO] Successfully saved Master Wallet (%s) to wallet.json backup", address)
	}
}

// SaveTemporaryDepositAddressToBackup appends a generated deposit address & private key to wallet.json
func SaveTemporaryDepositAddressToBackup(invoiceID string, userID, walletIndex int64, depositAddress string, privKey *ecdsa.PrivateKey, amountUSD float64) {
	if depositAddress == "" {
		return
	}

	backupMutex.Lock()
	defer backupMutex.Unlock()

	backup := loadOrCreateBackup()
	now := time.Now().UTC().Format(time.RFC3339)

	var privKeyHex string
	if privKey != nil {
		privKeyHex = "0x" + hex.EncodeToString(crypto.FromECDSA(privKey))
	}

	item := TemporaryDepositAddressBackup{
		InvoiceID:      invoiceID,
		UserID:         userID,
		WalletIndex:    walletIndex,
		DepositAddress: depositAddress,
		PrivateKey:     privKeyHex,
		AmountUSD:      amountUSD,
		CreatedAt:      now,
	}

	// Avoid duplicates by invoiceID
	duplicate := false
	for _, existing := range backup.TemporaryDepositAddresses {
		if existing.InvoiceID == invoiceID && invoiceID != "" {
			duplicate = true
			break
		}
	}

	if !duplicate {
		backup.TemporaryDepositAddresses = append(backup.TemporaryDepositAddresses, item)
		backup.LastUpdated = now
		if err := writeBackupFile(backup); err != nil {
			log.Printf("[WARN] Failed to save deposit address %s to wallet.json: %v", depositAddress, err)
		} else {
			log.Printf("[INFO] Persisted child deposit address %s (Invoice %s) to wallet.json", depositAddress, invoiceID)
		}
	}
}