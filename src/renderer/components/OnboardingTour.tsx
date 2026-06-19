import React, { useEffect, useMemo, useState } from 'react';
import type { Page } from '../../shared/types';
import { IconArchive, IconArrow, IconCheck, IconClose, IconCube, IconInfo, IconPlay, IconServer, IconSettings, IconSkin, IconSpark } from './icons';
import { useT } from '../i18n';

type Step = {
  id: string;
  page?: Page;
  tone: 'green' | 'blue' | 'purple' | 'orange' | 'pink' | 'gray';
  titleRu: string;
  titleEn: string;
  leadRu: string;
  leadEn: string;
  bulletsRu: string[];
  bulletsEn: string[];
  chipsRu: string[];
  chipsEn: string[];
  metaRu: string;
  metaEn: string;
  actionRu?: string;
  actionEn?: string;
};

const STEPS: Step[] = [
  {
    id: 'home',
    page: 'home',
    tone: 'green',
    titleRu: 'Главная: быстрый запуск',
    titleEn: 'Home: quick launch',
    leadRu: 'Стартовая точка лаунчера. Здесь видно выбранный аккаунт, последнюю версию и главное действие, запуск игры.',
    leadEn: 'The launcher starting point. It shows the selected account, last version and the main action, launching the game.',
    bulletsRu: ['Выбери установленную версию', 'Проверь активный аккаунт', 'Нажми запуск', 'Статус игры появится сверху'],
    bulletsEn: ['Pick an installed version', 'Check the active account', 'Press launch', 'Game status appears at the top'],
    chipsRu: ['Быстрый старт', 'Аккаунт', 'Статус сверху'],
    chipsEn: ['Quick start', 'Account', 'Top status'],
    metaRu: '1 минута до запуска',
    metaEn: '1 minute to launch',
    actionRu: 'Открыть главную',
    actionEn: 'Open home',
  },
  {
    id: 'browse',
    page: 'browse',
    tone: 'blue',
    titleRu: 'Версии: Java и Bedrock',
    titleEn: 'Versions: Java and Bedrock',
    leadRu: 'Во вкладке версий устанавливаются Java-сборки, загрузчики модов и Bedrock. Прогресс скачивания виден в глобальном индикаторе.',
    leadEn: 'The versions page installs Java builds, mod loaders and Bedrock. Download progress is visible in the global indicator.',
    bulletsRu: ['Java использует библиотеки, assets и Java Runtime', 'Bedrock скачивает APK', 'Bedrock запускается через TrelEmu', 'Для Java-модов нужна версия с loader'],
    bulletsEn: ['Java uses libraries, assets and Java Runtime', 'Bedrock downloads an APK', 'Bedrock runs through TrelEmu', 'Java mods need a loader build'],
    chipsRu: ['Java', 'Bedrock', 'Forge/Fabric'],
    chipsEn: ['Java', 'Bedrock', 'Forge/Fabric'],
    metaRu: 'Версии и загрузчики',
    metaEn: 'Versions and loaders',
    actionRu: 'Открыть версии',
    actionEn: 'Open versions',
  },
  {
    id: 'content',
    page: 'content',
    tone: 'purple',
    titleRu: 'Контент: моды и аддоны',
    titleEn: 'Content: mods and add-ons',
    leadRu: 'Страница контента меняется под выбранную версию. Java показывает моды и шейдеры, Bedrock показывает аддоны, ресурс-паки и миры.',
    leadEn: 'The content page adapts to the selected version. Java shows mods and shaders, Bedrock shows add-ons, resource packs and worlds.',
    bulletsRu: ['Java-моды это .jar', 'Bedrock-аддоны это .mcaddon или .mcpack', 'Bedrock-миры это .mcworld', 'Java-шейдеры не подходят для Bedrock'],
    bulletsEn: ['Java mods are .jar files', 'Bedrock add-ons are .mcaddon or .mcpack', 'Bedrock worlds are .mcworld', 'Java shaders do not work with Bedrock'],
    chipsRu: ['.jar', '.mcaddon', '.mcworld'],
    chipsEn: ['.jar', '.mcaddon', '.mcworld'],
    metaRu: 'Java и Bedrock отдельно',
    metaEn: 'Java and Bedrock separated',
    actionRu: 'Открыть контент',
    actionEn: 'Open content',
  },
  {
    id: 'servers',
    page: 'servers',
    tone: 'orange',
    titleRu: 'Серверы: контроль в один взгляд',
    titleEn: 'Servers: control at a glance',
    leadRu: 'Локальные серверы запускаются и останавливаются отдельно от клиента. Если сервер работает, лаунчер показывает это сверху и в боковом меню.',
    leadEn: 'Local servers start and stop separately from the client. If a server is running, the launcher shows it at the top and in the sidebar.',
    bulletsRu: ['Создай сервер', 'Запусти или останови его', 'Открой папку сервера', 'Следи за статусом сверху'],
    bulletsEn: ['Create a server', 'Start or stop it', 'Open the server folder', 'Watch status at the top'],
    chipsRu: ['Running', 'Logs', 'Folder'],
    chipsEn: ['Running', 'Logs', 'Folder'],
    metaRu: 'Статус всегда сверху',
    metaEn: 'Status always on top',
    actionRu: 'Открыть серверы',
    actionEn: 'Open servers',
  },
  {
    id: 'accounts',
    page: 'accounts',
    tone: 'pink',
    titleRu: 'Аккаунты и скины',
    titleEn: 'Accounts and skins',
    leadRu: 'Аккаунт определяет имя игрока и выбранный скин. В разделе скинов можно открыть 3D-просмотр и выбрать пресет.',
    leadEn: 'The account defines the player name and selected skin. The skins section opens a 3D preview and preset picker.',
    bulletsRu: ['Добавь аккаунт', 'Выбери активного игрока', 'Открой скины', 'Проверь модель classic или slim'],
    bulletsEn: ['Add an account', 'Pick the active player', 'Open skins', 'Check classic or slim model'],
    chipsRu: ['Игрок', 'Скин', '3D'],
    chipsEn: ['Player', 'Skin', '3D'],
    metaRu: 'Профиль игрока',
    metaEn: 'Player profile',
    actionRu: 'Открыть аккаунты',
    actionEn: 'Open accounts',
  },
  {
    id: 'settings',
    page: 'settings',
    tone: 'gray',
    titleRu: 'Настройки и восстановление',
    titleEn: 'Settings and recovery',
    leadRu: 'Здесь находятся тема, язык, папка игры, Java, память, обновления и аварийные действия. Если Bedrock сломался, здесь можно сбросить TrelEmu.',
    leadEn: 'Theme, language, game folder, Java, memory, updates and recovery actions live here. If Bedrock breaks, reset TrelEmu here.',
    bulletsRu: ['Настрой папку игры', 'Выбери Java', 'Выдели память', 'Сбрасывай TrelEmu только при проблемах'],
    bulletsEn: ['Set the game folder', 'Choose Java', 'Allocate memory', 'Reset TrelEmu only when needed'],
    chipsRu: ['Java', 'Память', 'TrelEmu'],
    chipsEn: ['Java', 'Memory', 'TrelEmu'],
    metaRu: 'Контроль и восстановление',
    metaEn: 'Control and recovery',
    actionRu: 'Открыть настройки',
    actionEn: 'Open settings',
  },
];

