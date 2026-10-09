(function(){
  const $ = (id) => document.getElementById(id);

  function click(id) {
    const target = $(id);
    if (!target) return false;
    target.click();
    return true;
  }

  function setFeatureModal({ kicker = 'Gremory', title = 'Em breve', text = 'Essa área está sendo preparada.' } = {}) {
    const modal = $('featureModal');
    if (!modal) return;
    $('featureModalKicker').textContent = kicker;
    $('featureModalTitle').textContent = title;
    $('featureModalText').textContent = text;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
  }

  function closeFeatureModal() {
    const modal = $('featureModal');
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
  }

  function openPokedex() {
    const pokeBtn = document.querySelector('.gremory-pokedex-btn');
    if (pokeBtn) {
      pokeBtn.click();
      return;
    }
    setFeatureModal({
      kicker: 'Pokémon Gremory',
      title: 'Pokédex em preparação',
      text: 'A base Pokémon do site vai crescer nas próximas etapas, com equipe, exploração, captura, mochila e ligação direta com a Charlotte.'
    });
  }

  function go(target) {
    switch (target) {
      case 'home':
        window.scrollTo({ top: 0, behavior: 'smooth' });
        break;
      case 'pokemon': {
        const portal = $('pokemonPortal');
        if (portal) portal.scrollIntoView({ behavior: 'smooth', block: 'start' });
        else openPokedex();
        break;
      }
      case 'downloads':
        click('downloadsBtn');
        break;
      case 'profile':
        click('authBtn');
        break;
      case 'shop':
        click('shopBtn');
        break;
      case 'rpg':
        setFeatureModal({
          kicker: 'RPG Gremory',
          title: 'Mesa virtual em construção',
          text: 'O módulo RPG será focado em fichas, campanhas, mapas, dados, regras, chat e depois voz e compartilhamento de tela.'
        });
        break;
      case 'watch':
        setFeatureModal({
          kicker: 'Watch Party',
          title: 'Salas privadas Gremory',
          text: 'As salas serão usadas para assistir conteúdos compatíveis com amigos, com convites, presença em tempo real e sincronização.'
        });
        break;
    }
  }

  function bind(buttonIds, handler) {
    buttonIds.forEach((id) => $(id)?.addEventListener('click', handler));
  }

  document.addEventListener('DOMContentLoaded', () => {
    bind(['hubOpenProfile', 'hubOpenProfile2'], () => go('profile'));
    bind(['hubOpenDownloads', 'hubOpenDownloads2'], () => go('downloads'));
    bind(['hubOpenPokemon', 'hubOpenPokemon2', 'pokemonPortalPokedex'], openPokedex);
    bind(['hubOpenShop2'], () => go('shop'));
    bind(['hubOpenWatch'], () => go('watch'));
    bind(['hubOpenRpg'], () => go('rpg'));
    bind(['hubOpenPokemonRoadmap'], () => {
      const roadmap = $('hubRoadmap');
      if (roadmap) roadmap.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    document.querySelectorAll('[data-gremory-go]').forEach((button) => {
      button.addEventListener('click', () => {
        go(button.dataset.gremoryGo || 'home');
        document.querySelectorAll('.gremory-mobile-nav button').forEach((b) => b.classList.remove('active'));
        if (button.closest('.gremory-mobile-nav')) button.classList.add('active');
      });
    });

    bind(['featureModalBackdrop', 'featureModalClose', 'featureModalPrimary'], closeFeatureModal);
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') closeFeatureModal();
    });

    const authBtn = $('authBtn');
    if (authBtn && authBtn.textContent.trim() === 'Minha conta') {
      authBtn.title = 'Abrir sua conta Gremory';
    }
  });
})();
