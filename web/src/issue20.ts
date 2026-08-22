const formControlSelector = 'input, textarea, select';

function preventUnexpectedFormFocus() {
  let permittedPointerTarget: EventTarget | null = null;
  let keyboardNavigation = false;

  document.addEventListener('pointerdown', event => {
    permittedPointerTarget = event.target instanceof Element && event.target.matches(formControlSelector)
      ? event.target
      : null;
    keyboardNavigation = false;
  }, true);

  document.addEventListener('keydown', event => {
    keyboardNavigation = event.key === 'Tab';
    if (event.key !== 'Tab') permittedPointerTarget = null;
  }, true);

  document.addEventListener('focusin', event => {
    const target = event.target;
    if (!(target instanceof HTMLElement) || !target.matches(formControlSelector)) return;

    const explicitlySelected = target === permittedPointerTarget;
    if (explicitlySelected || keyboardNavigation) {
      permittedPointerTarget = null;
      keyboardNavigation = false;
      return;
    }

    target.blur();
  }, true);
}

function enhanceManualShoppingInput(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>('.manual-add').forEach(container => {
    if (container.dataset.issue20Enhanced === 'true') return;
    container.dataset.issue20Enhanced = 'true';

    const header = document.createElement('div');
    header.className = 'manual-add-header';
    header.innerHTML = '<strong>買うものを手動で追加</strong><span>献立にない日用品や食材を追加できます</span>';
    container.prepend(header);

    const input = container.querySelector<HTMLInputElement>('input');
    if (input) {
      input.placeholder = '例：牛乳、ティッシュ';
      input.setAttribute('aria-label', '買い物リストへ手動で追加する項目');
      input.setAttribute('enterkeyhint', 'done');
    }

    const button = container.querySelector<HTMLButtonElement>('button');
    if (button) {
      button.setAttribute('aria-label', '買い物リストに追加');
      button.setAttribute('title', '買い物リストに追加');
      const label = document.createElement('span');
      label.className = 'manual-add-button-label';
      label.textContent = '追加';
      button.append(label);
    }
  });
}

export function installIssue20Enhancements() {
  preventUnexpectedFormFocus();
  enhanceManualShoppingInput();

  const observer = new MutationObserver(() => enhanceManualShoppingInput());
  observer.observe(document.body, { childList: true, subtree: true });
}
