import './style.css';
import { missions, skippedMissions } from './data/missions.js';

const programOrder = ['Mercury', 'Gemini', 'Apollo', 'Skylab', 'Space Shuttle', 'Commercial Crew', 'Artemis'];
const programColors = {
  Mercury: '#75d7ff',
  Gemini: '#8f9dff',
  Apollo: '#ffd166',
  Skylab: '#9cf1a2',
  'Space Shuttle': '#ff8b6b',
  'Commercial Crew': '#f472ff',
  Artemis: '#d4c0ff',
};

const programs = programOrder.filter((program) => missions.some((mission) => mission.program === program));
const eras = [...new Set(missions.map((mission) => mission.era))];
const yearValues = missions.map((mission) => mission.year).filter(Boolean);
const earliestYear = Math.min(...yearValues);
const latestYear = Math.max(...yearValues);

const state = {
  query: '',
  program: 'All',
  era: 'All',
  sort: 'year-desc',
  immersive: false,
  modalOpen: false,
  selectedMissionId: missions.find((mission) => mission.title === 'Apollo 11')?.id ?? missions[0]?.id,
};

const app = document.querySelector('#app');
app.innerHTML = `
  <div class="site-shell">
    <header class="hero-panel shell-panel">
      <div class="hero-copy">
        <p class="eyebrow">NASA mission badge archive</p>
        <h1>Every NASA mission patch we could recover, staged like a deep-space exhibition.</h1>
        <p class="hero-text">
          A cinematic, filterable gallery built from Wikipedia + Wikimedia mission insignia metadata, with an immersive mode for viewing badges without interface clutter.
        </p>
        <div class="hero-actions">
          <a class="button primary" href="#gallery">Explore the archive</a>
          <button class="button ghost" id="immersive-toggle" type="button" aria-pressed="false">Immersive view</button>
        </div>
      </div>
      <div class="hero-stats" id="hero-stats"></div>
    </header>

    <section class="coverage-band shell-panel" aria-label="Coverage summary">
      <div>
        <p class="eyebrow">Coverage</p>
        <h2>182 mission patches across 7 NASA eras and programs</h2>
      </div>
      <p id="coverage-copy"></p>
    </section>

    <main class="layout-grid" id="gallery">
      <section class="gallery-column">
        <div class="controls shell-panel">
          <div class="control-block search-block">
            <label for="mission-search">Search missions</label>
            <input id="mission-search" type="search" placeholder="Apollo 11, STS-31, Artemis…" autocomplete="off" />
          </div>
          <div class="control-block">
            <span>Program</span>
            <div class="pill-group" id="program-filters"></div>
          </div>
          <div class="control-row dual">
            <div class="control-block">
              <span>Era</span>
              <div class="pill-group compact" id="era-filters"></div>
            </div>
            <div class="control-block">
              <label for="sort-order">Sort by</label>
              <select id="sort-order">
                <option value="year-asc">Year: earliest first</option>
                <option value="year-desc">Year: latest first</option>
                <option value="title">Title: A–Z</option>
                <option value="program">Program</option>
              </select>
            </div>
          </div>
          <div class="results-meta">
            <p id="results-summary"></p>
            <p class="results-range">${earliestYear}–${latestYear}</p>
          </div>
        </div>

        <div class="mission-grid" id="mission-grid"></div>
      </section>

      <aside class="detail-column">
        <div class="detail-panel shell-panel" id="detail-panel"></div>
      </aside>
    </main>
  </div>

  <div class="mission-modal" id="mission-modal" aria-hidden="true">
    <div class="mission-modal__backdrop" data-modal-close="true"></div>
    <div class="mission-modal__dialog shell-panel" role="dialog" aria-modal="true" aria-labelledby="mission-modal-title">
      <button class="mission-modal__close" id="mission-modal-close" type="button" aria-label="Close mission details">×</button>
      <div id="mission-modal-content"></div>
    </div>
  </div>
`;

