import { store } from '../store';
import * as api from '../api';
import { navigate } from '../router';
import { el } from '../chess';

export const loginView = {
  mount(container: HTMLElement): () => void {
    const wrapper = el('div', [], {
      style: 'display:flex;align-items:center;justify-content:center;flex:1;padding:24px',
    });

    const card = el('div', ['card'], {
      style: 'padding:48px 40px;width:100%;max-width:400px;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,0.4)',
    });

    const title = el('h1', [], {
      style: 'font-size:36px;font-weight:700;color:var(--text);letter-spacing:-0.5px;margin-bottom:4px',
    }, 'Chess');
    card.appendChild(title);

    const subtitle = el('p', [], {
      style: 'font-size:14px;font-weight:300;color:var(--muted);margin-bottom:32px;letter-spacing:0.3px',
    }, 'Play chess online');
    card.appendChild(subtitle);

    const input = el('input', ['input-clean'], {
      type: 'text',
      placeholder: 'Enter your username',
      autocomplete: 'off',
      autocapitalize: 'off',
      autocorrect: 'off',
      spellcheck: 'false',
    });
    card.appendChild(input);

    const button = el('button', ['btn', 'btn-primary'], {
      style: 'margin-top:24px;width:100%;padding:14px;font-size:16px',
    }, 'Enter');

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

    setTimeout(() => input.focus(), 100);

    return () => {
      wrapper.remove();
    };
  },
};
