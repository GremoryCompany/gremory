/* Gremory Pokédex leve para Vercel
   Sem GIFs locais: usa sprites externos por número da Pokédex.
*/

const POKEDEX_GENERATIONS = {
  1: { start: 1, end: 151, label: '1ª Geração' },
  2: { start: 152, end: 251, label: '2ª Geração' },
  3: { start: 252, end: 386, label: '3ª Geração' }
};

const SPRITE_ANIMATED_BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated';
const SPRITE_FALLBACK_BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon';
const POKEAPI_BASE = 'https://pokeapi.co/api/v2/pokemon';

let currentGeneration = 1;
const pokemonCache = new Map();

function formatPokemonNumber(id) {
  return `#${String(id).padStart(3, '0')}`;
}

function formatName(name) {
  if (!name) return 'Carregando...';
  return name
    .replace(/-/g, ' ')
    .replace(/\b\w/g, letter => letter.toUpperCase());
}

function getAnimatedSpriteUrl(id) {
  return `${SPRITE_ANIMATED_BASE}/${id}.gif`;
}

function getFallbackSpriteUrl(id) {
  return `${SPRITE_FALLBACK_BASE}/${id}.png`;
}

function setStatus(message, active = false) {
  const status = document.getElementById('pokedexStatus');
  if (!status) return;
  status.textContent = message;
  status.classList.toggle('active', active);
}

async function fetchPokemon(id) {
  if (pokemonCache.has(id)) return pokemonCache.get(id);

  const cacheKey = `gremory_pokemon_${id}`;
  const saved = localStorage.getItem(cacheKey);

  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      pokemonCache.set(id, parsed);
      return parsed;
    } catch (_) {}
  }

  const response = await fetch(`${POKEAPI_BASE}/${id}`);
  if (!response.ok) throw new Error(`Erro ao buscar Pokémon ${id}`);
  const data = await response.json();

  const pokemon = {
    id,
    name: data.name,
    height: data.height,
    weight: data.weight,
    types: (data.types || []).map(item => item.type.name),
    stats: (data.stats || []).map(item => ({
      name: item.stat.name,
      value: item.base_stat
    }))
  };

  pokemonCache.set(id, pokemon);
  localStorage.setItem(cacheKey, JSON.stringify(pokemon));
  return pokemon;
}

function createPokedexCard(id) {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'pokedex-card';
  card.dataset.id = String(id);
  card.dataset.name = '';

  card.innerHTML = `
    <img src="${getAnimatedSpriteUrl(id)}" alt="Pokémon ${id}" loading="lazy" onerror="this.onerror=null;this.src='${getFallbackSpriteUrl(id)}'">
    <div class="poke-number">${formatPokemonNumber(id)}</div>
    <div class="poke-name">Carregando...</div>
  `;

  card.addEventListener('click', () => openPokemonDetail(id));

  fetchPokemon(id)
    .then(pokemon => {
      card.dataset.name = pokemon.name.toLowerCase();
      const nameEl = card.querySelector('.poke-name');
      if (nameEl) nameEl.textContent = formatName(pokemon.name);
      const img = card.querySelector('img');
      if (img) img.alt = formatName(pokemon.name);
      applySearchFilter();
    })
    .catch(() => {
      const nameEl = card.querySelector('.poke-name');
      if (nameEl) nameEl.textContent = `Pokémon ${id}`;
    });

  return card;
}

function renderPokedexGeneration(gen = 1) {
  const grid = document.getElementById('pokedexGrid');
  const search = document.getElementById('pokedexSearch');
  if (!grid) return;

  currentGeneration = gen;
  const config = POKEDEX_GENERATIONS[gen];

  if (search) search.value = '';
  grid.innerHTML = '';
  setStatus(`Carregando ${config.label}...`, true);

  const fragment = document.createDocumentFragment();
  for (let id = config.start; id <= config.end; id++) {
    fragment.appendChild(createPokedexCard(id));
  }
  grid.appendChild(fragment);

  setTimeout(() => setStatus('', false), 500);
}

