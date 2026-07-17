// ── Mathify Custom Modal Dialog System ─────────────────────────────────────────
// Shared alert, confirm, and prompt dialogs styled with Mathify's glass design.
// Import this file in every template via: <script src="{% static 'js/dialogs.js' %}"></script>

function showCustomAlert(message, title = 'Notification') {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-[100] flex items-center justify-center p-md bg-black/85 backdrop-blur-sm opacity-0 transition-opacity duration-300';
    overlay.innerHTML = `
      <div class="w-full max-w-sm glass-panel rounded-2xl border border-white/10 p-lg flex flex-col gap-md shadow-2xl bg-surface/90 text-on-surface transform scale-95 transition-transform duration-300">
        <div class="flex justify-between items-center">
          <h3 class="font-headline-sm text-headline-sm text-primary font-bold">${title}</h3>
          <button class="close-modal-btn text-outline hover:text-on-surface transition-colors p-1 rounded-full hover:bg-white/5 flex items-center justify-center">
            <span class="material-symbols-outlined text-md">close</span>
          </button>
        </div>
        <div class="text-body-md text-on-surface-variant leading-relaxed">${message}</div>
        <div class="flex justify-end mt-sm">
          <button class="confirm-modal-btn px-lg py-sm bg-primary text-on-primary font-bold rounded-lg hover:opacity-90 transition-opacity active:scale-95 duration-150 text-sm">OK</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    const card = overlay.querySelector('.glass-panel');

    requestAnimationFrame(() => {
      overlay.classList.remove('opacity-0');
      card.classList.remove('scale-95');
    });

    const close = () => {
      overlay.classList.add('opacity-0');
      card.classList.add('scale-95');
      setTimeout(() => {
        overlay.remove();
        resolve();
      }, 300);
    };

    overlay.querySelector('.close-modal-btn').onclick = close;
    overlay.querySelector('.confirm-modal-btn').onclick = close;
  });
}

function showCustomConfirm(message, title = 'Confirmation') {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-[100] flex items-center justify-center p-md bg-black/85 backdrop-blur-sm opacity-0 transition-opacity duration-300';
    overlay.innerHTML = `
      <div class="w-full max-w-sm glass-panel rounded-2xl border border-white/10 p-lg flex flex-col gap-md shadow-2xl bg-surface/90 text-on-surface transform scale-95 transition-transform duration-300">
        <div class="flex justify-between items-center">
          <h3 class="font-headline-sm text-headline-sm text-primary font-bold">${title}</h3>
          <button class="close-modal-btn text-outline hover:text-on-surface transition-colors p-1 rounded-full hover:bg-white/5 flex items-center justify-center">
            <span class="material-symbols-outlined text-md">close</span>
          </button>
        </div>
        <div class="text-body-md text-on-surface-variant leading-relaxed">${message}</div>
        <div class="flex gap-sm justify-end mt-sm">
          <button class="cancel-modal-btn px-md py-sm border border-outline-variant/30 text-on-surface font-semibold rounded-lg text-sm transition-colors hover:bg-white/5 active:scale-95 duration-150">Cancel</button>
          <button class="confirm-modal-btn px-lg py-sm bg-primary text-on-primary font-bold rounded-lg hover:opacity-90 transition-opacity active:scale-95 duration-150 text-sm">Confirm</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    const card = overlay.querySelector('.glass-panel');

    requestAnimationFrame(() => {
      overlay.classList.remove('opacity-0');
      card.classList.remove('scale-95');
    });

    const dismiss = (value) => {
      overlay.classList.add('opacity-0');
      card.classList.add('scale-95');
      setTimeout(() => {
        overlay.remove();
        resolve(value);
      }, 300);
    };

    overlay.querySelector('.close-modal-btn').onclick = () => dismiss(false);
    overlay.querySelector('.cancel-modal-btn').onclick = () => dismiss(false);
    overlay.querySelector('.confirm-modal-btn').onclick = () => dismiss(true);
  });
}

function showCustomPrompt(message, defaultValue = '', title = 'Input Required') {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-[100] flex items-center justify-center p-md bg-black/85 backdrop-blur-sm opacity-0 transition-opacity duration-300';
    overlay.innerHTML = `
      <div class="w-full max-w-sm glass-panel rounded-2xl border border-white/10 p-lg flex flex-col gap-md shadow-2xl bg-surface/90 text-on-surface transform scale-95 transition-transform duration-300">
        <div class="flex justify-between items-center">
          <h3 class="font-headline-sm text-headline-sm text-primary font-bold">${title}</h3>
          <button class="close-modal-btn text-outline hover:text-on-surface transition-colors p-1 rounded-full hover:bg-white/5 flex items-center justify-center">
            <span class="material-symbols-outlined text-md">close</span>
          </button>
        </div>
        <div class="text-body-md text-on-surface-variant leading-relaxed mb-xs">${message}</div>
        <input type="text" class="prompt-input-field w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg p-sm text-on-surface focus:outline-none focus:border-primary text-body-md" value="${defaultValue}" />
        <div class="flex gap-sm justify-end mt-sm">
          <button class="cancel-modal-btn px-md py-sm border border-outline-variant/30 text-on-surface font-semibold rounded-lg text-sm transition-colors hover:bg-white/5 active:scale-95 duration-150">Cancel</button>
          <button class="confirm-modal-btn px-lg py-sm bg-primary text-on-primary font-bold rounded-lg hover:opacity-90 transition-opacity active:scale-95 duration-150 text-sm">OK</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    const card = overlay.querySelector('.glass-panel');
    const input = overlay.querySelector('.prompt-input-field');

    setTimeout(() => { input.focus(); }, 100);

    requestAnimationFrame(() => {
      overlay.classList.remove('opacity-0');
      card.classList.remove('scale-95');
    });

    const dismiss = (value) => {
      overlay.classList.add('opacity-0');
      card.classList.add('scale-95');
      setTimeout(() => {
        overlay.remove();
        resolve(value);
      }, 300);
    };

    overlay.querySelector('.close-modal-btn').onclick = () => dismiss(null);
    overlay.querySelector('.cancel-modal-btn').onclick = () => dismiss(null);
    overlay.querySelector('.confirm-modal-btn').onclick = () => dismiss(input.value);

    input.onkeydown = (e) => {
      if (e.key === 'Enter') {
        dismiss(input.value);
      }
    };
  });
}

// Override global alert/confirm/prompt with styled versions
window.alert = showCustomAlert;
window.confirm = showCustomConfirm;
window.prompt = showCustomPrompt;