const heroStats = document.querySelector('#hero-stats');
const coverageCopy = document.querySelector('#coverage-copy');
const missionGrid = document.querySelector('#mission-grid');
const detailPanel = document.querySelector('#detail-panel');
const resultsSummary = document.querySelector('#results-summary');
const searchInput = document.querySelector('#mission-search');
const sortOrder = document.querySelector('#sort-order');
const immersiveToggle = document.querySelector('#immersive-toggle');
const missionModal = document.querySelector('#mission-modal');
const missionModalContent = document.querySelector('#mission-modal-content');
const missionModalClose = document.querySelector('#mission-modal-close');

function renderHeroStats() {
  const stats = [
    { label: 'Recovered patches', value: missions.length },
    { label: 'Programs represented', value: programs.length },
    { label: 'Missing or not public yet', value: skippedMissions.length },
    { label: 'Timespan', value: `${earliestYear}–${latestYear}` },
  ];

  heroStats.innerHTML = stats
    .map(
      (stat) => `
        <article class="stat-card">
          <strong>${stat.value}</strong>
          <span>${stat.label}</span>
        </article>
      `,
    )
    .join('');
}

function renderCoverageCopy() {
  const missingTitles = skippedMissions.map((mission) => mission.title).join(', ');
  coverageCopy.textContent = skippedMissions.length
    ? `The current dataset covers missions with identifiable public insignia files. Still missing from the archive: ${missingTitles}.`
    : 'No gaps detected in the current target mission list.';
}

function renderPills(target, values, current, prefix = 'All') {
  target.innerHTML = [prefix, ...values]
    .map((value) => {
      const isActive = value === current;
      return `<button class="pill ${isActive ? 'active' : ''}" type="button" data-value="${value}">${value}</button>`;
    })
    .join('');
}

function getFilteredMissions() {
  const query = state.query.trim().toLowerCase();

  const filtered = missions.filter((mission) => {
    const haystack = [mission.title, mission.program, mission.era, mission.description, mission.extract]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    const matchesQuery = !query || haystack.includes(query);
    const matchesProgram = state.program === 'All' || mission.program === state.program;
    const matchesEra = state.era === 'All' || mission.era === state.era;

    return matchesQuery && matchesProgram && matchesEra;
  });

  return filtered.sort((left, right) => {
    if (state.sort === 'year-desc') return (right.year ?? 0) - (left.year ?? 0) || left.title.localeCompare(right.title, undefined, { numeric: true });
    if (state.sort === 'title') return left.title.localeCompare(right.title, undefined, { numeric: true });
    if (state.sort === 'program') return left.program.localeCompare(right.program) || (left.year ?? 0) - (right.year ?? 0);
    return (left.year ?? 0) - (right.year ?? 0) || left.title.localeCompare(right.title, undefined, { numeric: true });
  });
}

function getMissionById(missionId) {
  return missions.find((mission) => mission.id === missionId) ?? missions[0];
}

function ensureSelectedMission(filteredMissions) {
  if (!filteredMissions.some((mission) => mission.id === state.selectedMissionId)) {
    state.selectedMissionId = filteredMissions[0]?.id ?? missions[0]?.id;
  }
}

function renderMissionGrid(filteredMissions) {
  resultsSummary.textContent = `${filteredMissions.length} of ${missions.length} missions visible`;

  if (!filteredMissions.length) {
    missionGrid.innerHTML = `
      <div class="empty-state shell-panel">
        <p class="eyebrow">No matches</p>
        <h3>Try another search or reset the filters.</h3>
      </div>
    `;
    return;
  }

  missionGrid.innerHTML = filteredMissions
    .map((mission) => {
      const isSelected = mission.id === state.selectedMissionId;
      const accent = programColors[mission.program] ?? '#ffffff';
      return `
        <button
          class="mission-card ${isSelected ? 'selected' : ''}"
          type="button"
          data-mission-id="${mission.id}"
          style="--accent:${accent}"
          aria-pressed="${isSelected}"
        >
          <span class="mission-card__meta">
            <span>${mission.program}</span>
            <span>${mission.year ?? 'TBD'}</span>
          </span>
          <div class="mission-card__image-wrap">
            <img src="${mission.image}" alt="${mission.title} mission patch" loading="lazy" />
          </div>
          <span class="mission-card__title">${mission.title}</span>
        </button>
      `;
    })
    .join('');
}

