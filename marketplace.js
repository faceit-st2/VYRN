const marketRoot = document.querySelector('.market-page');
const marketGrid = marketRoot?.querySelector('.market-grid');
const marketSearch = marketRoot?.querySelector('.market-search-input');
const marketCollectionFilter = marketRoot?.querySelector('.market-collection-filter');
const marketSort = marketRoot?.querySelector('.market-sort');
const marketEmpty = marketRoot?.querySelector('.market-empty');
const marketFeedback = marketRoot?.querySelector('.market-action-feedback');
const marketTradeButtons = [...(marketRoot?.querySelectorAll('.market-trade-button') || [])];
const marketTradeNav = marketRoot?.querySelector('.market-trade-nav');
const marketTradeIndicator = marketTradeNav?.querySelector('.market-trade-indicator');
const marketListingDialog = document.querySelector('.market-listing-dialog');
const marketSupabase = window.VYRN_SUPABASE_CLIENT;
const marketTelegramUser = window.VYRN_CURRENT_USER || window.Telegram?.WebApp?.initDataUnsafe?.user || (() => {
  try {
    return JSON.parse(sessionStorage.getItem('vyrn.telegram.user.v1') || 'null');
  } catch {
    return null;
  }
})();

if (marketGrid && marketSearch && marketCollectionFilter && marketSort && marketEmpty && marketTradeNav && marketSupabase) {
  const catalog = Array.isArray(window.VYRN_NFT_CATALOG) ? window.VYRN_NFT_CATALOG : [];
  const marketCurrency = 'stars.png';
  const marketDialogArt = marketListingDialog.querySelector('.market-listing-dialog-art');
  const marketDialogImage = marketListingDialog.querySelector('.market-listing-dialog-image');
  const marketDialogAnimation = marketListingDialog.querySelector('.market-listing-dialog-animation');
  const marketDialogBackdrop = marketListingDialog.querySelector('.market-listing-dialog-backdrop');
  const marketDialogTitle = marketListingDialog.querySelector('.market-listing-dialog-title');
  const marketDialogOwnerAvatarLink = marketListingDialog.querySelector('.market-listing-dialog-avatar-link');
  const marketDialogOwnerAvatar = marketListingDialog.querySelector('.market-listing-dialog-avatar');
  const marketDialogOwnerFallback = marketListingDialog.querySelector('.market-listing-dialog-avatar-fallback');
  const marketDialogOwnerLink = marketListingDialog.querySelector('.market-listing-dialog-owner-name');
  const marketDialogMessage = marketListingDialog.querySelector('.market-listing-dialog-message');
  const marketDialogModel = marketListingDialog.querySelector('.market-listing-dialog-model');
  const marketDialogPrice = marketListingDialog.querySelector('.market-listing-dialog-price');
  const marketDialogStatus = marketListingDialog.querySelector('.market-listing-dialog-status');
  const marketDialogAction = marketListingDialog.querySelector('.market-listing-dialog-action');
  let marketMode = 'all';
  let listings = [];
  let sellerProfiles = new Map();
  let isProcessingListing = false;
  let marketAnimationRequest = 0;
  let marketAnimations = [];
  let activeMarketGiftAnimation = null;

  catalog.forEach((gift) => {
    if (![...marketCollectionFilter.options].some((option) => option.value === gift.name)) {
      marketCollectionFilter.add(new Option(gift.name, gift.name));
    }
  });

  const formatStars = (amount) => Number(amount || 0).toLocaleString('ru-RU');
  const setFeedback = (message = '', isError = false) => {
    if (!marketFeedback) return;
    marketFeedback.textContent = message;
    marketFeedback.hidden = !message;
    marketFeedback.dataset.type = isError ? 'error' : 'success';
  };
  const getProfileName = (telegramId) => {
    const profile = sellerProfiles.get(String(telegramId));
    return profile?.telegram_username
      ? `@${profile.telegram_username}`
      : [profile?.profile_first_name || profile?.telegram_first_name, profile?.profile_last_name || profile?.telegram_last_name]
          .filter(Boolean)
          .join(' ') || `ID ${telegramId}`;
  };
  const getProfileDisplayName = (telegramId) => {
    const profile = sellerProfiles.get(String(telegramId));
    return [profile?.profile_first_name || profile?.telegram_first_name, profile?.profile_last_name || profile?.telegram_last_name]
      .filter(Boolean)
      .join(' ') || profile?.nickname || `ID ${telegramId}`;
  };
  const clearMarketAnimation = () => {
    marketAnimationRequest++;
    marketAnimations.forEach((animation) => animation.destroy());
    marketAnimations = [];
    activeMarketGiftAnimation = null;
    marketDialogAnimation.replaceChildren();
    marketDialogAnimation.hidden = true;
    marketDialogAnimation.classList.remove('is-ready');
    marketDialogBackdrop.replaceChildren();
    marketDialogBackdrop.hidden = true;
    marketDialogBackdrop.classList.remove('is-ready');
    marketDialogArt.classList.remove('is-ready');
    marketDialogImage.hidden = true;
  };
  const getMarketAnimationData = async (gift) => {
    const response = await fetch(`https://nft.fragment.com/gift/${encodeURIComponent(gift.slug)}-${encodeURIComponent(gift.id)}.tgs`, { cache: 'no-store' });
    if (!response.ok || typeof DecompressionStream === 'undefined') throw new Error('NFT animation is unavailable.');
    return new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).json();
  };
  const getMarketGiftOverlay = (animationData) => {
    const overlay = structuredClone(animationData);
    const giftLayer = overlay.layers.find((layer) => layer.nm === 'Gift');
    if (!giftLayer) return overlay;
    const scaleData = giftLayer.ks?.s?.k;
    const shrink = (values) => {
      if (Array.isArray(values) && values.length >= 2) {
        values[0] *= 0.7;
        values[1] *= 0.7;
      }
    };
    if (Array.isArray(scaleData)) {
      if (typeof scaleData[0] === 'number') shrink(scaleData);
      else scaleData.forEach((keyframe) => { shrink(keyframe.s); shrink(keyframe.e); });
    }
    overlay.layers = [giftLayer];
    return overlay;
  };
  const loadMarketAnimation = async (gift, title) => {
    const requestId = marketAnimationRequest;
    marketDialogAnimation.hidden = false;
    try {
      const animationData = await getMarketAnimationData(gift);
      if (requestId !== marketAnimationRequest || !marketListingDialog.open || !window.lottie) return;
      const backdropData = structuredClone(animationData);
      backdropData.layers = backdropData.layers.filter((layer) => layer.nm !== 'Gift');
      let loadedLayers = 0;
      const reveal = () => {
        if (++loadedLayers !== 2 || requestId !== marketAnimationRequest) return;
        marketDialogBackdrop.classList.add('is-ready');
        marketDialogAnimation.classList.add('is-ready');
        marketDialogArt.classList.add('is-ready');
        marketDialogArt.classList.remove('is-preview');
        marketDialogImage.hidden = true;
      };
      marketDialogBackdrop.hidden = false;
      const backdropAnimation = window.lottie.loadAnimation({
        container: marketDialogBackdrop,
        renderer: 'svg',
        loop: false,
        autoplay: false,
        animationData: backdropData
      });
      marketAnimations.push(backdropAnimation);
      backdropAnimation.goToAndStop(0, true);
      backdropAnimation.addEventListener('DOMLoaded', () => {
        if (requestId !== marketAnimationRequest) return;
        marketDialogBackdrop.querySelector('svg')?.setAttribute('preserveAspectRatio', 'xMidYMid slice');
        backdropAnimation.goToAndStop(0, true);
        reveal();
      });

      marketDialogAnimation.replaceChildren();
      const giftAnimation = window.lottie.loadAnimation({
        container: marketDialogAnimation,
        renderer: 'svg',
        loop: false,
        autoplay: true,
        animationData: getMarketGiftOverlay(animationData)
      });
      marketAnimations.push(giftAnimation);
      activeMarketGiftAnimation = giftAnimation;
      giftAnimation.addEventListener('DOMLoaded', () => {
        if (requestId !== marketAnimationRequest) return;
        marketDialogAnimation.querySelector('svg')?.setAttribute('preserveAspectRatio', 'xMidYMid slice');
        reveal();
      });
    } catch {
      if (requestId === marketAnimationRequest) {
        marketDialogImage.src = `https://nft.fragment.com/gift/${encodeURIComponent(gift.slug)}-${encodeURIComponent(gift.id)}.webp`;
        marketDialogImage.alt = title;
        marketDialogImage.hidden = false;
        marketDialogArt.classList.add('is-ready');
      }
    }
  };
  const moveIndicator = (button) => {
    if (!button || !marketTradeIndicator) return;
    const buttonBounds = button.getBoundingClientRect();
    const navBounds = marketTradeNav.getBoundingClientRect();
    marketTradeIndicator.style.left = `${buttonBounds.left - navBounds.left - marketTradeNav.clientLeft}px`;
    marketTradeIndicator.style.setProperty('--market-indicator-width', `${buttonBounds.width}px`);
  };

  const createListingCard = (listing) => {
    const gift = listing.nft_data;
    const title = `${gift.name} #${gift.id}`;
    const card = document.createElement('article');
    card.className = 'market-card market-listing-card';
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `Открыть ${title}, цена ${formatStars(listing.price)} звёзд`);
    card.dataset.marketName = `${title} ${gift.slug}`.toLocaleLowerCase('ru-RU');
    card.dataset.marketCollection = gift.name;
    card.dataset.marketPrice = String(listing.price);

    const imageFrame = document.createElement('div');
    imageFrame.className = 'market-card-image-frame';
    const image = document.createElement('img');
    image.className = 'market-card-image';
    image.src = `https://nft.fragment.com/gift/${encodeURIComponent(gift.slug)}-${encodeURIComponent(gift.id)}.webp`;
    image.alt = title;
    image.loading = 'lazy';
    image.onerror = () => { image.hidden = true; };
    imageFrame.append(image);

    const content = document.createElement('div');
    content.className = 'market-card-content';
    const heading = document.createElement('div');
    heading.className = 'market-card-heading';
    const name = document.createElement('h2');
    name.className = 'market-card-name';
    name.textContent = title;
    heading.append(name);

    const price = document.createElement('div');
    price.className = 'market-card-price';
    const label = document.createElement('span');
    label.className = 'market-card-price-label';
    label.textContent = 'Цена';
    const value = document.createElement('span');
    value.className = 'market-card-price-value';
    value.textContent = formatStars(listing.price);
    const icon = document.createElement('img');
    icon.src = marketCurrency;
    icon.alt = '';
    icon.setAttribute('aria-hidden', 'true');
    price.append(label, value, icon);

    content.append(heading, price);
    card.append(imageFrame, content);
    card.addEventListener('pointerdown', () => card.classList.add('is-pointer-activated'));
    card.addEventListener('blur', () => card.classList.remove('is-pointer-activated'));
    card.addEventListener('click', () => openListingDetails(listing));
    card.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      openListingDetails(listing);
    });
    return card;
  };

  const openListingDetails = (listing) => {
    const gift = listing.nft_data;
    const title = `${gift.name} #${gift.id}`;
    const seller = sellerProfiles.get(String(listing.seller_telegram_id));
    const sellerName = getProfileDisplayName(listing.seller_telegram_id);
    const sellerProfileUrl = `profile.html?user=${encodeURIComponent(listing.seller_telegram_id)}`;
    const chatUrl = `chats.html?user=${encodeURIComponent(listing.seller_telegram_id)}`;

    clearMarketAnimation();
    marketDialogImage.alt = title;
    marketDialogImage.hidden = true;
    marketDialogTitle.textContent = title;
    marketDialogModel.textContent = gift.name;
    marketDialogStatus.hidden = true;
    marketDialogOwnerFallback.textContent = sellerName.split(/\s+/).filter(Boolean).map((part) => [...part][0]).slice(0, 2).join('').toLocaleUpperCase('ru-RU') || 'V';
    marketDialogOwnerAvatarLink.href = sellerProfileUrl;
    if (seller?.photo_url) {
      marketDialogOwnerAvatar.src = seller.photo_url;
      marketDialogOwnerAvatar.hidden = false;
      marketDialogOwnerFallback.hidden = true;
    } else {
      marketDialogOwnerAvatar.removeAttribute('src');
      marketDialogOwnerAvatar.hidden = true;
      marketDialogOwnerFallback.hidden = false;
    }
    marketDialogOwnerLink.textContent = sellerName;
    marketDialogOwnerLink.href = sellerProfileUrl;
    marketDialogMessage.hidden = false;
    marketDialogMessage.href = chatUrl;

    const amount = document.createElement('span');
    amount.textContent = formatStars(listing.price);
    const currency = document.createElement('img');
    currency.src = marketCurrency;
    currency.alt = '';
    currency.setAttribute('aria-hidden', 'true');
    marketDialogPrice.replaceChildren(amount, currency);

    const isOwnListing = String(listing.seller_telegram_id) === String(marketTelegramUser?.id);
    if (listing.status !== 'active') {
      marketDialogAction.textContent = 'КУПЛЕНО';
      marketDialogAction.disabled = true;
      marketDialogAction.onclick = null;
    } else if (isOwnListing) {
      marketDialogAction.textContent = 'СНЯТЬ С ПРОДАЖИ';
      marketDialogAction.disabled = isProcessingListing;
      marketDialogAction.onclick = () => cancelListing(listing);
    } else {
      marketDialogAction.textContent = 'КУПИТЬ';
      marketDialogAction.disabled = !marketTelegramUser || isProcessingListing;
      marketDialogAction.onclick = () => buyListing(listing);
    }
    marketListingDialog.showModal();
    loadMarketAnimation(gift, title);
  };

  marketDialogAnimation.addEventListener('click', (event) => {
    const target = event.target;
    const svg = target instanceof Element ? target.closest('svg') : null;
    if (svg && target !== svg) activeMarketGiftAnimation?.goToAndPlay(0, true);
  });

  const renderListings = () => {
    const query = marketSearch.value.trim().toLocaleLowerCase('ru-RU');
    const selectedCollection = marketCollectionFilter.value;
    let visibleListings = listings.filter((listing) => {
      const isOwnListing = String(listing.seller_telegram_id) === String(marketTelegramUser?.id);
      const isPurchased = listing.status === 'sold'
        && String(listing.buyer_telegram_id) === String(marketTelegramUser?.id);
      const matchesMode = marketMode === 'all'
        ? listing.status === 'active'
        : marketMode === 'sales'
          ? listing.status === 'active' && isOwnListing
          : isPurchased;
      const searchText = `${listing.nft_data.name} ${listing.nft_data.id} ${listing.nft_data.slug} ${getProfileName(listing.seller_telegram_id)}`
        .toLocaleLowerCase('ru-RU');
      return matchesMode
        && (!selectedCollection || listing.nft_data.name === selectedCollection)
        && (!query || searchText.includes(query));
    });

    if (marketSort.value === 'price-asc' || marketSort.value === 'price-desc') {
      const direction = marketSort.value === 'price-asc' ? 1 : -1;
      visibleListings.sort((left, right) => (left.price - right.price) * direction);
    } else {
      visibleListings.sort((left, right) => left.nft_data.name.localeCompare(right.nft_data.name, 'ru'));
    }

    marketGrid.replaceChildren(...visibleListings.map(createListingCard));
    marketEmpty.textContent = marketMode === 'sales'
      ? 'У вас пока нет объявлений о продаже'
      : marketMode === 'purchases'
        ? 'Покупок пока нет'
        : 'На рынке пока нет объявлений';
    marketEmpty.hidden = visibleListings.length > 0;
  };

  const loadListings = async () => {
    marketEmpty.textContent = 'Загрузка объявлений…';
    marketEmpty.hidden = false;
    marketGrid.replaceChildren();
    const { data, error } = await marketSupabase
      .from('nft_listings')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) {
      marketEmpty.textContent = 'Не удалось загрузить объявления. Проверьте marketplace.sql в Supabase.';
      setFeedback(error.message, true);
      return;
    }

    listings = data || [];
    const profileIds = [...new Set(listings.flatMap((listing) => [listing.seller_telegram_id, listing.buyer_telegram_id]).filter(Boolean).map(String))];
    if (profileIds.length) {
      const { data: profiles, error: profilesError } = await marketSupabase
        .from('telegram_profiles')
        .select('telegram_id, telegram_username, telegram_first_name, telegram_last_name, profile_first_name, profile_last_name, photo_url')
        .in('telegram_id', profileIds);
      if (!profilesError) sellerProfiles = new Map((profiles || []).map((profile) => [String(profile.telegram_id), profile]));
    }
    setFeedback('');
    renderListings();
  };

  const refreshCurrentProfile = async () => {
    if (!marketTelegramUser) return;
    const { data, error } = await marketSupabase
      .from('telegram_profiles')
      .select('*')
      .eq('telegram_id', marketTelegramUser.id)
      .single();
    if (error) throw error;
    document.dispatchEvent(new CustomEvent('vyrn:supabase-profile-loaded', { detail: data }));
  };

  const buyListing = async (listing) => {
    if (!marketTelegramUser || isProcessingListing) return;
    isProcessingListing = true;
    marketDialogAction.disabled = true;
    marketDialogStatus.textContent = 'Покупаем NFT…';
    marketDialogStatus.hidden = false;
    setFeedback('Покупаем NFT…');
    renderListings();
    try {
      const { data, error } = await marketSupabase.rpc('buy_nft_listing', {
        p_listing_id: listing.id,
        p_buyer_telegram_id: marketTelegramUser.id
      });
      if (error) throw error;
      if (!data || String(data.buyer_telegram_id) !== String(marketTelegramUser.id)) {
        throw new Error('Supabase не подтвердил покупку. Обновите страницу и проверьте баланс.');
      }
      await refreshCurrentProfile();
      await loadListings();
      marketListingDialog.close();
    } catch (error) {
      setFeedback(error.message || 'Не удалось купить NFT.', true);
      marketDialogStatus.textContent = error.message || 'Не удалось купить NFT.';
      marketDialogStatus.hidden = false;
      marketDialogAction.disabled = false;
      isProcessingListing = false;
      renderListings();
      return;
    }
    isProcessingListing = false;
    renderListings();
  };

  const cancelListing = async (listing) => {
    if (!marketTelegramUser || isProcessingListing) return;
    isProcessingListing = true;
    marketDialogAction.disabled = true;
    marketDialogStatus.textContent = 'Снимаем объявление…';
    marketDialogStatus.hidden = false;
    setFeedback('Снимаем объявление…');
    renderListings();
    try {
      const { data, error } = await marketSupabase.rpc('cancel_nft_listing', {
        p_listing_id: listing.id,
        p_seller_telegram_id: marketTelegramUser.id
      });
      if (error) throw error;
      if (!data || String(data.seller_telegram_id) !== String(marketTelegramUser.id)) {
        throw new Error('Supabase не подтвердил снятие объявления.');
      }
      await refreshCurrentProfile();
      await loadListings();
      marketListingDialog.close();
      setFeedback('Объявление снято, NFT возвращён в коллекцию.');
    } catch (error) {
      setFeedback(error.message || 'Не удалось снять объявление.', true);
      marketDialogStatus.textContent = error.message || 'Не удалось снять объявление.';
      marketDialogStatus.hidden = false;
      marketDialogAction.disabled = false;
      isProcessingListing = false;
      renderListings();
      return;
    }
    isProcessingListing = false;
    renderListings();
  };

  marketSearch.addEventListener('input', renderListings);
  marketListingDialog.querySelector('.market-listing-dialog-close').addEventListener('click', () => marketListingDialog.close());
  marketListingDialog.addEventListener('click', (event) => {
    if (event.target === marketListingDialog) marketListingDialog.close();
  });
  marketListingDialog.addEventListener('close', clearMarketAnimation);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && marketListingDialog.open) marketListingDialog.close();
  });
  marketCollectionFilter.addEventListener('change', renderListings);
  marketSort.addEventListener('change', renderListings);
  marketTradeButtons.forEach((button) => {
    button.addEventListener('click', () => {
      marketMode = button.dataset.marketMode;
      marketTradeButtons.forEach((item) => {
        const active = item === button;
        item.classList.toggle('is-active', active);
        item.setAttribute('aria-pressed', String(active));
      });
      moveIndicator(button);
      setFeedback('');
      renderListings();
    });
  });
  window.addEventListener('resize', () => moveIndicator(marketTradeButtons.find((button) => button.classList.contains('is-active'))));

  loadListings();
} else if (marketRoot && marketEmpty) {
  marketEmpty.textContent = 'Не удалось подключиться к Supabase.';
  marketEmpty.hidden = false;
}