function applySearchFilter() {
  const search = document.getElementById('pokedexSearch');
  const term = (search?.value || '').toLowerCase().trim();
  const cards = document.querySelectorAll('.pokedex-card');

  cards.forEach(card => {
    const name = card.dataset.name || '';
    const id = card.dataset.id || '';
    const show = !term || name.includes(term) || id.includes(term) || formatPokemonNumber(id).includes(term);
    card.style.display = show ? '' : 'none';
  });
}

function statLabel(statName) {
  const labels = {
    hp: 'HP',
    attack: 'Ataque',
    defense: 'Defesa',
    'special-attack': 'Sp. Atk',
    'special-defense': 'Sp. Def',
    speed: 'Velocidade'
  };
  return labels[statName] || statName;
}

async function openPokemonDetail(id) {
  const overlay = document.getElementById('pokemonDetailOverlay');
  const content = document.getElementById('pokemonDetailContent');
  if (!overlay || !content) return;

  overlay.classList.add('active');
  overlay.setAttribute('aria-hidden', 'false');
  content.innerHTML = '<div class="detail-main"><p>Carregando detalhes...</p></div>';

  try {
    const pokemon = await fetchPokemon(id);
    const statsHtml = pokemon.stats.map(stat => {
      const width = Math.min(100, Math.round((stat.value / 180) * 100));
      return `
        <div class="stat-line">
          <span>${statLabel(stat.name)}</span>
          <div class="stat-bar"><div class="stat-fill" style="width:${width}%"></div></div>
          <strong>${stat.value}</strong>
        </div>
      `;
    }).join('');

    content.innerHTML = `
      <div class="detail-main">
        <img src="${getAnimatedSpriteUrl(id)}" alt="${formatName(pokemon.name)}" onerror="this.onerror=null;this.src='${getFallbackSpriteUrl(id)}'">
        <div class="poke-number">${formatPokemonNumber(id)}</div>
        <h3>${formatName(pokemon.name)}</h3>
        <div class="detail-types">
          ${pokemon.types.map(type => `<span class="type-pill">${formatName(type)}</span>`).join('')}
        </div>
        <p>Altura: <strong>${pokemon.height / 10}m</strong> · Peso: <strong>${pokemon.weight / 10}kg</strong></p>
        <div class="detail-stats">${statsHtml}</div>
      </div>
    `;
  } catch (error) {
    content.innerHTML = '<div class="detail-main"><p>Não consegui carregar os detalhes desse Pokémon.</p></div>';
  }
}

function closePokemonDetail() {
  const overlay = document.getElementById('pokemonDetailOverlay');
  if (!overlay) return;
  overlay.classList.remove('active');
  overlay.setAttribute('aria-hidden', 'true');
}

function initGremoryPokedex() {
  const openBtn = document.getElementById('openPokedexBtn');
  const closeBtn = document.getElementById('closePokedexBtn');
  const overlay = document.getElementById('pokedexOverlay');
  const tabs = document.querySelectorAll('.pokedex-tab');
  const search = document.getElementById('pokedexSearch');
  const closeDetailBtn = document.getElementById('closePokemonDetailBtn');
  const detailOverlay = document.getElementById('pokemonDetailOverlay');

  if (!openBtn || !closeBtn || !overlay) return;

  openBtn.addEventListener('click', () => {
    overlay.classList.add('active');
    overlay.setAttribute('aria-hidden', 'false');
    renderPokedexGeneration(currentGeneration || 1);
  });

  closeBtn.addEventListener('click', () => {
    overlay.classList.remove('active');
    overlay.setAttribute('aria-hidden', 'true');
  });

  overlay.addEventListener('click', event => {
    if (event.target === overlay) {
      overlay.classList.remove('active');
      overlay.setAttribute('aria-hidden', 'true');
    }
  });

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(item => item.classList.remove('active'));
      tab.classList.add('active');
      renderPokedexGeneration(Number(tab.dataset.gen || 1));
    });
  });

  if (search) search.addEventListener('input', applySearchFilter);

  if (closeDetailBtn) closeDetailBtn.addEventListener('click', closePokemonDetail);

  if (detailOverlay) {
    detailOverlay.addEventListener('click', event => {
      if (event.target === detailOverlay) closePokemonDetail();
    });
  }

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      overlay.classList.remove('active');
      overlay.setAttribute('aria-hidden', 'true');
      closePokemonDetail();
    }
  });
}

document.addEventListener('DOMContentLoaded', initGremoryPokedex);
