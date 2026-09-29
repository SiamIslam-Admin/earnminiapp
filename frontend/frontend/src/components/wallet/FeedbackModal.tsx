import { useState, useRef } from 'react';
import type { FC, ChangeEvent, DragEvent } from 'react';
import { submitFeedback } from '../../services/dataService';
import { notifyToast } from '../../utils/debugToast';
import { haptics } from '../../utils/haptics';

export interface FeedbackModalProps {
  onClose: () => void;
}

type IssueCategory = 'general' | 'withdrawal';

export const FeedbackModal: FC<FeedbackModalProps> = ({ onClose }) => {
  const [email, setEmail] = useState('');
  const [category, setCategory] = useState<IssueCategory>('general');
  const [description, setDescription] = useState('');
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (file && file.type.startsWith('image/')) {
      setScreenshot(file);
      setPreviewUrl(URL.createObjectURL(file));
      setErrorMsg(null);
    } else {
      setErrorMsg('Please upload an image file (PNG, JPG, WEBP)');
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const removeScreenshot = () => {
    setScreenshot(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
  };

  const handleSubmit = async () => {
    if (!email.trim() || !email.includes('@')) {
      setErrorMsg('Please enter a valid email address');
      return;
    }
    if (!description.trim()) {
      setErrorMsg('Please provide a brief description of the issue');
      return;
    }

    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('email', email.trim());
      formData.append('category', category);
      formData.append('description', description.trim());
      if (screenshot) {
        formData.append('screenshot', screenshot);
      }

      const res = await submitFeedback(formData);
      if (res.success) {
        haptics.notification('success');
        setIsSubmitted(true);
        notifyToast('✓ Support ticket submitted! Our team will review and reply via Telegram bot.', 'success', 3500);
        setTimeout(() => {
          onClose();
        }, 2200);
      } else {
        setErrorMsg(res.message || 'Failed to submit feedback. Please try again.');
        notifyToast(res.message || 'Submission failed', 'error', 3000);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to submit feedback');
      notifyToast(err?.message || 'Error', 'error', 3000);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(2, 44, 34, 0.85)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        boxSizing: 'border-box'
      }}
    >
      {/* Dark overlay backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 0
        }}
      />

      {/* Professional White Card Container */}
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          maxHeight: '90vh',
          background: '#ffffff',
          borderRadius: '1.25rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.45)',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          zIndex: 1,
          overflowY: 'auto',
          padding: '1.5rem',
          boxSizing: 'border-box',
          fontFamily: 'Outfit, sans-serif',
          color: '#1e293b'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, color: '#0f172a' }}>
              Feedback & Support
            </h2>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>
              We're here to help resolve your issue promptly.
            </p>
          </div>

          <button
            onClick={onClose}
            style={{
              background: '#f1f5f9',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#475569',
              fontSize: '1rem',
              cursor: 'pointer',
              flexShrink: 0
            }}
          >
            ✕
          </button>
        </div>

        {isSubmitted ? (
          <div
            style={{
              padding: '2.5rem 1rem',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.75rem'
            }}
          >
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: '#dcfce7',
                color: '#16a34a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.75rem',
                fontWeight: 900
              }}
            >
              ✓
            </div>
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
              Feedback Submitted!
            </h3>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748b', lineHeight: 1.4 }}>
              Thank you! Our support team will review your report and get back to you via email.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
            {/* Field 1: Email Address */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>
                Your Email Address <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setErrorMsg(null);
                }}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '0.65rem',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.9rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                  background: '#f8fafc',
                  color: '#0f172a'
                }}
              />
            </div>

            {/* Field 2: Category Selector */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>
                Select Issue Type <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setCategory('general')}
                  style={{
                    padding: '0.65rem 0.5rem',
                    borderRadius: '0.65rem',
                    border: category === 'general' ? '2px solid #059669' : '1px solid #e2e8f0',
                    background: category === 'general' ? '#ecfdf5' : '#f8fafc',
                    color: category === 'general' ? '#065f46' : '#64748b',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    textAlign: 'center'
                  }}
                >
                  💬 General Feedback
                </button>

                <button
                  type="button"
                  onClick={() => setCategory('withdrawal')}
                  style={{
                    padding: '0.65rem 0.5rem',
                    borderRadius: '0.65rem',
                    border: category === 'withdrawal' ? '2px solid #059669' : '1px solid #e2e8f0',
                    background: category === 'withdrawal' ? '#ecfdf5' : '#f8fafc',
                    color: category === 'withdrawal' ? '#065f46' : '#64748b',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    textAlign: 'center'
                  }}
                >
                  💳 Withdrawal Issue
                </button>
              </div>
            </div>

            {/* Field 3: Description */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>
                Description <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <textarea
                rows={3}
                placeholder="Please describe your issue or suggestion in detail..."
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  setErrorMsg(null);
                }}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '0.65rem',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.9rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                  background: '#f8fafc',
                  color: '#0f172a',
                  resize: 'none',
                  fontFamily: 'inherit'
                }}
              />
            </div>

            {/* Field 4: Screenshot Upload */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>
                Upload Screenshot (Optional)
              </label>

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                style={{ display: 'none' }}
              />

              {previewUrl ? (
                <div
                  style={{
                    position: 'relative',
                    borderRadius: '0.75rem',
                    overflow: 'hidden',
                    border: '1px solid #cbd5e1',
                    background: '#f1f5f9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.5rem 0.75rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <img
                      src={previewUrl}
                      alt="Preview"
                      style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '6px' }}
                    />
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {screenshot?.name}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={removeScreenshot}
                    style={{
                      background: '#fee2e2',
                      border: 'none',
                      color: '#ef4444',
                      borderRadius: '50%',
                      width: '26px',
                      height: '26px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.8rem',
                      cursor: 'pointer'
                    }}
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: '2px dashed #cbd5e1',
                    borderRadius: '0.75rem',
                    background: '#f8fafc',
                    padding: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.25rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span style={{ fontSize: '1.4rem' }}>📁</span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#059669' }}>
                    Click or drag screenshot here
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                    Supports PNG, JPG, WEBP
                  </span>
                </div>
              )}
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div
                style={{
                  color: '#ef4444',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  textAlign: 'center',
                  background: '#fef2f2',
                  padding: '0.4rem',
                  borderRadius: '0.5rem'
                }}
              >
                {errorMsg}
              </div>
            )}

            {/* Submit Button */}
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              style={{
                width: '100%',
                background: isSubmitting ? 'rgba(5, 150, 105, 0.6)' : 'linear-gradient(180deg, #059669 0%, #047857 100%)',
                border: 'none',
                borderRadius: '0.75rem',
                padding: '0.75rem',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: '0.98rem',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 12px rgba(5, 150, 105, 0.3)',
                transition: 'transform 0.1s ease',
                marginTop: '0.25rem'
              }}
              onMouseDown={(e) => !isSubmitting && (e.currentTarget.style.transform = 'scale(0.98)')}
              onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            >
              {isSubmitting ? 'Submitting Report...' : 'Submit Feedback 🚀'}
            </button>

            {/* Developer Credit Footer Link */}
            <div style={{ textAlign: 'center', marginTop: '0.1rem' }}>
              <span
                style={{
                  fontSize: '0.8rem',
                  color: '#3214b8ff',
                  cursor: 'pointer',
                  textDecoration: 'underline'
                }}
                onClick={() => {
                  // @ts-ignore
                  window.Telegram?.WebApp?.openTelegramLink?.('https://t.me/gojo16s') ||
                    window.open('https://t.me/gojo16s', '_blank');
                }}
              >
                Built By Developer
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