const StepIcon: React.FC<{ id: string }> = ({ id }) => {
  if (id === 'home') return <IconPlay />;
  if (id === 'browse') return <IconCube />;
  if (id === 'content') return <IconArchive />;
  if (id === 'servers') return <IconServer />;
  if (id === 'accounts') return <IconSkin />;
  return <IconSettings />;
};

const StepVisual: React.FC<{ step: Step; ru: boolean }> = ({ step, ru }) => (
  <div className={`onboarding-visual tone-${step.tone}`}>
    <div className="onboarding-visual-badge">
      <StepIcon id={step.id} />
      <span>{ru ? step.metaRu : step.metaEn}</span>
    </div>
    <div className="onboarding-orb orb-a" />
    <div className="onboarding-orb orb-b" />
    <div className="onboarding-device">
      <div className="onboarding-device-top">
        <span /><span /><span />
      </div>
      <div className="onboarding-device-grid">
        <div className="onboarding-device-sidebar">
          {STEPS.slice(0, 6).map((s) => <span key={s.id} className={s.id === step.id ? 'active' : ''} />)}
        </div>
        <div className="onboarding-device-screen">
          <div className="onboarding-hero-icon"><StepIcon id={step.id} /></div>
          <div className="onboarding-fake-title" />
          <div className="onboarding-fake-line short" />
          <div className="onboarding-mini-cards">
            <span /><span /><span />
          </div>
          <div className="onboarding-fake-progress"><span style={{ width: `${step.id === 'browse' ? 68 : step.id === 'servers' ? 42 : 84}%` }} /></div>
        </div>
      </div>
    </div>
    <div className="onboarding-chip-cloud">
      {(ru ? step.chipsRu : step.chipsEn).map((chip) => <span key={chip}>{chip}</span>)}
    </div>
    <div className="onboarding-visual-footer">
      <span>{ru ? 'Наведи порядок в лаунчере за пару шагов' : 'Learn the launcher in a few steps'}</span>
      <strong>{step.id.toUpperCase()}</strong>
    </div>
  </div>
);

