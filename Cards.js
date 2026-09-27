export function createFeatureCard(options) {
  const {
    title,
    icon,
    variant = 'emerald', // emerald, colorful, gold
    badgeText = ''
  } = options;

  const card = document.createElement('div');
  card.className = `card card-${variant}`;
  card.style.display = 'flex';
  card.style.flexDirection = 'column';
  card.style.alignItems = 'center';
  card.style.justifyContent = 'center';
  card.style.padding = '1rem 0 0 0'; // Removed left, right, and bottom padding
  card.style.position = 'relative';
  card.style.cursor = 'pointer';
  card.style.textAlign = 'center';
  card.style.aspectRatio = '3 / 4';
  card.style.borderRadius = 'var(--border-radius-md)';
  card.style.overflow = 'hidden'; // Ensures the bottom corners clip to the card's radius

  let badgeHTML = '';
  if (badgeText) {
    const badgeColor = variant === 'gold' ? 'gold' : 'emerald';
    badgeHTML = `<span class="badge badge-${badgeColor}" style="position: absolute; top: 0.4rem; right: 0.4rem; font-size: 0.65rem; padding: 0.15rem 0.4rem; box-shadow: var(--shadow-sm); z-index: 2;">${badgeText}</span>`;
  }

  card.innerHTML = `
    ${badgeHTML}
    <div style="flex: 1; display: flex; align-items: center; justify-content: center; width: 100%;">
      <div style="font-size: 3rem; line-height: 1; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2)); margin-bottom: 0.5rem;">${icon}</div>
    </div>
    <div class="card-title" style="width: 100%; background: var(--feature-card-btn-bg); color: white; margin: 0; padding: 0.6rem 0; font-size: 0.85rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; border-radius: var(--border-radius-sm); border: 2px solid var(--feature-card-btn-border); box-shadow: var(--shadow-sm);">${title}</div>
  `;

  // Add click animation
  card.addEventListener('mousedown', () => card.style.transform = 'scale(0.95)');
  card.addEventListener('mouseup', () => card.style.transform = 'scale(1)');
  card.addEventListener('mouseleave', () => card.style.transform = 'scale(1)');

  return card;
}

export function createTaskCard(options) {
  const {
    title,
    reward,
    icon,
    completed = false,
    status = completed ? 'completed' : 'pending' // 'pending', 'checking', 'completed'
  } = options;

  const card = document.createElement('div');
  card.className = 'card';
  card.style.display = 'flex';
  card.style.alignItems = 'center';
  card.style.justifyContent = 'space-between';
  card.style.padding = '0.75rem 1rem'; // Reduced vertical padding from 1rem to 0.75rem to make it slightly shorter
  card.style.gap = '1rem';
  card.style.background = 'linear-gradient(145deg, var(--task-card-bg-start) 0%, var(--task-card-bg-end) 100%)';
  card.style.borderRadius = 'var(--border-radius-md)';
  card.style.border = '1px solid var(--task-card-border)';
  card.style.boxShadow = 'inset 0 1px 1px rgba(255, 255, 255, 0.2), 0 4px 10px rgba(0, 0, 0, 0.3)';
  card.style.color = 'white';

  const isCompleted = status === 'completed';
  const opacity = isCompleted ? '0.5' : '1';

  let buttonHTML = '';
  if (status === 'checking') {
    buttonHTML = `
      <div style="display: flex; flex-direction: column; gap: 0.35rem; min-width: 80px;">
        <button class="btn" style="padding: 0.35rem 0; border-radius: var(--border-radius-sm); background: var(--task-card-btn-bg); color: var(--task-card-btn-text); box-shadow: none; border: none; font-size: 0.8rem; font-weight: bold; width: 100%;">Go</button>
        <button class="btn" style="padding: 0.35rem 0; border-radius: var(--border-radius-sm); background: var(--task-card-check-btn-bg); color: var(--task-card-check-btn-text); box-shadow: none; border: none; font-size: 0.8rem; font-weight: bold; width: 100%;">Check</button>
      </div>
    `;
  } else {
    buttonHTML = `
      <button class="btn ${isCompleted ? 'btn-secondary' : ''}" ${isCompleted ? 'disabled' : ''} style="padding: 0.5rem 2.5rem; border-radius: var(--border-radius-sm); ${isCompleted ? '' : 'background: var(--task-card-btn-bg); color: var(--task-card-btn-text); box-shadow: none; border: none;'}">
        ${isCompleted ? 'Done' : 'Go'}
      </button>
    `;
  }

  card.innerHTML = `
    <div style="display: flex; align-items: center; gap: 1rem; opacity: ${opacity};">
      <div style="font-size: 2rem;">${icon}</div>
      <div>
        <div style="font-weight: 600; font-family: var(--font-family-display);">${title}</div>
        <div class="text-gold" style="font-size: 0.875rem; font-weight: bold;">+${reward} COINS</div>
      </div>
    </div>
    ${buttonHTML}
  `;

  return card;
}

