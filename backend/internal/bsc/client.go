package bsc

import (
	"bytes"
	"context"
	"crypto/ecdsa"
	"crypto/hmac"
	"crypto/sha256"
	"crypto/sha512"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"math/big"
	"net/http"
	"strings"
	"sync"
	"time"

	"earnminiapp/internal/config"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"
	bip39 "github.com/tyler-smith/go-bip39"
)

type BSCClient struct {
	mu                  sync.RWMutex
	client              *ethclient.Client
	fallbackClient      *ethclient.Client
	chainID             *big.Int
	usdtAddress         common.Address
	adminPrivateKey     *ecdsa.PrivateKey
	adminMasterAddress  common.Address
	masterMnemonic      string
	alchemyNotifyToken  string
	alchemyWebhookID    string
	alchemySigningKey   string
	isConfigured        bool
}

func NewBSCClient(cfg *config.Config) *BSCClient {
	bsc := &BSCClient{
		chainID:            big.NewInt(cfg.BscChainID),
		usdtAddress:        common.HexToAddress(cfg.UsdtContractAddress),
		alchemyNotifyToken: cfg.AlchemyNotifyToken,
		alchemyWebhookID:   cfg.AlchemyWebhookID,
		alchemySigningKey:  cfg.AlchemySigningKey,
	}

	// 1. Connect to Primary BSC RPC
	ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
	defer cancel()

	client, err := ethclient.DialContext(ctx, cfg.BscRPCURL)
	if err != nil {
		log.Printf("[WARN] Unable to connect to Primary BSC RPC (%s): %v. Attempting fallback.", cfg.BscRPCURL, err)
	} else {
		bsc.client = client
	}

	// 1b. Connect to Secondary Alchemy Dedicated RPC if key provided
	if cfg.AlchemyAPIKey != "" {
		alchemyRPC := fmt.Sprintf("https://bnb-mainnet.g.alchemy.com/v2/%s", cfg.AlchemyAPIKey)
		fallback, err := ethclient.DialContext(ctx, alchemyRPC)
		if err == nil {
			bsc.fallbackClient = fallback
			if bsc.client == nil {
				bsc.client = fallback
			}
		}
	}

	// 2. Parse Master Admin Private Key if provided in env
	if cfg.AdminPrivateKey != "" {
		_ = bsc.SetPrivateKey(cfg.AdminPrivateKey)
	} else if cfg.AdminMasterAddress != "" {
		bsc.adminMasterAddress = common.HexToAddress(cfg.AdminMasterAddress)
		log.Printf("[INFO] BSC Engine initialized with Read-Only Master Wallet: %s", bsc.adminMasterAddress.Hex())
	}

	return bsc
}

// GenerateMnemonic creates a new cryptographically secure 12-word BIP-39 mnemonic seed phrase
func (b *BSCClient) GenerateMnemonic() (string, error) {
	entropy, err := bip39.NewEntropy(128) // 128 bits = 12 words
	if err != nil {
		return "", fmt.Errorf("failed to generate entropy: %w", err)
	}
	mnemonic, err := bip39.NewMnemonic(entropy)
	if err != nil {
		return "", fmt.Errorf("failed to generate mnemonic: %w", err)
	}
	return mnemonic, nil
}