interface Props {
  open: boolean;
  onClose: () => void;
  onNavigate: (page: Page) => void;
}

export const OnboardingTour: React.FC<Props> = ({ open, onClose, onNavigate }) => {
  const t = useT();
  const ru = t.locale === 'ru';
  const [index, setIndex] = useState(0);
  const step = STEPS[index];
  const progress = useMemo(() => Math.round(((index + 1) / STEPS.length) * 100), [index]);

  const title = ru ? step.titleRu : step.titleEn;
  const lead = ru ? step.leadRu : step.leadEn;
  const bullets = ru ? step.bulletsRu : step.bulletsEn;
  const action = ru ? step.actionRu : step.actionEn;

  const close = () => {
    try { localStorage.setItem('trel:onboarding-seen:v2', '1'); } catch {}
    onClose();
  };

  const navigate = () => {
    if (step.page) onNavigate(step.page);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
      if (event.key === 'ArrowRight') setIndex((v) => Math.min(STEPS.length - 1, v + 1));
      if (event.key === 'ArrowLeft') setIndex((v) => Math.max(0, v - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;

  return (
    <div className="onboarding-backdrop" role="dialog" aria-modal="true" aria-label={ru ? 'Обучение Trel' : 'Trel tutorial'}>
      <div className="onboarding-panel onboarding-panel-v2">
        <div className="onboarding-head onboarding-head-v2">
          <div>
            <div className="onboarding-kicker"><IconSpark /> {ru ? 'Быстрый тур по Trel' : 'Quick Trel tour'}</div>
            <h2>{title}</h2>
            <p>{ru ? 'Коротко, красиво и по делу, чтобы игрок сразу понял лаунчер.' : 'Short, polished and practical, so the player understands the launcher quickly.'}</p>
          </div>
          <button className="icon-btn" onClick={close} aria-label={ru ? 'Закрыть' : 'Close'}><IconClose /></button>
        </div>

        <div className="onboarding-progress onboarding-progress-v2"><span style={{ width: `${progress}%` }} /></div>

        <div className="onboarding-body onboarding-body-v2">
          <aside className="onboarding-steps onboarding-steps-v2">
            {STEPS.map((s, i) => (
              <button key={s.id} className={'onboarding-step onboarding-step-v2' + (i === index ? ' active' : '')} onClick={() => setIndex(i)}>
                <span className="onboarding-step-num"><StepIcon id={s.id} /></span>
                <span className="onboarding-step-text">
                  <strong>{ru ? s.titleRu.split(':')[0] : s.titleEn.split(':')[0]}</strong>
                  <small>{i + 1} / {STEPS.length}</small>
                </span>
              </button>
            ))}
          </aside>

          <section className="onboarding-card onboarding-card-v2">
            <StepVisual step={step} ru={ru} />
            <div className="onboarding-copy">
              <p className="onboarding-lead">{lead}</p>
              <div className="onboarding-points onboarding-points-v2">
                {bullets.map((b, i) => (
                  <div className="onboarding-point" key={i}><IconCheck /> <span>{b}</span></div>
                ))}
              </div>
              <div className="onboarding-tip">
                <IconInfo />
                <span>{ru ? 'Эта кнопка в настройках временная для проверки. Потом обучение можно сделать автоматическим при первом запуске.' : 'This Settings button is temporary for testing. Later the tutorial can open automatically on first launch.'}</span>
              </div>
            </div>
          </section>
        </div>

        <div className="onboarding-actions onboarding-actions-v2">
          <div className="onboarding-counter">
            <span>{index + 1} / {STEPS.length}</span>
            <small>{ru ? 'Esc закрывает окно' : 'Esc closes the window'}</small>
          </div>
          <div className="onboarding-action-buttons">
            <button className="btn ghost" onClick={() => setIndex(Math.max(0, index - 1))} disabled={index === 0}>{ru ? 'Назад' : 'Back'}</button>
            {step.page && <button className="btn ghost" onClick={navigate}>{action}</button>}
            {index < STEPS.length - 1 ? (
              <button className="btn primary" onClick={() => setIndex(index + 1)}>{ru ? 'Дальше' : 'Next'} <IconArrow /></button>
            ) : (
              <button className="btn primary" onClick={close}>{ru ? 'Готово' : 'Done'} <IconCheck /></button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