export function createTaskBanner(options) {
  const {
    title = 'Active Tasks',
    subtitle = 'Earn more coins now!',
    icon = '🎯',
    rewardAmount,
    rewardIcon = '💎'
  } = options;

  const card = document.createElement('div');
  card.className = 'card task-banner';
  card.style.display = 'flex';
  card.style.alignItems = 'center';
  card.style.justifyContent = 'space-between';
  card.style.padding = '0.5rem 1rem'; // Very thin padding for a banner feel
  card.style.background = 'linear-gradient(145deg, var(--task-card-bg-start) 0%, var(--task-card-bg-end) 100%)';
  card.style.borderRadius = 'var(--border-radius-md)';
  card.style.border = '1px solid var(--task-card-border)';
  card.style.boxShadow = 'inset 0 1px 1px rgba(255, 255, 255, 0.2), 0 4px 6px rgba(0, 0, 0, 0.2)';
  card.style.color = 'white';
  card.style.cursor = 'pointer';

  const btnContent = rewardAmount ? `${rewardIcon} ${rewardAmount}` : 'Go';

  card.innerHTML = `
    <div style="display: flex; align-items: center; gap: 0.75rem;">
      <div style="font-size: 1.5rem; filter: drop-shadow(0 2px 2px rgba(0,0,0,0.3));">${icon}</div>
      <div style="display: flex; flex-direction: column; justify-content: center;">
        <div style="font-weight: 700; font-family: var(--font-family-display); font-size: 0.95rem; line-height: 1.1;">${title}</div>
        <div style="font-size: 0.75rem; color: rgba(255,255,255,0.85); margin-top: 0.1rem;">${subtitle}</div>
      </div>
    </div>
    <button class="btn" style="
      padding: 0.35rem 1rem; 
      border-radius: var(--border-radius-sm); 
      background: var(--task-banner-btn-bg); 
      color: var(--task-banner-btn-text); 
      border: 1px solid var(--task-banner-btn-border); 
      box-shadow: 0 4px 0 rgba(0, 0, 0, 0.25), 0 5px 5px rgba(0,0,0,0.15); 
      font-size: 0.85rem; 
      font-weight: 900; 
      white-space: nowrap;
      margin: 0;
      transition: transform 0.1s, box-shadow 0.1s;
    "
    onmousedown="this.style.transform='translateY(4px) scale(0.98)'; this.style.boxShadow='0 0px 0 rgba(0, 0, 0, 0.25), 0 1px 2px rgba(0,0,0,0.15)';"
    onmouseup="this.style.transform='translateY(0) scale(1)'; this.style.boxShadow='0 4px 0 rgba(0, 0, 0, 0.25), 0 5px 5px rgba(0,0,0,0.15)';"
    onmouseleave="this.style.transform='translateY(0) scale(1)'; this.style.boxShadow='0 4px 0 rgba(0, 0, 0, 0.25), 0 5px 5px rgba(0,0,0,0.15)';"
    >
      ${btnContent}
    </button>
  `;

  // Add subtle click animation
  card.addEventListener('mousedown', () => card.style.transform = 'scale(0.98)');
  card.addEventListener('mouseup', () => card.style.transform = 'scale(1)');
  card.addEventListener('mouseleave', () => card.style.transform = 'scale(1)');

  return card;
}

export function createRewardCard(options) {
  const { rewardText = '1000 Coins', onCollect } = options || {};

  const card = document.createElement('div');
  card.className = 'reward-card';
  card.style.position = 'relative';
  card.style.background = 'linear-gradient(160deg, rgba(6, 78, 59, 0.4) 0%, rgba(2, 44, 34, 0.7) 100%)';
  card.style.borderRadius = '24px';
  card.style.padding = '2.5rem 2rem';
  card.style.width = '100%';
  card.style.maxWidth = '360px';
  card.style.border = '1px solid rgba(52, 211, 153, 0.3)';
  card.style.boxShadow = 'inset 0 1px 1px rgba(255, 255, 255, 0.1), 0 20px 40px rgba(0, 0, 0, 0.5)';
  card.style.color = 'white';
  card.style.textAlign = 'center';
  card.style.margin = '0 auto';
  card.style.overflow = 'hidden';

  card.innerHTML = `
    <!-- Glowing orb behind icon -->
    <div style="position: absolute; top: 0; left: 50%; transform: translateX(-50%); width: 200px; height: 200px; background: radial-gradient(circle, rgba(52, 211, 153, 0.25) 0%, rgba(0,0,0,0) 70%); border-radius: 50%; pointer-events: none;"></div>
    
    <div style="position: relative; z-index: 1;">
      <div style="font-size: 4.5rem; margin-bottom: 0.5rem; filter: drop-shadow(0 8px 12px rgba(0,0,0,0.4)); transform: scale(1.1);">🎉</div>
      <div style="text-transform: uppercase; letter-spacing: 0.1em; font-size: 0.8rem; font-weight: 700; color: var(--emerald-400); margin-bottom: 0.5rem;">Congratulations</div>
      <h2 style="margin-bottom: 1.5rem; font-family: var(--font-family-display); font-size: 2.2rem; font-weight: 800; background: linear-gradient(to right, #fbbf24, #f59e0b); -webkit-background-clip: text; color: transparent; line-height: 1.1;">
        ${rewardText}
      </h2>
      <button class="btn" style="
        width: 100%;
        padding: 0.8rem 1.5rem;
        border-radius: 12px;
        background: linear-gradient(to bottom, #fbbf24, #f59e0b);
        color: #451a03;
        border: none;
        box-shadow: 0 4px 0 #b45309, 0 8px 15px rgba(245, 158, 11, 0.3);
        font-size: 1.05rem;
        font-weight: 900;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        transition: transform 0.1s, box-shadow 0.1s;
      "
      onmousedown="this.style.transform='translateY(4px) scale(0.98)'; this.style.boxShadow='0 0px 0 #b45309, 0 2px 5px rgba(245, 158, 11, 0.3)';"
      onmouseup="this.style.transform='translateY(0) scale(1)'; this.style.boxShadow='0 4px 0 #b45309, 0 8px 15px rgba(245, 158, 11, 0.3)';"
      onmouseleave="this.style.transform='translateY(0) scale(1)'; this.style.boxShadow='0 4px 0 #b45309, 0 8px 15px rgba(245, 158, 11, 0.3)';"
      >Collect Reward</button>
    </div>
  `;

  if (onCollect) {
    const btn = card.querySelector('button');
    btn.addEventListener('click', onCollect);
  }

  return card;
}
