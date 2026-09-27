export class SpinWheel {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    if (!this.container) throw new Error(`Container #${containerId} not found`);

    this.options = Object.assign({
      segments: [],
      size: 300,
      theme: 'emerald', // emerald, colorful, gold
      onSpinEnd: null,
      spinDuration: 4000
    }, options);

    this.canvas = document.createElement('canvas');
    this.canvas.width = this.options.size;
    this.canvas.height = this.options.size;
    this.ctx = this.canvas.getContext('2d');
    
    this.currentRotation = 0;
    this.isSpinning = false;
    
    this.initUI();
    this.draw();
  }

  initUI() {
    this.container.innerHTML = '';
    this.container.style.position = 'relative';
    this.container.style.width = `${this.options.size}px`;
    this.container.style.height = `${this.options.size}px`;
    this.container.style.margin = '0 auto';
    
    // Wrapper for animation
    this.wheelWrapper = document.createElement('div');
    this.wheelWrapper.style.width = '100%';
    this.wheelWrapper.style.height = '100%';
    this.wheelWrapper.style.transition = `transform ${this.options.spinDuration}ms cubic-bezier(0.175, 0.885, 0.32, 1.05)`;
    this.wheelWrapper.appendChild(this.canvas);
    this.container.appendChild(this.wheelWrapper);

    // Pointer (SVG)
    const pointer = document.createElement('div');
    pointer.style.position = 'absolute';
    pointer.style.top = '-10px';
    pointer.style.left = '50%';
    pointer.style.transform = 'translateX(-50%)';
    pointer.style.zIndex = '10';
    pointer.innerHTML = `
      <svg width="32" height="32" viewBox="0 0 24 24" fill="var(--accent-gold)" stroke="#fff" stroke-width="2">
        <path d="M12 2L2 22h20L12 2z" transform="rotate(180 12 12)"/>
      </svg>
    `;
    this.container.appendChild(pointer);

    // Center Button
    this.centerBtn = document.createElement('button');
    this.centerBtn.className = `btn btn-primary`;
    this.centerBtn.style.position = 'absolute';
    this.centerBtn.style.top = '50%';
    this.centerBtn.style.left = '50%';
    this.centerBtn.style.transform = 'translate(-50%, -50%)';
    this.centerBtn.style.width = '70px';
    this.centerBtn.style.height = '70px';
    this.centerBtn.style.borderRadius = '50%';
    this.centerBtn.style.zIndex = '5';
    this.centerBtn.style.fontWeight = 'bold';
    this.centerBtn.style.border = '4px solid #fff';
    this.centerBtn.style.boxShadow = 'var(--shadow-glow-emerald)';
    this.centerBtn.innerText = 'SPIN';
    
    this.centerBtn.addEventListener('click', () => this.spin());
    this.container.appendChild(this.centerBtn);
  }

  getThemeColors() {
    if (this.options.theme === 'colorful') {
      return ['#8b5cf6', '#ec4899', '#f97316', '#fbbf24', '#10b981', '#06b6d4'];
    } else if (this.options.theme === 'gold') {
      return ['#fbbf24', '#f59e0b', '#d97706', '#b45309'];
    }
    // emerald default
    return ['#059669', '#10b981', '#34d399', '#6ee7b7'];
  }

  draw() {
    const numSegments = this.options.segments.length;
    if (numSegments === 0) return;

    const arc = (2 * Math.PI) / numSegments;
    const colors = this.getThemeColors();
    const radius = this.options.size / 2;
    const cx = radius;
    const cy = radius;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.font = 'bold 16px Outfit, sans-serif';

    for (let i = 0; i < numSegments; i++) {
      const angle = i * arc;
      const color = colors[i % colors.length];

      this.ctx.beginPath();
      this.ctx.fillStyle = color;
      this.ctx.moveTo(cx, cy);
      this.ctx.arc(cx, cy, radius, angle, angle + arc);
      this.ctx.lineTo(cx, cy);
      this.ctx.fill();

      // Border between segments
      this.ctx.strokeStyle = '#ffffff';
      this.ctx.lineWidth = 2;
      this.ctx.stroke();

      // Draw text/label
      this.ctx.save();
      this.ctx.translate(cx, cy);
      this.ctx.rotate(angle + arc / 2);
      this.ctx.textAlign = 'right';
      this.ctx.fillStyle = '#fff';
      
      const segment = this.options.segments[i];
      let text = typeof segment === 'string' ? segment : segment.label;
      
      // Shadow for text readability
      this.ctx.shadowColor = 'rgba(0,0,0,0.5)';
      this.ctx.shadowBlur = 4;
      this.ctx.fillText(text, radius - 20, 5);
      this.ctx.restore();
    }
    
    // Outer border
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, radius - 2, 0, 2 * Math.PI);
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    this.ctx.lineWidth = 4;
    this.ctx.stroke();
  }

  spin() {
    if (this.isSpinning) return;
    this.isSpinning = true;

    // Randomize extra spins
    const extraSpins = Math.floor(Math.random() * 5) + 5; // 5 to 9 full spins
    const randomAngle = Math.random() * 360; // random landing angle
    
    const targetRotation = this.currentRotation + (extraSpins * 360) + randomAngle;
    
    this.wheelWrapper.style.transform = `rotate(${targetRotation}deg)`;

    setTimeout(() => {
      this.isSpinning = false;
      this.currentRotation = targetRotation % 360;
      
      // Calculate which segment won
      const numSegments = this.options.segments.length;
      const degreesPerSegment = 360 / numSegments;
      // The pointer is at the top (270 degrees in canvas coords, but our rotation shifts it)
      // We normalize the rotation to find the winning segment
      const normalizedRot = (360 - (targetRotation % 360) + 270) % 360;
      const winningIndex = Math.floor(normalizedRot / degreesPerSegment) % numSegments;
      
      const winner = this.options.segments[winningIndex];
      
      if (this.options.onSpinEnd) {
        this.options.onSpinEnd(winner);
      }
    }, this.options.spinDuration);
  }
}
