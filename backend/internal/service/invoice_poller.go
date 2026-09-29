package service

import (
	"context"
	"fmt"
	"log"
	"time"

	"earnminiapp/internal/bsc"
	"earnminiapp/internal/repository"
)

type InvoicePoller struct {
	invoiceRepo    *repository.InvoiceRepository
	invoiceService *InvoiceService
	bscClient      *bsc.BSCClient
	interval       time.Duration
	stopChan       chan struct{}
}

func NewInvoicePoller(
	invoiceRepo *repository.InvoiceRepository,
	invoiceService *InvoiceService,
	bscClient *bsc.BSCClient,
	interval time.Duration,
) *InvoicePoller {
	if interval <= 0 {
		interval = 30 * time.Second
	}
	return &InvoicePoller{
		invoiceRepo:    invoiceRepo,
		invoiceService: invoiceService,
		bscClient:      bscClient,
		interval:       interval,
		stopChan:       make(chan struct{}),
	}
}

func (p *InvoicePoller) Start() {
	go func() {
		log.Printf("[INFO] Background Invoice & Auto-Sweep Engine started (every %v)", p.interval)
		ticker := time.NewTicker(p.interval)
		defer ticker.Stop()

		for {
			select {
			case <-p.stopChan:
				log.Println("[INFO] Background Invoice Poller stopped")
				return
			case <-ticker.C:
				p.pollOnce()
			}
		}
	}()
}

func (p *InvoicePoller) Stop() {
	close(p.stopChan)
}

func (p *InvoicePoller) pollOnce() {
	ctx, cancel := context.WithTimeout(context.Background(), 25*time.Second)
	defer cancel()

	// 1. Clean expired invoices
	_, _ = p.invoiceRepo.ExpireOldInvoices(ctx)

	// 2. Fetch pending invoices to detect incoming deposits
	pendingList, err := p.invoiceRepo.GetPendingInvoices(ctx, 30)
	if err == nil {
		for _, inv := range pendingList {
			if inv.DepositAddress == "" {
				continue
			}

			balance, err := p.bscClient.GetUsdtBalance(ctx, inv.DepositAddress)
			if err != nil {
				continue
			}

			if balance >= inv.AmountUSD {
				txHash := fmt.Sprintf("0xpolled_%s", inv.InvoiceID)
				log.Printf("[INFO] Poller detected $%.2f USDT deposit for Invoice %s! Fulfilling now...", balance, inv.InvoiceID)
				_ = p.invoiceService.FulfillPaidInvoice(ctx, inv.InvoiceID, txHash)
			}
		}
	}

	// 3. Auto-Retry unswept paid invoices to guarantee 0 stuck funds
	unsweptList, err := p.invoiceRepo.GetUnsweptPaidInvoices(ctx, 10)
	if err == nil && len(unsweptList) > 0 {
		for _, inv := range unsweptList {
			sweepCtx, sweepCancel := context.WithTimeout(context.Background(), 45*time.Second)
			_ = p.invoiceService.SweepDepositInvoice(sweepCtx, &inv)
			sweepCancel()
		}
	}
}