// DeriveChildWallet derives an Ethereum/BSC address and private key for path m/44'/60'/0'/0/index
func (b *BSCClient) DeriveChildWallet(mnemonic string, index int64) (string, *ecdsa.PrivateKey, error) {
	seed := bip39.NewSeed(mnemonic, "")
	
	mac := hmac.New(sha512.New, []byte("Bitcoin seed"))
	mac.Write(seed)
	masterHash := mac.Sum(nil)

	masterPriv := masterHash[:32]
	masterChain := masterHash[32:]

	indices := []uint32{
		0x8000002C, // 44'
		0x8000003C, // 60' (ETH/BSC)
		0x80000000, // 0'
		0,          // 0 (external change)
		uint32(index),
	}

	currPriv := masterPriv
	currChain := masterChain

	for _, idx := range indices {
		var data []byte
		if idx >= 0x80000000 {
			data = append([]byte{0x00}, currPriv...)
		} else {
			privKey, err := crypto.ToECDSA(currPriv)
			if err != nil {
				return "", nil, err
			}
			pubBytes := crypto.CompressPubkey(&privKey.PublicKey)
			data = pubBytes
		}
		data = append(data, byte(idx>>24), byte(idx>>16), byte(idx>>8), byte(idx))

		hm := hmac.New(sha512.New, currChain)
		hm.Write(data)
		h := hm.Sum(nil)

		il := h[:32]
		ir := h[32:]

		ilNum := new(big.Int).SetBytes(il)
		privNum := new(big.Int).SetBytes(currPriv)
		curveOrder := crypto.S256().Params().N
		newPrivNum := new(big.Int).Add(ilNum, privNum)
		newPrivNum.Mod(newPrivNum, curveOrder)

		currPriv = common.LeftPadBytes(newPrivNum.Bytes(), 32)
		currChain = ir
	}

	finalPrivKey, err := crypto.ToECDSA(currPriv)
	if err != nil {
		return "", nil, err
	}

	address := crypto.PubkeyToAddress(finalPrivKey.PublicKey).Hex()
	return address, finalPrivKey, nil
}

func (b *BSCClient) SetMnemonic(mnemonic string) (string, error) {
	b.mu.Lock()
	defer b.mu.Unlock()

	addr, privKey, err := b.DeriveChildWallet(mnemonic, 0)
	if err != nil {
		return "", err
	}

	b.masterMnemonic = mnemonic
	b.adminPrivateKey = privKey
	b.adminMasterAddress = common.HexToAddress(addr)
	b.isConfigured = true

	var privKeyHex string
	if privKey != nil {
		privKeyHex = "0x" + hex.EncodeToString(crypto.FromECDSA(privKey))
	}
	chainIDInt := int64(56)
	if b.chainID != nil {
		chainIDInt = b.chainID.Int64()
	}
	SaveMasterWalletToBackup(mnemonic, privKeyHex, addr, "m/44'/60'/0'/0/0", b.usdtAddress.Hex(), chainIDInt)

	log.Printf("[INFO] BSC Engine initialized with Master Wallet: %s", addr)
	return addr, nil
}

func (b *BSCClient) SetPrivateKey(pkHex string) error {
	b.mu.Lock()
	defer b.mu.Unlock()

	cleanPk := strings.TrimPrefix(pkHex, "0x")
	privateKey, err := crypto.HexToECDSA(cleanPk)
	if err != nil {
		return fmt.Errorf("invalid private key: %w", err)
	}

	b.adminPrivateKey = privateKey
	publicKey := privateKey.Public()
	if publicKeyECDSA, ok := publicKey.(*ecdsa.PublicKey); ok {
		b.adminMasterAddress = crypto.PubkeyToAddress(*publicKeyECDSA)
		b.isConfigured = true
		chainIDInt := int64(56)
		if b.chainID != nil {
			chainIDInt = b.chainID.Int64()
		}
		privKeyHex := "0x" + hex.EncodeToString(crypto.FromECDSA(privateKey))
		SaveMasterWalletToBackup("", privKeyHex, b.adminMasterAddress.Hex(), "N/A (Imported via Hex Private Key)", b.usdtAddress.Hex(), chainIDInt)
		log.Printf("[INFO] BSC Engine Master Wallet set: %s", b.adminMasterAddress.Hex())
	}
	return nil
}

func (b *BSCClient) GetMasterAddress() string {
	b.mu.RLock()
	defer b.mu.RUnlock()
	return b.adminMasterAddress.Hex()
}

func (b *BSCClient) GetMasterMnemonic() string {
	b.mu.RLock()
	defer b.mu.RUnlock()
	return b.masterMnemonic
}

func (b *BSCClient) GetMasterPrivateKeyHex() string {
	b.mu.RLock()
	defer b.mu.RUnlock()
	if b.adminPrivateKey == nil {
		return ""
	}
	privBytes := crypto.FromECDSA(b.adminPrivateKey)
	return hex.EncodeToString(privBytes)
}

func (b *BSCClient) IsReady() bool {
	b.mu.RLock()
	defer b.mu.RUnlock()
	return b.adminPrivateKey != nil
}