function getMissionDetailMarkup(mission, eyebrow = 'Selected mission', headingId = '') {
  const accent = programColors[mission.program] ?? '#ffffff';
  const summary = mission.extract || mission.description || 'Mission background coming soon.';

  return `
    <div class="detail-topline">
      <p class="eyebrow">${eyebrow}</p>
      <span class="detail-year">${mission.year ?? 'TBD'}</span>
    </div>
    <div class="detail-image" style="--accent:${accent}">
      <img src="${mission.originalImage}" alt="${mission.title} patch artwork" />
    </div>
    <div class="detail-copy">
      <h2${headingId ? ` id="${headingId}"` : ''}>${mission.title}</h2>
      <div class="detail-tags">
        <span>${mission.program}</span>
        <span>${mission.era}</span>
        <span>${mission.launchDate || 'Date TBD'}</span>
      </div>
      <p>${summary}</p>
    </div>
    <dl class="detail-facts">
      <div>
        <dt>Patch source file</dt>
        <dd>${mission.patchFile}</dd>
      </div>
      <div>
        <dt>Wikipedia</dt>
        <dd><a href="${mission.wikipediaUrl}" target="_blank" rel="noreferrer">Mission article</a></dd>
      </div>
      <div>
        <dt>Wikimedia</dt>
        <dd><a href="${mission.descriptionUrl}" target="_blank" rel="noreferrer">Patch asset page</a></dd>
      </div>
    </dl>
  `;
}

function renderDetailPanel() {
  const mission = getMissionById(state.selectedMissionId);
  if (!mission) return;
  detailPanel.innerHTML = getMissionDetailMarkup(mission);
}

function renderMissionModal() {
  const mission = getMissionById(state.selectedMissionId);
  if (!mission) return;

  missionModalContent.innerHTML = getMissionDetailMarkup(mission, 'Immersive mission view', 'mission-modal-title');
  missionModal.classList.toggle('open', state.modalOpen);
  missionModal.setAttribute('aria-hidden', String(!state.modalOpen));
}

function render() {
  const filteredMissions = getFilteredMissions();
  ensureSelectedMission(filteredMissions);
  renderMissionGrid(filteredMissions);
  renderDetailPanel();
  renderMissionModal();
}

function scrollDetailIntoView() {
  detailPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

renderHeroStats();
renderCoverageCopy();
renderPills(document.querySelector('#program-filters'), programs, state.program);
renderPills(document.querySelector('#era-filters'), eras, state.era);
render();

searchInput.addEventListener('input', (event) => {
  state.query = event.target.value;
  render();
});

sortOrder.addEventListener('change', (event) => {
  state.sort = event.target.value;
  render();
});

immersiveToggle.addEventListener('click', () => {
  state.immersive = !state.immersive;
  if (!state.immersive) state.modalOpen = false;
  document.body.classList.toggle('immersive-mode', state.immersive);
  immersiveToggle.setAttribute('aria-pressed', String(state.immersive));
  immersiveToggle.textContent = state.immersive ? 'Exit immersive view' : 'Immersive view';
  renderMissionModal();
});

document.querySelector('#program-filters').addEventListener('click', (event) => {
  const button = event.target.closest('.pill');
  if (!button) return;
  state.program = button.dataset.value;
  renderPills(document.querySelector('#program-filters'), programs, state.program);
  render();
});

document.querySelector('#era-filters').addEventListener('click', (event) => {
  const button = event.target.closest('.pill');
  if (!button) return;
  state.era = button.dataset.value;
  renderPills(document.querySelector('#era-filters'), eras, state.era);
  render();
});

missionGrid.addEventListener('click', (event) => {
  const card = event.target.closest('.mission-card');
  if (!card) return;
  state.selectedMissionId = card.dataset.missionId;
  if (state.immersive) state.modalOpen = true;
  render();
  if (state.immersive) return;
  requestAnimationFrame(() => {
    scrollDetailIntoView();
  });
});

missionModal.addEventListener('click', (event) => {
  if (!event.target.closest('[data-modal-close="true"], #mission-modal-close')) return;
  state.modalOpen = false;
  renderMissionModal();
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || !state.modalOpen) return;
  state.modalOpen = false;
  renderMissionModal();
});
