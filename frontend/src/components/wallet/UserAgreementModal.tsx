import type { FC } from 'react';

export interface UserAgreementModalProps {
  onClose: () => void;
}

export const UserAgreementModal: FC<UserAgreementModalProps> = ({ onClose }) => {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100vh',
        background: 'rgba(2, 44, 34, 0.96)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'Georgia, serif',
        color: '#ffffff'
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '1.25rem 1rem',
          position: 'relative',
          flexShrink: 0,
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
        }}
      >
        <h2
          style={{
            fontSize: '1.35rem',
            fontWeight: 800,
            margin: 0,
            color: '#ffffff',
            textShadow: '0 2px 4px rgba(0,0,0,0.5)'
          }}
        >
          User Agreement
        </h2>
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            right: '1rem',
            background: 'transparent',
            border: 'none',
            color: 'white',
            fontSize: '1.4rem',
            cursor: 'pointer',
            padding: '0.4rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 0.85
          }}
        >
          ✕
        </button>
      </div>

      {/* Content Scrollable Area */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '1.25rem 1.25rem 3rem 1.25rem',
          lineHeight: 1.65,
          fontSize: '0.9rem',
          color: 'rgba(255, 255, 255, 0.88)'
        }}
      >
        {/* Intro */}
        <div style={{ marginBottom: '1.5rem' }}>
          <p style={{ fontWeight: 700, fontSize: '1.05rem', color: '#fbbf24', margin: '0 0 0.5rem 0' }}>
            Welcome to Spin Craft.
          </p>
          <p style={{ margin: 0 }}>
            Before registering, logging in, browsing, or using Spin Craft services, please read and fully understand this Agreement. By clicking "Agree", "Register", "Start Using", or by actually using Spin Craft services, you acknowledge that you have read, understood, and agreed to all terms of this Agreement.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* 1. Service Description */}
          <section>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ffffff', margin: '0 0 0.4rem 0' }}>
              1. Service Description
            </h3>
            <p style={{ margin: '0 0 0.5rem 0' }}>
              Spin Craft is a task-incentive platform where users may earn points, coins, reward credits, or other benefits by completing tasks, activities, invitations, check-ins, browsing, interactions, or other compliant actions displayed on the platform.
            </p>
            <p style={{ margin: 0 }}>
              Platform rewards do not constitute wages, labor compensation, investment returns, financial returns, or any form of fixed return. Spin Craft does not guarantee that users will earn rewards, nor does it guarantee reward amounts, payout timing, or withdrawal success rates.
            </p>
          </section>

          {/* 2. User Eligibility */}
          <section>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ffffff', margin: '0 0 0.4rem 0' }}>
              2. User Eligibility
            </h3>
            <p style={{ margin: '0 0 0.5rem 0' }}>
              You must have full legal capacity. If you are a minor, you should use Spin Craft with the consent and guidance of a guardian.
            </p>
            <p style={{ margin: 0 }}>
              You may not register or use Spin Craft with another person's identity information, false information, temporary numbers, bulk accounts, or illegally obtained accounts.
            </p>
          </section>

          {/* 3. Account Usage Rules */}
          <section>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ffffff', margin: '0 0 0.4rem 0' }}>
              3. Account Usage Rules
            </h3>
            <p style={{ margin: '0 0 0.5rem 0' }}>
              You are responsible for safeguarding your account, password, verification codes, wallet addresses, payment accounts, and related information. Losses caused by your failure to keep such information secure are borne by you.
            </p>
            <p style={{ margin: '0 0 0.5rem 0' }}>
              The same user may not obtain rewards through multiple accounts, device spoofing, emulators, scripts, group control, fake invitations, traffic inflation, credential stuffing, cheating tools, or similar methods.
            </p>
            <p style={{ margin: 0 }}>
              Spin Craft may review account behavior for security, risk control, anti-fraud, compliance, or operational needs, and may restrict tasks, freeze rewards, delay withdrawals, cancel rewards, restrict login, or ban accounts based on review results.
            </p>
          </section>

          {/* 4. Tasks and Reward Rules */}
          <section>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ffffff', margin: '0 0 0.4rem 0' }}>
              4. Tasks and Reward Rules
            </h3>
            <p style={{ margin: '0 0 0.5rem 0' }}>
              Spin Craft displays specific task requirements, reward standards, validity periods, review methods, and distribution conditions for different activities. Actual rewards are subject to activity pages, task pages, or platform announcements.
            </p>
            <p style={{ margin: '0 0 0.5rem 0' }}>
              After users complete tasks, Spin Craft may conduct authenticity, validity, and risk reviews. Only tasks, invitations, interactions, or transactions confirmed as valid by the platform will count toward rewards.
            </p>
            <p style={{ margin: '0 0 0.4rem 0' }}>
              The following behaviors are not considered valid task completion, and Spin Craft may cancel related rewards:
            </p>
            <ul style={{ margin: '0 0 0.5rem 1.25rem', padding: 0 }}>
              <li>Participating with fake identities, fake devices, fake network environments, or abnormal accounts;</li>
              <li>Completing tasks in bulk via scripts, plugins, automation tools, group-control devices, or emulators;</li>
              <li>Obtaining rewards through fake invitations, mutual inflation, paid traffic, arbitrage, or malicious registration;</li>
              <li>Tampering with data, attacking systems, or interfering with normal platform operation;</li>
              <li>Other behaviors that violate activity rules, laws and regulations, or public order and good customs.</li>
            </ul>
          </section>

          {/* 5. Withdrawals and Settlement */}
          <section>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ffffff', margin: '0 0 0.4rem 0' }}>
              5. Withdrawals and Settlement
            </h3>
            <p style={{ margin: '0 0 0.5rem 0' }}>
              After reaching the withdrawal threshold set by Spin Craft, users may apply for withdrawal as prompted on the page. Before withdrawal, Spin Craft may require identity verification, account verification, anti-fraud review, risk review, or tax/compliance information.
            </p>
            <p style={{ margin: '0 0 0.5rem 0' }}>
              Withdrawal arrival time may be affected by platform review, payment channels, banks, or third-party services. Spin Craft is not responsible for delays, failures, or fees caused by third-party payment institutions, banks, or wallet service providers.
            </p>
            <p style={{ margin: '0 0 0.5rem 0' }}>
              If Spin Craft finds abnormal activity, cheating, violations, false information, disputes, complaints, or compliance risks, it may suspend, delay, reject, or cancel withdrawals and require reasonable explanations or supporting materials.
            </p>
            <p style={{ margin: 0 }}>
              Taxes arising from withdrawals, rewards, or other earnings shall be declared and borne by users in accordance with applicable local laws and regulations, unless otherwise required by law.
            </p>
          </section>

          {/* 6. User Conduct */}
          <section>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ffffff', margin: '0 0 0.4rem 0' }}>
              6. User Conduct
            </h3>
            <p style={{ margin: '0 0 0.4rem 0' }}>When using Spin Craft, you must not:</p>
            <ul style={{ margin: '0 0 0.5rem 1.25rem', padding: 0 }}>
              <li>Publish illegal, fraudulent, pornographic, violent, gambling, pyramid scheme, scam, infringing, or other harmful content;</li>
              <li>Impersonate the platform, staff, or other users;</li>
              <li>File malicious complaints, extort, spread false information, or damage platform reputation;</li>
              <li>Attack, crack, reverse engineer, scrape, or interfere with platform systems;</li>
              <li>Illegally transfer, sell, rent, or share accounts, reward eligibility, task eligibility, or withdrawal eligibility;</li>
              <li>Engage in any behavior that violates laws, regulations, regulatory requirements, platform rules, or public interest.</li>
            </ul>
          </section>

          {/* 7. Platform Rule Adjustments */}
          <section>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ffffff', margin: '0 0 0.4rem 0' }}>
              7. Platform Rule Adjustments
            </h3>
            <p style={{ margin: '0 0 0.5rem 0' }}>
              Spin Craft may adjust task rules, reward rules, withdrawal rules, review standards, platform features, or this Agreement based on business development, risk control, laws, regulations, or regulatory requirements.
            </p>
            <p style={{ margin: 0 }}>
              For rule changes involving significant user rights, Spin Craft will notify users through page announcements, in-app notifications, pop-ups, or other reasonable means. Continued use of Spin Craft after changes take effect constitutes acceptance of the updated rules; if you disagree, you may stop using Spin Craft services.
            </p>
          </section>

          {/* 8. Personal Information Protection */}
          <section>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ffffff', margin: '0 0 0.4rem 0' }}>
              8. Personal Information Protection
            </h3>
            <p style={{ margin: '0 0 0.5rem 0' }}>
              Spin Craft collects, uses, stores, and protects your personal information in accordance with applicable laws and regulations and the Privacy Policy. To complete registration, task review, reward distribution, withdrawals, risk control, anti-fraud, and compliance review, Spin Craft may process your account information, device information, network information, task records, invitation relationships, payment information, identity verification information, and more.
            </p>
            <p style={{ margin: 0 }}>
              Spin Craft will process personal information in accordance with the principles of legality, legitimacy, and necessity. Where sensitive personal information, third-party sharing, or cross-border transfer is involved, the platform will provide separate notice or obtain your authorization as required by law.
            </p>
          </section>

          {/* 9. Service Suspension and Termination */}
          <section>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ffffff', margin: '0 0 0.4rem 0' }}>
              9. Service Suspension and Termination
            </h3>
            <p style={{ margin: '0 0 0.4rem 0' }}>
              If you violate this Agreement, platform rules, activity rules, or laws and regulations, Spin Craft may take the following measures within a reasonable scope:
            </p>
            <ul style={{ margin: '0 0 0.5rem 1.25rem', padding: 0 }}>
              <li>Issue warnings or require corrections;</li>
              <li>Restrict certain features;</li>
              <li>Freeze, deduct, or cancel rewards;</li>
              <li>Suspend or reject withdrawals;</li>
              <li>Ban accounts;</li>
              <li>Preserve relevant records and report to authorities as required by law.</li>
            </ul>
            <p style={{ margin: 0 }}>
              If service interruption or anomalies occur due to system maintenance, network failures, third-party service issues, force majeure, regulatory requirements, or security risks, Spin Craft will try to restore service but does not guarantee permanent, continuous, or error-free operation.
            </p>
          </section>

          {/* 10. Disclaimer */}
          <section>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ffffff', margin: '0 0 0.4rem 0' }}>
              10. Disclaimer
            </h3>
            <p style={{ margin: '0 0 0.5rem 0' }}>
              Spin Craft provides task display, reward recording, review, and settlement services only in accordance with platform rules. Users should assess the risks of participating in tasks, invitations, withdrawals, or other actions on their own.
            </p>
            <p style={{ margin: 0 }}>
              Losses caused by user violations, incorrect information, use of third-party tools, abnormal payment accounts, or violation of local laws and regulations shall be borne by users.
            </p>
          </section>

          {/* 11. Dispute Resolution */}
          <section>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ffffff', margin: '0 0 0.4rem 0' }}>
              11. Dispute Resolution
            </h3>
            <p style={{ margin: '0 0 0.5rem 0' }}>
              If you disagree with task records, reward amounts, withdrawal results, account handling, or other matters, you may submit explanations and supporting materials through the appeal or feedback channels provided on Spin Craft pages. Spin Craft will review after receiving reasonable materials.
            </p>
            <p style={{ margin: 0 }}>
              The formation, performance, interpretation, and dispute resolution of this Agreement shall be governed by applicable laws and regulations. Both parties shall attempt to resolve disputes through friendly negotiation; if negotiation fails, disputes shall be submitted to a competent authority in accordance with law.
            </p>
          </section>

          {/* 12. Miscellaneous */}
          <section>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ffffff', margin: '0 0 0.4rem 0' }}>
              12. Miscellaneous
            </h3>
            <p style={{ margin: '0 0 0.5rem 0' }}>
              This Agreement takes effect from the date the user clicks agree or actually uses Spin Craft services.
            </p>
            <p style={{ margin: 0 }}>
              If Spin Craft updates this Agreement or related platform rules, users will be notified through page announcements, pop-up prompts, in-app notifications, or other reasonable means. Continued use of Spin Craft services constitutes acceptance of the updated Agreement; if you do not agree to the updates, you should stop using Spin Craft services.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};
