import './styles.css';
import { appConfig } from './app/config';
import { createWebGlContext } from './engine/render/webgl';

function requiredElement<TElement extends HTMLElement>(id: string): TElement {
  const element = document.getElementById(id);
  if (!(element instanceof HTMLElement)) throw new Error(`Не найден обязательный элемент #${id}.`);
  return element as TElement;
}

function showError(message: string): void {
  const overlay = document.getElementById('status-overlay');
  if (overlay instanceof HTMLElement) {
    overlay.textContent = message;
    overlay.hidden = false;
    overlay.classList.add('status-overlay--error');
  }
}

try {
  const canvas = requiredElement<HTMLCanvasElement>(appConfig.canvas.id);
  const result = createWebGlContext(canvas);
  if (!result.ok) showError(result.message);
  else requiredElement('status-overlay').hidden = true;
} catch (error: unknown) {
  showError(error instanceof Error ? `Не удалось запустить приложение: ${error.message}` : 'Не удалось запустить приложение.');
  console.error(error);
}
