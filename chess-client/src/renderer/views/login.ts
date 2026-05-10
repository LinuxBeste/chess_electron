import { store } from '../store';
import * as api from '../api';
import { navigate } from '../router';
import { el } from '../chess';

export const loginView = {
  mount(container: HTMLElement): () => void {
    const wrapper = el('div', [], {
      style: 'display:flex;align-items:center;justify-content:center;height:100%;padding:24px',
    });

    const card = el('div', [], {
      style: 'background:#1a1a1f;border-radius:12px;border:1px solid rgba(255,255,255,0.06);box-shadow:0 8px 32px rgba(0,0,0,0.4);padding:48px 40px;width:100%;max-width:400px;text-align:center',
    });

    const title = el('h1', [], {
      style: 'font-size:36px;font-weight:700;color:#e0e0e0;letter-spacing:-0.5px;margin-bottom:4px',
    }, 'Chess');
    card.appendChild(title);

    const subtitle = el('p', [], {
      style: 'font-size:14px;font-weight:300;color:#888;margin-bottom:32px;letter-spacing:0.3px',
    }, 'Play chess online');
    card.appendChild(subtitle);

    const input = el('input', [], {
      type: 'text',
      placeholder: 'Enter your username',
      autocomplete: 'off',
      autocapitalize: 'off',
      autocorrect: 'off',
      spellcheck: 'false',
      style: 'width:100%;background:transparent;border:none;border-bottom:2px solid rgba(255,255,255,0.1);color:#e0e0e0;font-size:18px;font-weight:500;padding:12px 0;outline:none;transition:border-color 150ms ease;letter-spacing:0.3px',
    });

    /* Animated bottom border on focus: dim → accent blue */
    input.addEventListener('focus', () => {
      input.style.borderBottomColor = '#4f8ef7';
    });
    input.addEventListener('blur', () => {
      input.style.borderBottomColor = 'rgba(255,255,255,0.1)';
    });
    card.appendChild(input);

    const button = el('button', [], {
      style: 'margin-top:24px;width:100%;padding:14px;background:#4f8ef7;color:#fff;border:none;border-radius:8px;font-size:16px;font-weight:500;cursor:pointer;transition:background 150ms ease,transform 150ms ease;letter-spacing:0.3px',
    }, 'Enter');
    button.addEventListener('mouseenter', () => { button.style.background = '#5d9af8'; });
    button.addEventListener('mouseleave', () => { button.style.background = '#4f8ef7'; });
    button.addEventListener('mousedown', () => { button.style.transform = 'scale(0.98)'; });
    button.addEventListener('mouseup', () => { button.style.transform = 'scale(1)'; });

    async function submit(): Promise<void> {
      const trimmed = input.value.trim();
      if (!trimmed) {
        input.style.borderBottomColor = 'rgba(220,50,50,0.6)';
        setTimeout(() => { input.style.borderBottomColor = ''; }, 2000);
        return;
      }
      button.disabled = true;
      button.textContent = 'Connecting...';
      try {
        const { playerId, token } = await api.register(trimmed);
        store.set('token', token);
        store.set('playerId', playerId);
        store.set('username', trimmed);
        navigate('lobby');
      } catch (err: any) {
        store.toast(err.message || 'Failed to connect');
        button.disabled = false;
        button.textContent = 'Enter';
      }
    }

    button.addEventListener('click', submit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submit();
    });

    card.appendChild(button);
    wrapper.appendChild(card);
    container.appendChild(wrapper);

    /* Defer focus so the DOM has time to render before the keyboard shows */
    setTimeout(() => input.focus(), 100);

    /* Cleanup: remove DOM — no listeners leak since all are on card/inner elements */
    return () => {
      wrapper.remove();
    };
  },
};
