// Общий переключатель состояний превью (кнопки в .preview-bar + data-t)
(function () {
  const bar = document.querySelector('.preview-bar');
  if (!bar) return;

  // ===== док переключения тем ( Mono / Eclipse / Voxel ) =====
  const THEMES = [
    { id: '', name: 'Mono', title: 'Тема Mono — чёрный монолит' },
    { id: 'eclipse', name: 'Eclipse', title: 'Тема Eclipse — светлая' },
    { id: 'voxel', name: 'Voxel', title: 'Тема Voxel — зелёный ретро-терминал' },
  ];
  const dock = document.createElement('div');
  dock.className = 'theme-dock';
  dock.innerHTML = '<span class="td-lbl">тема</span>';
  const current = document.documentElement.dataset.theme || '';
  THEMES.forEach((t) => {
    const b = document.createElement('button');
    b.className = 'tdot ' + (t.id || 'mono') + (t.id === current ? ' on' : '');
    b.title = t.title;
    b.setAttribute('aria-label', t.name);
    b.addEventListener('click', () => {
      if (t.id) document.documentElement.dataset.theme = t.id;
      else delete document.documentElement.dataset.theme;
      dock.querySelectorAll('.tdot').forEach((x) => x.classList.remove('on'));
      b.classList.add('on');
      // синхронизируем карточки тем на странице настроек, если они есть
      document.querySelectorAll('.theme-card').forEach((c) => {
        c.classList.toggle('on', (c.dataset.theme || '') === t.id);
      });
    });
    dock.appendChild(b);
  });
  const spacer = document.createElement('span');
  spacer.className = 'spacer';
  bar.appendChild(spacer);
  bar.appendChild(dock);

  const btns = [...bar.querySelectorAll('button[data-t]')];
  const panes = {};
  document.querySelectorAll('.pane').forEach((p) => { panes[p.id] = p; });

  function show(id) {
    btns.forEach((b) => b.classList.toggle('on', b.dataset.t === id));
    Object.entries(panes).forEach(([k, el]) => {
      el.classList.remove('show');
      if (k === id) { void el.offsetWidth; el.classList.add('show'); }
    });
  }
  btns.forEach((b) => b.addEventListener('click', () => show(b.dataset.t)));
  window.switchPane = show;

  // переключение табов внутри страниц
  document.querySelectorAll('[data-tabs]').forEach((group) => {
    const tabs = [...group.querySelectorAll('.tab')];
    tabs.forEach((t) => t.addEventListener('click', () => {
      tabs.forEach((x) => x.classList.toggle('on', x === t));
      const target = t.dataset.target;
      if (target && panes[target]) show(target);
    }));
  });

  // переключение фильтров-чипов (ftype) — просто визуал
  document.querySelectorAll('.ftype').forEach((f) => {
    f.addEventListener('click', () => f.classList.toggle('on'));
  });

  // модалки
  document.querySelectorAll('[data-open-modal]').forEach((b) => {
    b.addEventListener('click', () => {
      const m = document.getElementById(b.dataset.openModal);
      if (m) m.classList.add('show');
    });
  });
  document.querySelectorAll('.overlay').forEach((ov) => {
    ov.addEventListener('click', (e) => { if (e.target === ov) ov.classList.remove('show'); });
    const x = ov.querySelector('.x');
    if (x) x.addEventListener('click', () => ov.classList.remove('show'));
  });
})();