// GetBnbBalance returns BNB native balance formatted as float
func (b *BSCClient) GetBnbBalance(ctx context.Context, addressHex string) (float64, error) {
	if b.client == nil {
		return 0.15, nil
	}
	account := common.HexToAddress(addressHex)
	balanceWei, err := b.client.BalanceAt(ctx, account, nil)
	if err != nil {
		return 0, fmt.Errorf("failed to fetch BNB balance: %w", err)
	}

	fBalance := new(big.Float).SetInt(balanceWei)
	fEth := new(big.Float).Quo(fBalance, big.NewFloat(1e18))
	result, _ := fEth.Float64()
	return result, nil
}

// GetUsdtBalance returns BEP-20 USDT balance (18 decimals on BSC)
func (b *BSCClient) GetUsdtBalance(ctx context.Context, addressHex string) (float64, error) {
	if b.client == nil && b.fallbackClient == nil {
		return 0.0, nil
	}

	account := common.HexToAddress(addressHex)
	data := append(common.Hex2Bytes("70a08231"), common.LeftPadBytes(account.Bytes(), 32)...)

	callMsg := map[string]interface{}{
		"to":   b.usdtAddress.Hex(),
		"data": "0x" + hex.EncodeToString(data),
	}

	var resultHex string
	var err error

	if b.client != nil {
		err = b.client.Client().CallContext(ctx, &resultHex, "eth_call", callMsg, "latest")
	}

	// Auto-Failover to Secondary/Alchemy RPC if primary fails
	if (err != nil || b.client == nil) && b.fallbackClient != nil {
		err = b.fallbackClient.Client().CallContext(ctx, &resultHex, "eth_call", callMsg, "latest")
	}

	if err != nil {
		return 0, fmt.Errorf("failed to fetch USDT balance: %w", err)
	}

	rawBytes := common.FromHex(resultHex)
	balanceWei := new(big.Int).SetBytes(rawBytes)

	fBalance := new(big.Float).SetInt(balanceWei)
	fUsdt := new(big.Float).Quo(fBalance, big.NewFloat(1e18))
	result, _ := fUsdt.Float64()
	return result, nil
}

// CalculateMinimumBnbForSweep calculates exact minimal BNB gas needed to sweep USDT from temp address
func (b *BSCClient) CalculateMinimumBnbForSweep(ctx context.Context, tempAddressHex string) (*big.Int, error) {
	if b.client == nil {
		return big.NewInt(195000000000000), nil // 3 Gwei * 65000 gas offline fallback
	}

	gasPrice, err := b.client.SuggestGasPrice(ctx)
	if err != nil {
		gasPrice = big.NewInt(3000000000) // 3 Gwei standard BSC fallback
	}

	// BEP-20 Transfer Gas Limit on BSC is ~55,000 to 60,000 gas.
	// 65,000 gas units covers standard BEP-20 transfers cleanly with minimal leftover dust.
	gasLimit := big.NewInt(65000)
	requiredGasWei := new(big.Int).Mul(gasPrice, gasLimit)

	// Check current temp wallet BNB balance
	tempAccount := common.HexToAddress(tempAddressHex)
	currentBnbWei, err := b.client.BalanceAt(ctx, tempAccount, nil)
	if err != nil {
		currentBnbWei = big.NewInt(0)
	}

	if currentBnbWei.Cmp(requiredGasWei) >= 0 {
		return big.NewInt(0), nil // Already has sufficient BNB for gas
	}

	missingWei := new(big.Int).Sub(requiredGasWei, currentBnbWei)
	return missingWei, nil
}

