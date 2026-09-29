// ============================================================================
// ADMIN DIAGNOSTIC & SOLUTION INTERPRETER
// Translates technical errors into plain-English issues, root causes, and actionable solutions
// ============================================================================

export interface AdminDiagnosticReport {
  id: string;
  title: string;
  actionName: string;
  issue: string;
  probableCause: string;
  suggestedSteps: string[];
  rawError: string;
  category: 'telegram' | 'blockchain' | 'database' | 'validation' | 'network' | 'general';
  timestamp: number;
}

type DiagnosticListener = (report: AdminDiagnosticReport | null) => void;
let activeReport: AdminDiagnosticReport | null = null;
const listeners: Set<DiagnosticListener> = new Set();

export const subscribeToDiagnostics = (listener: DiagnosticListener) => {
  listeners.add(listener);
  listener(activeReport);
  return () => {
    listeners.delete(listener);
  };
};

export const closeAdminDiagnostic = () => {
  activeReport = null;
  listeners.forEach((fn) => fn(null));
};

export const parseAdminError = (
  raw: any,
  actionName: string = 'Admin Operation',
  _context?: Record<string, any>
): AdminDiagnosticReport => {
  const errStr = typeof raw === 'string' ? raw : (raw?.error || raw?.message || JSON.stringify(raw) || 'Unknown error');
  const lower = errStr.toLowerCase();
  const id = `diag-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  // 1. Telegram Bot API & Channel Errors
  if (lower.includes('chat not found') || lower.includes('chat_not_found') || (lower.includes('chat') && lower.includes('not found'))) {
    return {
      id,
      title: 'Telegram Channel Not Found',
      actionName,
      issue: 'The Telegram bot could not locate the specified channel or group.',
      probableCause: 'The channel username (@username) or Chat ID (-100...) is typed incorrectly, or the channel is private and inaccessible to the bot.',
      suggestedSteps: [
        'Verify the channel username has no typos and starts with "@" (e.g. @MyChannel).',
        'If the channel is private, use its permanent Chat ID (starts with -100...) instead of a public username.',
        'Ensure the bot has already been invited to the channel before linking.'
      ],
      rawError: errStr,
      category: 'telegram',
      timestamp: Date.now()
    };
  }

  if (
    lower.includes('not a member') ||
    lower.includes('not an administrator') ||
    lower.includes('rights') ||
    lower.includes('administrator rights') ||
    lower.includes('bot is not an admin') ||
    lower.includes('bot is not in the channel')
  ) {
    return {
      id,
      title: 'Bot Administrator Privileges Required',
      actionName,
      issue: 'The Telegram Bot is not an Administrator in this channel.',
      probableCause: 'Telegram requires the bot to be added to the channel as an Administrator with "Invite Users via Link" permissions to verify memberships and generate invite links.',
      suggestedSteps: [
        'Open Telegram on your phone or desktop.',
        'Navigate to your Channel Settings > Administrators > Add Administrator.',
        'Search for your bot by username and select it.',
        'Enable permissions: "Invite Users via Link" and "Manage Channel".',
        'Return here and click "Detect Link" or "Save" again.'
      ],
      rawError: errStr,
      category: 'telegram',
      timestamp: Date.now()
    };
  }

  if (lower.includes('entities') || lower.includes('parse') || lower.includes('markdown') || lower.includes('can\'t parse')) {
    return {
      id,
      title: 'Telegram Formatting Error',
      actionName,
      issue: 'Telegram rejected the message formatting.',
      probableCause: 'The message contains unclosed formatting characters (such as an unclosed asterisk *, underscore _, or bracket [).',
      suggestedSteps: [
        'Check your message text for unmatched asterisks *bold* or underscores _italic_.',
        'If your text includes special characters like _, *, or `, escape them or switch to plain text.',
        'Ensure all button URLs start with valid https:// links.'
      ],
      rawError: errStr,
      category: 'telegram',
      timestamp: Date.now()
    };
  }

  if (lower.includes('blocked') || lower.includes('deactivated') || lower.includes('user is deactivated')) {
    return {
      id,
      title: 'User Blocked Telegram Bot',
      actionName,
      issue: 'The notification could not be delivered to the player.',
      probableCause: 'The player has either stopped/blocked the Telegram bot, or their Telegram account is deactivated.',
      suggestedSteps: [
        'The operation was successfully recorded in the database.',
        'Telegram bot delivery failed because the user blocked the bot.',
        'The player will see their updated balance/ticket status directly in the Mini App when they open it next.'
      ],
      rawError: errStr,
      category: 'telegram',
      timestamp: Date.now()
    };
  }

  if (lower.includes('too many requests') || lower.includes('retry after') || lower.includes('flood')) {
    return {
      id,
      title: 'Telegram API Rate Limit Reached',
      actionName,
      issue: 'Telegram temporarily throttled outgoing messages.',
      probableCause: 'Too many messages were broadcasted or verified in a short window of time.',
      suggestedSteps: [
        'Wait 30–60 seconds before sending another broadcast or verifying channels.',
        'Telegram enforces strict rate limits of ~30 messages/sec for bots.'
      ],
      rawError: errStr,
      category: 'telegram',
      timestamp: Date.now()
    };
  }

  // 2. Blockchain & Master Vault Gas / Balance Errors
  if (
    lower.includes('insufficient funds') ||
    lower.includes('gas * price') ||
    lower.includes('gas fee') ||
    lower.includes('bnb gas')
  ) {
    return {
      id,
      title: 'Insufficient BNB Gas in Master Vault',
      actionName,
      issue: 'The on-chain transaction failed due to insufficient BNB gas.',
      probableCause: 'Every BEP-20 transaction on Binance Smart Chain requires a tiny amount of BNB (~0.0003–0.0008 BNB) to pay blockchain network miners.',
      suggestedSteps: [
        'Check the Master Vault BNB Gas balance on the Overview page.',
        'Deposit at least 0.005–0.01 BNB to your Master Vault address.',
        'Wait ~15 seconds for the BNB deposit to confirm on BSC, then retry the transaction.'
      ],
      rawError: errStr,
      category: 'blockchain',
      timestamp: Date.now()
    };
  }

  if (lower.includes('insufficient usdt') || lower.includes('insufficient reserve') || lower.includes('reserve balance')) {
    return {
      id,
      title: 'Insufficient USDT Liquidity in Master Vault',
      actionName,
      issue: 'The Master Vault does not have enough USDT to complete this payout or transfer.',
      probableCause: 'The requested amount exceeds the current unallocated USDT balance inside the Master Treasury Vault.',
      suggestedSteps: [
        'Go to the Overview page and review the "USDT Liquidity Reserve".',
        'Deposit BEP-20 USDT to the Master Vault address to replenish liquidity.',
        'Once confirmed, retry approving the cashout or executing the transfer.'
      ],
      rawError: errStr,
      category: 'blockchain',
      timestamp: Date.now()
    };
  }

  if (lower.includes('nonce') || lower.includes('underpriced') || lower.includes('already known')) {
    return {
      id,
      title: 'Blockchain Mempool Congestion',
      actionName,
      issue: 'A transaction nonce conflict occurred on Binance Smart Chain.',
      probableCause: 'A previous transaction from the Master Vault is currently pending in the BSC mempool.',
      suggestedSteps: [
        'Wait 15–30 seconds for the BSC network to mine the pending block.',
        'Refresh the Master Vault balance to verify the transaction finalized.',
        'Retry the action if the previous transaction has finished.'
      ],
      rawError: errStr,
      category: 'blockchain',
      timestamp: Date.now()
    };
  }

  if (lower.includes('address') && (lower.includes('invalid') || lower.includes('42') || lower.includes('format'))) {
    return {
      id,
      title: 'Invalid BSC Wallet Address',
      actionName,
      issue: 'The recipient wallet address was rejected.',
      probableCause: 'The address provided is not a valid 42-character Binance Smart Chain (BEP-20) address.',
      suggestedSteps: [
        'Ensure the wallet address begins with "0x".',
        'Verify that the address is exactly 42 alphanumeric characters long.',
        'Do not use exchange contract deposit memos or internal account IDs.'
      ],
      rawError: errStr,
      category: 'validation',
      timestamp: Date.now()
    };
  }

  // 3. Database Constraints & Uniqueness
  if (lower.includes('duplicate key') || lower.includes('unique constraint') || lower.includes('already exists')) {
    return {
      id,
      title: 'Duplicate Item or Name Detected',
      actionName,
      issue: 'An entry with this exact code name or identifier already exists.',
      probableCause: 'Database unique constraint was triggered because another promo code, tournament, or task is using the same unique name.',
      suggestedSteps: [
        'Change the code name or title to something unique (e.g. add a number or year suffix).',
        'Search the existing list to check if this item has already been created.'
      ],
      rawError: errStr,
      category: 'database',
      timestamp: Date.now()
    };
  }

  if (lower.includes('contest') && (lower.includes('active') || lower.includes('ended') || lower.includes('prizes'))) {
    return {
      id,
      title: 'Tournament Prize Distribution Blocked',
      actionName,
      issue: 'Contest prizes cannot be distributed at this time.',
      probableCause: 'Prizes can only be distributed once a tournament has passed its end date, or prizes have already been distributed previously.',
      suggestedSteps: [
        'Check the tournament end date to verify the contest period is officially over.',
        'Ensure the contest status is not already marked as "ended" with prizes paid.'
      ],
      rawError: errStr,
      category: 'validation',
      timestamp: Date.now()
    };
  }

  if (lower.includes('ticket') && (lower.includes('no ticket') || lower.includes('0') || lower.includes('empty'))) {
    return {
      id,
      title: 'No Eligible Participants',
      actionName,
      issue: 'Cannot draw a winner or finalize the raffle.',
      probableCause: 'No tickets were purchased by players for this raffle, so a winner cannot be randomly selected.',
      suggestedSteps: [
        'Wait for players to buy raffle tickets before drawing.',
        'If you wish to terminate the raffle without a winner, choose "Cancel / End Raffle" instead.'
      ],
      rawError: errStr,
      category: 'validation',
      timestamp: Date.now()
    };
  }

  // 4. Session & Network Errors
  if (lower.includes('unauthorized') || lower.includes('401') || lower.includes('jwt') || lower.includes('token')) {
    return {
      id,
      title: 'Admin Session Expired',
      actionName,
      issue: 'Your administrative security session has timed out.',
      probableCause: 'Admin authentication tokens automatically expire after inactivity for security.',
      suggestedSteps: [
        'Click the Logout button or lock icon in the top right.',
        'Re-enter your Admin Secret Key to re-authenticate.',
        'Retry the action with your refreshed token.'
      ],
      rawError: errStr,
      category: 'network',
      timestamp: Date.now()
    };
  }

  if (lower.includes('network') || lower.includes('cors') || lower.includes('failed to fetch') || lower.includes('timeout')) {
    return {
      id,
      title: 'Network Communication Error',
      actionName,
      issue: 'The Admin Panel was unable to communicate with the backend server.',
      probableCause: 'A network timeout, VPN/firewall blockage, or backend server container restart occurred.',
      suggestedSteps: [
        'Check your internet connection.',
        'Ensure the VPS backend server at craftspin.duckdns.org is online.',
        'Wait 5–10 seconds and retry.'
      ],
      rawError: errStr,
      category: 'network',
      timestamp: Date.now()
    };
  }

  // 5. Fallback General Diagnostic
  return {
    id,
    title: `${actionName} Failed`,
    actionName,
    issue: `The requested action could not be completed.`,
    probableCause: errStr.length < 120 ? errStr : 'The server rejected the request due to a validation or state conflict.',
    suggestedSteps: [
      'Check that all required fields are filled out with valid values.',
      'Refresh the page to ensure you are viewing the latest server state.',
      'If the issue persists, inspect the technical error details below.'
    ],
    rawError: errStr,
    category: 'general',
    timestamp: Date.now()
  };
};

export const showAdminDiagnostic = (
  errorOrReport: any,
  actionName: string = 'Admin Action',
  context?: Record<string, any>
) => {
  let report: AdminDiagnosticReport;
  if (errorOrReport && typeof errorOrReport === 'object' && errorOrReport.issue && errorOrReport.suggestedSteps) {
    report = errorOrReport as AdminDiagnosticReport;
  } else {
    report = parseAdminError(errorOrReport, actionName, context);
  }

  activeReport = report;
  listeners.forEach((fn) => fn(report));
};
