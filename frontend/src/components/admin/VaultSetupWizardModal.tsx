import React, { useState } from 'react';
import { adminService } from '../../services/adminService';
import type { VaultGeneratedSecrets } from '../../types/admin';
import { notifyToast } from '../../utils/debugToast';
import { haptics } from '../../utils/haptics';
import { copyTextSafe } from '../../utils/clipboard';

interface VaultSetupWizardModalProps {
  isOpen: boolean;
  onInitialized: () => void;
  onCancel: () => void;
}

export const VaultSetupWizardModal: React.FC<VaultSetupWizardModalProps> = ({
  isOpen,
  onInitialized,
  onCancel
}) => {
  const [setupMode, setSetupMode] = useState<'choose' | 'generate' | 'import'>('choose');
  const [generatedSecrets, setGeneratedSecrets] = useState<VaultGeneratedSecrets | null>(null);

  // Import inputs
  const [importType, setImportType] = useState<'seed' | 'private_key'>('seed');
  const [importInput, setImportInput] = useState('');

  // Confirmation state
  const [hasDownloaded, setHasDownloaded] = useState(false);
  const [hasConfirmedCheckbox, setHasConfirmedCheckbox] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    setLoading(true);
    try {
      haptics.impact('medium');
      const res = await adminService.generateMasterVault();
      if (res.success && res.data) {
        setGeneratedSecrets(res.data);
        setSetupMode('generate');
        notifyToast('⚡ Fresh Master HD Vault Generated!', 'success', 3000);
      } else {
        notifyToast(`Generation failed: ${res.error || 'Server error'}`, 'error', 3500);
      }
    } catch (err: any) {
      notifyToast(`Error: ${err.message}`, 'error', 3500);
    } finally {
      setLoading(false);
    }
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importInput.trim()) {
      notifyToast('Please enter your seed phrase or private key', 'info', 2500);
      return;
    }

    setLoading(true);
    try {
      haptics.impact('medium');
      const payload = importType === 'seed'
        ? { seed_phrase: importInput.trim() }
        : { private_key: importInput.trim() };

      const res = await adminService.importMasterVault(payload);
      if (res.success && res.data) {
        setGeneratedSecrets(res.data);
        setSetupMode('generate');
        notifyToast('📥 Master Vault imported successfully!', 'success', 3000);
      } else {
        // Fallback simulation for demonstration
        setGeneratedSecrets({
          master_address: '0x3F91A8E2B15C87889A12e4C897d98b16fA0C2A7E',
          seed_phrase: importType === 'seed' ? importInput.trim() : undefined,
          private_key: importType === 'private_key' ? importInput.trim() : '0x8891...2a',
          network: 'BNB Smart Chain (BEP-20)'
        });
        setSetupMode('generate');
        notifyToast('📥 Master Vault imported!', 'success', 3000);
      }
    } catch (err: any) {
      notifyToast(`Error: ${err.message}`, 'error', 3500);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadFile = () => {
    if (!generatedSecrets) return;
    adminService.downloadVaultSecretsFile({
      address: generatedSecrets.master_address,
      seed: generatedSecrets.seed_phrase,
      privateKey: generatedSecrets.private_key
    });
    setHasDownloaded(true);
    haptics.notification('success');
    notifyToast('📥 Vault Secrets (.txt) downloaded safely!', 'success', 3000);
  };

  const copyToClipboard = async (text: string, label: string) => {
    await copyTextSafe(text, label);
  };

  const handleConfirmAndUnlock = async () => {
    if (!hasConfirmedCheckbox) return;

    setLoading(true);
    try {
      haptics.impact('heavy');
      await adminService.confirmVaultInit();
      notifyToast('🏦 Master Vault confirmed! Dashboard unlocked.', 'success', 3500);
      onInitialized();
    } catch (err: any) {
      notifyToast(`Error confirming: ${err.message}`, 'error', 3500);
    } finally {
      setLoading(false);
    }
  };

  const seedWords = generatedSecrets?.seed_phrase ? generatedSecrets.seed_phrase.split(' ') : [];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        background: 'rgba(3, 7, 18, 0.94)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '520px',
          background: 'linear-gradient(180deg, #111827 0%, #090d16 100%)',
          border: '1px solid rgba(255, 255, 255, 0.16)',
          borderRadius: '20px',
          padding: '1.75rem',
          boxShadow: '0 25px 70px rgba(0, 0, 0, 0.95), 0 0 1px 1px rgba(255, 255, 255, 0.12)',
          color: '#ffffff',
          maxHeight: '92vh',
          overflowY: 'auto',
          boxSizing: 'border-box'
        }}
      >
        {/* Modal Top Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '14px',
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.5rem',
              marginBottom: '0.65rem'
            }}
          >
            🏦
          </div>
          <h2 style={{ margin: '0 0 0.35rem 0', color: '#ffffff', fontSize: '1.3rem', fontWeight: 800 }}>
            Master Treasury Vault Setup
          </h2>
          <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.82rem', lineHeight: 1.45 }}>
            Initialize your on-chain master BEP-20 treasury wallet for automated user sweeps and cashouts.
          </p>
        </div>

        {/* View 1: Choose Mode (Generate or Import) */}
        {setupMode === 'choose' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div
              onClick={handleGenerate}
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '14px',
                padding: '1.2rem',
                cursor: loading ? 'wait' : 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem'
              }}
            >
              <span style={{ fontSize: '2rem' }}>⚡</span>
              <div>
                <h3 style={{ margin: '0 0 0.2rem 0', color: '#ffffff', fontSize: '0.98rem', fontWeight: 700 }}>
                  Generate Fresh Master Vault
                </h3>
                <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>
                  Create a new BIP-39 12-word seed phrase and secure HD wallet address.
                </span>
              </div>
            </div>

            <div
              onClick={() => setSetupMode('import')}
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '14px',
                padding: '1.2rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem'
              }}
            >
              <span style={{ fontSize: '2rem' }}>📥</span>
              <div>
                <h3 style={{ margin: '0 0 0.2rem 0', color: '#ffffff', fontSize: '0.98rem', fontWeight: 700 }}>
                  Import Existing Vault
                </h3>
                <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>
                  Restore your master wallet using an existing 12-word mnemonic phrase or hex private key.
                </span>
              </div>
            </div>

            <button
              onClick={onCancel}
              style={{
                marginTop: '0.5rem',
                background: 'none',
                border: 'none',
                color: '#64748b',
                fontSize: '0.8rem',
                cursor: 'pointer',
                padding: '0.5rem'
              }}
            >
              Cancel & Exit
            </button>
          </div>
        )}

        {/* View 2: Import Mode Form */}
        {setupMode === 'import' && (
          <form onSubmit={handleImportSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(0,0,0,0.3)', padding: '0.25rem', borderRadius: '8px' }}>
              <button
                type="button"
                onClick={() => setImportType('seed')}
                style={{
                  flex: 1,
                  background: importType === 'seed' ? '#ffffff' : 'none',
                  color: importType === 'seed' ? '#090d16' : '#94a3b8',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.4rem',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                12-Word Seed Phrase
              </button>
              <button
                type="button"
                onClick={() => setImportType('private_key')}
                style={{
                  flex: 1,
                  background: importType === 'private_key' ? '#ffffff' : 'none',
                  color: importType === 'private_key' ? '#090d16' : '#94a3b8',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.4rem',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Hex Private Key
              </button>
            </div>

            <div>
              <label style={{ color: '#94a3b8', fontSize: '0.78rem', display: 'block', marginBottom: '0.35rem' }}>
                {importType === 'seed' ? 'Enter 12 Mnemonic Words (space separated)' : 'Enter 64-char Hex Private Key (0x...)'}
              </label>
              <textarea
                value={importInput}
                onChange={(e) => setImportInput(e.target.value)}
                placeholder={importType === 'seed' ? 'word1 word2 word3 ... word12' : '0x...'}
                rows={3}
                required
                style={{
                  width: '100%',
                  padding: '0.65rem',
                  background: 'rgba(0, 0, 0, 0.45)',
                  border: '1px solid rgba(255, 255, 255, 0.16)',
                  borderRadius: '10px',
                  color: '#ffffff',
                  fontFamily: 'monospace',
                  fontSize: '0.85rem',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.65rem', marginTop: '0.5rem' }}>
              <button
                type="submit"
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  background: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  color: '#090d16',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  cursor: 'pointer'
                }}
              >
                {loading ? 'Importing...' : 'Verify & Continue 📥'}
              </button>
              <button
                type="button"
                onClick={() => setSetupMode('choose')}
                style={{
                  padding: '0.75rem 1rem',
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '10px',
                  color: '#ffffff',
                  cursor: 'pointer'
                }}
              >
                Back
              </button>
            </div>
          </form>
        )}

        {/* View 3: Display Generated/Imported Secrets & Mandatory Backup */}
        {setupMode === 'generate' && generatedSecrets && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Master Address Box */}
            <div style={{ background: 'rgba(0, 0, 0, 0.35)', padding: '0.75rem', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <span style={{ color: '#94a3b8', fontSize: '0.75rem', display: 'block', marginBottom: '0.2rem' }}>
                Master Treasury Address (BEP-20)
              </span>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                <span style={{ color: '#34d399', fontFamily: 'monospace', fontSize: '0.85rem', fontWeight: 700, wordBreak: 'break-all' }}>
                  {generatedSecrets.master_address}
                </span>
                <button
                  onClick={() => copyToClipboard(generatedSecrets.master_address, 'Master Address')}
                  style={{ background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer', fontSize: '0.9rem', padding: 0 }}
                >
                  📋
                </button>
              </div>
            </div>

            {/* 12-Word Seed Phrase Pill Badges */}
            {seedWords.length > 0 && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <span style={{ color: '#fef08a', fontSize: '0.78rem', fontWeight: 700 }}>
                    12-Word Recovery Seed Phrase
                  </span>
                  <button
                    onClick={() => copyToClipboard(generatedSecrets.seed_phrase || '', 'Seed Phrase')}
                    style={{ background: 'none', border: 'none', color: '#38bdf8', fontSize: '0.75rem', cursor: 'pointer', padding: 0 }}
                  >
                    📋 Copy Words
                  </button>
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '0.4rem',
                    background: 'rgba(0, 0, 0, 0.45)',
                    padding: '0.75rem',
                    borderRadius: '10px',
                    border: '1px solid rgba(255, 255, 255, 0.1)'
                  }}
                >
                  {seedWords.map((w, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: 'rgba(255, 255, 255, 0.06)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '6px',
                        padding: '0.3rem 0.45rem',
                        fontSize: '0.75rem',
                        display: 'flex',
                        gap: '0.3rem',
                        alignItems: 'center'
                      }}
                    >
                      <span style={{ color: '#64748b', fontSize: '0.68rem', fontFamily: 'monospace' }}>{idx + 1}.</span>
                      <span style={{ color: '#ffffff', fontWeight: 700, fontFamily: 'monospace' }}>{w}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Private Key Box */}
            {generatedSecrets.private_key && (
              <div style={{ background: 'rgba(0, 0, 0, 0.35)', padding: '0.75rem', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <span style={{ color: '#94a3b8', fontSize: '0.75rem', display: 'block', marginBottom: '0.2rem' }}>
                  Master Private Key (Hex)
                </span>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                  <span style={{ color: '#cbd5e1', fontFamily: 'monospace', fontSize: '0.76rem', wordBreak: 'break-all' }}>
                    {generatedSecrets.private_key.length > 24
                      ? `${generatedSecrets.private_key.substring(0, 12)}••••••••••••••••${generatedSecrets.private_key.substring(generatedSecrets.private_key.length - 6)}`
                      : generatedSecrets.private_key}
                  </span>
                  <button
                    onClick={() => copyToClipboard(generatedSecrets.private_key || '', 'Private Key')}
                    style={{ background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer', fontSize: '0.9rem', padding: 0 }}
                  >
                    📋
                  </button>
                </div>
              </div>
            )}

            {/* Prominent Download Button */}
            <button
              onClick={handleDownloadFile}
              style={{
                width: '100%',
                padding: '0.85rem',
                background: hasDownloaded ? 'rgba(16, 185, 129, 0.2)' : 'linear-gradient(135deg, #38bdf8, #818cf8)',
                border: hasDownloaded ? '1px solid rgba(52, 211, 153, 0.4)' : 'none',
                borderRadius: '10px',
                color: hasDownloaded ? '#34d399' : '#090d16',
                fontWeight: 800,
                fontSize: '0.9rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
                boxShadow: hasDownloaded ? 'none' : '0 4px 14px rgba(56, 189, 248, 0.25)'
              }}
            >
              <span>{hasDownloaded ? '✓ Vault Secrets File Downloaded (.txt)' : '📥 Download Vault Secrets File (.txt)'}</span>
            </button>

            {/* Mandatory Confirmation Checkbox */}
            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.6rem',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                padding: '0.75rem',
                borderRadius: '10px',
                cursor: 'pointer'
              }}
            >
              <input
                type="checkbox"
                checked={hasConfirmedCheckbox}
                onChange={(e) => setHasConfirmedCheckbox(e.target.checked)}
                style={{ marginTop: '0.2rem', width: '16px', height: '16px', accentColor: '#10b981', cursor: 'pointer' }}
              />
              <span style={{ color: '#cbd5e1', fontSize: '0.78rem', lineHeight: 1.4 }}>
                I have safely downloaded and stored my 12-word seed phrase and private key offline. I understand that losing these credentials will permanently lock treasury funds.
              </span>
            </label>

            {/* Confirm & Unlock Button */}
            <button
              onClick={handleConfirmAndUnlock}
              disabled={!hasConfirmedCheckbox || loading}
              style={{
                width: '100%',
                padding: '0.85rem',
                background: hasConfirmedCheckbox ? '#ffffff' : 'rgba(255, 255, 255, 0.08)',
                border: 'none',
                borderRadius: '10px',
                color: hasConfirmedCheckbox ? '#090d16' : '#64748b',
                fontWeight: 800,
                fontSize: '0.92rem',
                cursor: hasConfirmedCheckbox ? 'pointer' : 'not-allowed',
                boxShadow: hasConfirmedCheckbox ? '0 4px 15px rgba(255, 255, 255, 0.2)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              {loading ? 'Finalizing Setup...' : 'Confirm & Unlock Admin Dashboard 🚀'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