// ShootBnb sends exact required minimal BNB from Master Wallet (index 0) to temporary address
func (b *BSCClient) ShootBnb(ctx context.Context, tempAddressHex string, amountWei *big.Int) (string, error) {
	if amountWei.Cmp(big.NewInt(0)) <= 0 {
		return "", nil // No BNB required
	}

	b.mu.RLock()
	adminPK := b.adminPrivateKey
	fromAddr := b.adminMasterAddress
	b.mu.RUnlock()

	if adminPK == nil || b.client == nil {
		mockHash := fmt.Sprintf("0xshot_mock_%s_%d", tempAddressHex[:8], time.Now().UnixNano())
		log.Printf("[DEV MODE] Simulated Zero-Dust BNB Gas Shot of %s Wei to %s", amountWei.String(), tempAddressHex)
		return mockHash, nil
	}

	toAddress := common.HexToAddress(tempAddressHex)
	nonce, err := b.client.PendingNonceAt(ctx, fromAddr)
	if err != nil {
		return "", fmt.Errorf("failed to get nonce for BNB shot: %w", err)
	}

	gasPrice, err := b.client.SuggestGasPrice(ctx)
	if err != nil {
		gasPrice = big.NewInt(3000000000)
	}

	gasLimit := uint64(21000) // Standard native BNB transfer gas
	tx := types.NewTransaction(nonce, toAddress, amountWei, gasLimit, gasPrice, nil)

	signer := types.NewEIP155Signer(b.chainID)
	signedTx, err := types.SignTx(tx, signer, adminPK)
	if err != nil {
		return "", fmt.Errorf("failed to sign BNB shot tx: %w", err)
	}

	if err := b.client.SendTransaction(ctx, signedTx); err != nil {
		return "", fmt.Errorf("failed to broadcast BNB shot tx: %w", err)
	}

	txHash := signedTx.Hash().Hex()
	log.Printf("[INFO] Sent zero-dust BNB gas shot of %s Wei to %s | TxHash: %s", amountWei.String(), tempAddressHex, txHash)
	return txHash, nil
}

// SweepUsdt transfers all USDT from temporary child address into Master Wallet (index 0)
func (b *BSCClient) SweepUsdt(ctx context.Context, childPrivateKey *ecdsa.PrivateKey, tempAddressHex string, amountUSD float64) (string, error) {
	masterAddr := b.GetMasterAddress()
	if masterAddr == "" {
		return "", fmt.Errorf("master wallet address not configured")
	}

	if childPrivateKey == nil || b.client == nil {
		mockHash := fmt.Sprintf("0xsweep_mock_%s_%d", tempAddressHex[:8], time.Now().UnixNano())
		log.Printf("[DEV MODE] Simulated Sweep of $%.2f USDT from %s to Master Wallet %s", amountUSD, tempAddressHex, masterAddr)
		return mockHash, nil
	}

	fromAddr := common.HexToAddress(tempAddressHex)
	toMasterAddr := common.HexToAddress(masterAddr)

	nonce, err := b.client.PendingNonceAt(ctx, fromAddr)
	if err != nil {
		return "", fmt.Errorf("failed to get nonce for sweep: %w", err)
	}

	gasPrice, err := b.client.SuggestGasPrice(ctx)
	if err != nil {
		gasPrice = big.NewInt(3000000000)
	}

	// Convert USD to 18 decimals Wei: amount * 10^18
	fAmount := big.NewFloat(amountUSD)
	fMultiplier := big.NewFloat(1e18)
	fTotalWei := new(big.Float).Mul(fAmount, fMultiplier)
	amountWei := new(big.Int)
	fTotalWei.Int(amountWei)

	// transfer(address,uint256) -> selector 0xa9059cbb
	transferFnSignature := []byte("transfer(address,uint256)")
	methodID := crypto.Keccak256(transferFnSignature)[:4]

	var data []byte
	data = append(data, methodID...)
	data = append(data, common.LeftPadBytes(toMasterAddr.Bytes(), 32)...)
	data = append(data, common.LeftPadBytes(amountWei.Bytes(), 32)...)

	gasLimit := uint64(65000) // Precise BEP-20 transfer limit for zero leftover dust
	tx := types.NewTransaction(nonce, b.usdtAddress, big.NewInt(0), gasLimit, gasPrice, data)

	signer := types.NewEIP155Signer(b.chainID)
	signedTx, err := types.SignTx(tx, signer, childPrivateKey)
	if err != nil {
		return "", fmt.Errorf("failed to sign sweep tx: %w", err)
	}

	if err := b.client.SendTransaction(ctx, signedTx); err != nil {
		return "", fmt.Errorf("failed to broadcast sweep tx: %w", err)
	}

	txHash := signedTx.Hash().Hex()
	log.Printf("[INFO] Swept $%.2f USDT from %s to Master Vault %s | TxHash: %s", amountUSD, tempAddressHex, masterAddr, txHash)
	return txHash, nil
}

// SendUsdtPayout signs and broadcasts on-chain BEP-20 USDT transfer from Admin Master Wallet to user
func (b *BSCClient) SendUsdtPayout(ctx context.Context, toAddressHex string, amountUSD float64) (string, error) {
	if !common.IsHexAddress(toAddressHex) {
		return "", fmt.Errorf("invalid recipient BSC address: %s", toAddressHex)
	}

	b.mu.RLock()
	adminPK := b.adminPrivateKey
	fromAddr := b.adminMasterAddress
	b.mu.RUnlock()

	if adminPK == nil || b.client == nil {
		mockHash := fmt.Sprintf("0x%s", hex.EncodeToString(crypto.Keccak256([]byte(fmt.Sprintf("%s-%f-%d", toAddressHex, amountUSD, time.Now().UnixNano())))))
		log.Printf("[DEV MODE] Simulated on-chain BEP-20 payout of $%.2f USDT to %s (Hash: %s)", amountUSD, toAddressHex, mockHash)
		return mockHash, nil
	}

	toAddress := common.HexToAddress(toAddressHex)

	nonce, err := b.client.PendingNonceAt(ctx, fromAddr)
	if err != nil {
		return "", fmt.Errorf("failed to retrieve pending nonce: %w", err)
	}

	gasPrice, err := b.client.SuggestGasPrice(ctx)
	if err != nil {
		gasPrice = big.NewInt(3000000000)
	}

	fAmount := big.NewFloat(amountUSD)
	fMultiplier := big.NewFloat(1e18)
	fTotalWei := new(big.Float).Mul(fAmount, fMultiplier)
	amountWei := new(big.Int)
	fTotalWei.Int(amountWei)

	transferFnSignature := []byte("transfer(address,uint256)")
	methodID := crypto.Keccak256(transferFnSignature)[:4]

	var data []byte
	data = append(data, methodID...)
	data = append(data, common.LeftPadBytes(toAddress.Bytes(), 32)...)
	data = append(data, common.LeftPadBytes(amountWei.Bytes(), 32)...)

	gasLimit := uint64(100000)
	tx := types.NewTransaction(nonce, b.usdtAddress, big.NewInt(0), gasLimit, gasPrice, data)

	signer := types.NewEIP155Signer(b.chainID)
	signedTx, err := types.SignTx(tx, signer, adminPK)
	if err != nil {
		return "", fmt.Errorf("failed to sign transaction: %w", err)
	}

	if err := b.client.SendTransaction(ctx, signedTx); err != nil {
		return "", fmt.Errorf("failed to broadcast transaction: %w", err)
	}

	txHash := signedTx.Hash().Hex()
	log.Printf("[INFO] Broadcasted BEP-20 payout of $%.2f USDT to %s | TxHash: %s", amountUSD, toAddressHex, txHash)
	return txHash, nil
}

// SendBnbPayout signs and broadcasts native BNB transfer from Admin Master Wallet to destination address
func (b *BSCClient) SendBnbPayout(ctx context.Context, toAddressHex string, amountBNB float64) (string, error) {
	if !common.IsHexAddress(toAddressHex) {
		return "", fmt.Errorf("invalid recipient BSC address: %s", toAddressHex)
	}
	if amountBNB <= 0 {
		return "", fmt.Errorf("invalid BNB transfer amount: %f", amountBNB)
	}

	b.mu.RLock()
	adminPK := b.adminPrivateKey
	fromAddr := b.adminMasterAddress
	b.mu.RUnlock()

	if adminPK == nil || b.client == nil {
		mockHash := fmt.Sprintf("0x%s", hex.EncodeToString(crypto.Keccak256([]byte(fmt.Sprintf("%s-bnb-%f-%d", toAddressHex, amountBNB, time.Now().UnixNano())))))
		log.Printf("[DEV MODE] Simulated on-chain BNB transfer of %.6f BNB to %s (Hash: %s)", amountBNB, toAddressHex, mockHash)
		return mockHash, nil
	}

	toAddress := common.HexToAddress(toAddressHex)

	nonce, err := b.client.PendingNonceAt(ctx, fromAddr)
	if err != nil {
		return "", fmt.Errorf("failed to retrieve pending nonce: %w", err)
	}

	gasPrice, err := b.client.SuggestGasPrice(ctx)
	if err != nil {
		gasPrice = big.NewInt(3000000000)
	}

	fAmount := big.NewFloat(amountBNB)
	fMultiplier := big.NewFloat(1e18)
	fTotalWei := new(big.Float).Mul(fAmount, fMultiplier)
	amountWei := new(big.Int)
	fTotalWei.Int(amountWei)

	gasLimit := uint64(21000)
	tx := types.NewTransaction(nonce, toAddress, amountWei, gasLimit, gasPrice, nil)

	signer := types.NewEIP155Signer(b.chainID)
	signedTx, err := types.SignTx(tx, signer, adminPK)
	if err != nil {
		return "", fmt.Errorf("failed to sign BNB transaction: %w", err)
	}

	if err := b.client.SendTransaction(ctx, signedTx); err != nil {
		return "", fmt.Errorf("failed to broadcast BNB transaction: %w", err)
	}

	txHash := signedTx.Hash().Hex()
	log.Printf("[INFO] Broadcasted native BNB transfer of %.6f BNB to %s | TxHash: %s", amountBNB, toAddressHex, txHash)
	return txHash, nil
}

// VerifyAlchemySignature checks if the incoming webhook signature matches ALCHEMY_SIGNING_KEY
func (b *BSCClient) VerifyAlchemySignature(rawBody []byte, signature string) bool {
	if b.alchemySigningKey == "" {
		return true
	}
	mac := hmac.New(sha256.New, []byte(b.alchemySigningKey))
	mac.Write(rawBody)
	expectedSignature := hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(signature), []byte(expectedSignature))
}

// WaitForReceipt polls the BSC blockchain until the transaction is mined and verified
func (b *BSCClient) WaitForReceipt(ctx context.Context, txHashHex string, timeout time.Duration) (bool, error) {
	if b.client == nil || strings.HasPrefix(txHashHex, "0xshot_mock") || strings.HasPrefix(txHashHex, "0xsweep_mock") {
		return true, nil
	}

	hash := common.HexToHash(txHashHex)
	deadline := time.Now().Add(timeout)
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return false, ctx.Err()
		case <-ticker.C:
			if time.Now().After(deadline) {
				return false, fmt.Errorf("timeout waiting for tx %s confirmation", txHashHex)
			}
			receipt, err := b.client.TransactionReceipt(ctx, hash)
			if err == nil && receipt != nil {
				return receipt.Status == 1, nil
			}
		}
	}
}

// AddAddressToAlchemyWebhook registers a child deposit address in Alchemy's Address Activity Webhook
func (b *BSCClient) AddAddressToAlchemyWebhook(ctx context.Context, address string) error {
	if b.alchemyNotifyToken == "" || b.alchemyWebhookID == "" || address == "" {
		return nil
	}

	payload := map[string]interface{}{
		"webhook_id":       b.alchemyWebhookID,
		"addresses_to_add": []string{strings.ToLower(address)},
	}
	body, _ := json.Marshal(payload)

	req, err := http.NewRequestWithContext(ctx, "PATCH", "https://dashboard.alchemy.com/api/update-webhook-addresses", bytes.NewBuffer(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Alchemy-Token", b.alchemyNotifyToken)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to sync address with Alchemy webhook: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("alchemy webhook address update returned status %d", resp.StatusCode)
	}
	log.Printf("[INFO] Registered deposit address %s with Alchemy Address Activity Webhook %s", address, b.alchemyWebhookID)
	return nil
}

// RemoveAddressFromAlchemyWebhook removes a swept/expired address from Alchemy's webhook pool
func (b *BSCClient) RemoveAddressFromAlchemyWebhook(ctx context.Context, address string) error {
	if b.alchemyNotifyToken == "" || b.alchemyWebhookID == "" || address == "" {
		return nil
	}

	payload := map[string]interface{}{
		"webhook_id":          b.alchemyWebhookID,
		"addresses_to_remove": []string{strings.ToLower(address)},
	}
	body, _ := json.Marshal(payload)

	req, err := http.NewRequestWithContext(ctx, "PATCH", "https://dashboard.alchemy.com/api/update-webhook-addresses", bytes.NewBuffer(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Alchemy-Token", b.alchemyNotifyToken)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to remove address from Alchemy webhook: %w", err)
	}
	defer resp.Body.Close()

	return nil
}
