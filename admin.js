const config = window.VYRN_SUPABASE_CONFIG;
const catalog = Array.isArray(window.VYRN_NFT_CATALOG) ? window.VYRN_NFT_CATALOG : [];
const adminSupabase = window.supabase && config
  ? window.supabase.createClient(config.url, config.publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    })
  : null;

const connection = document.querySelector('#admin-connection');
const searchForm = document.querySelector('#user-search-form');
const searchInput = document.querySelector('#user-search');
const searchFeedback = document.querySelector('#search-feedback');
const userResults = document.querySelector('#user-results');
const noUserState = document.querySelector('#no-user-state');
const selectedUser = document.querySelector('#selected-user');
const selectedUserAvatar = document.querySelector('#selected-user-avatar');
const selectedUserName = document.querySelector('#selected-user-name');
const selectedUserHandle = document.querySelector('#selected-user-handle');
const selectedUserId = document.querySelector('#selected-user-id');
const currentBalance = document.querySelector('#current-balance');
const balanceForm = document.querySelector('#balance-form');
const balanceAmount = document.querySelector('#balance-amount');
const inventoryCount = document.querySelector('#inventory-count');
const inventoryList = document.querySelector('#inventory-list');
const inventoryEmpty = document.querySelector('#inventory-empty');
const catalogSearch = document.querySelector('#catalog-search');
const giftCatalog = document.querySelector('#gift-catalog');
const catalogCount = document.querySelector('#catalog-count');
const catalogEmpty = document.querySelector('#catalog-empty');
const toast = document.querySelector('#admin-toast');

let activeProfile = null;
let toastTimer;
let isSaving = false;

const formatNumber = (value) => Number(value || 0).toLocaleString('ru-RU');
const getDisplayName = (profile) => [profile.profile_first_name || profile.telegram_first_name, profile.profile_last_name || profile.telegram_last_name]
  .filter(Boolean)
  .join(' ') || profile.nickname || `ID ${profile.telegram_id}`;

const showToast = (message, type = 'success') => {
  toast.textContent = message;
  toast.dataset.type = type;
  toast.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => { toast.hidden = true; }, 3200);
};

const setFeedback = (message = '') => {
  searchFeedback.textContent = message;
  searchFeedback.hidden = !message;
};

const setBusy = (busy) => {
  isSaving = busy;
  document.querySelectorAll('.balance-controls button, .gift-issue, .inventory-remove').forEach((button) => {
    button.disabled = busy || (button.classList.contains('gift-issue') && !activeProfile);
  });
};

const updateConnection = (state, message) => {
  connection.dataset.state = state;
  connection.lastChild.textContent = message;
};

const createUserResult = (profile) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `user-result${String(activeProfile?.telegram_id) === String(profile.telegram_id) ? ' is-selected' : ''}`;
  const name = document.createElement('strong');
  name.textContent = getDisplayName(profile);
  const balance = document.createElement('span');
  balance.textContent = `${formatNumber(profile.stars_balance)} ★`;
  const identity = document.createElement('small');
  identity.textContent = `@${profile.telegram_username || profile.nickname || 'без ника'} · ID ${profile.telegram_id}`;
  button.append(name, balance, identity);
  button.addEventListener('click', () => selectProfile(profile));
  return button;
};

const renderSearchResults = (profiles) => {
  userResults.replaceChildren();
  if (!profiles.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-note';
    empty.textContent = 'Пользователи не найдены';
    userResults.append(empty);
    return;
  }
  userResults.append(...profiles.map(createUserResult));
};

const renderInventory = () => {
  if (!activeProfile) return;
  const nfts = Array.isArray(activeProfile.nfts) ? activeProfile.nfts : [];
  inventoryCount.textContent = `${nfts.length} NFT`;
  inventoryList.replaceChildren();
  inventoryEmpty.hidden = nfts.length > 0;

  nfts.forEach((gift, index) => {
    const item = document.createElement('div');
    item.className = 'inventory-item';
    const image = document.createElement('img');
    image.src = `https://nft.fragment.com/gift/${encodeURIComponent(gift.slug)}-${encodeURIComponent(gift.id)}.webp`;
    image.alt = '';
    image.loading = 'lazy';
    image.onerror = () => { image.hidden = true; };
    const copy = document.createElement('span');
    copy.className = 'inventory-item-copy';
    const title = document.createElement('strong');
    title.textContent = gift.name || gift.slug;
    const number = document.createElement('span');
    number.textContent = `#${gift.id}`;
    copy.append(title, number);
    const remove = document.createElement('button');
    remove.className = 'inventory-remove';
    remove.type = 'button';
    remove.setAttribute('aria-label', `Убрать ${gift.name || gift.slug} #${gift.id}`);
    remove.title = 'Убрать подарок';
    remove.textContent = '×';
    remove.addEventListener('click', () => changeInventory(index, null));
    item.append(image, copy, remove);
    inventoryList.append(item);
  });
};

const renderSelectedProfile = () => {
  if (!activeProfile) return;
  selectedUserName.textContent = getDisplayName(activeProfile);
  selectedUserHandle.textContent = `@${activeProfile.telegram_username || activeProfile.nickname || 'без ника'}`;
  selectedUserId.textContent = String(activeProfile.telegram_id);
  currentBalance.textContent = formatNumber(activeProfile.stars_balance);
  const initials = getDisplayName(activeProfile).split(/\s+/).filter(Boolean).slice(0, 2).map((part) => [...part][0]).join('').toLocaleUpperCase('ru-RU');
  selectedUserAvatar.replaceChildren();
  selectedUserAvatar.textContent = initials || 'V';
  if (activeProfile.photo_url) {
    const image = document.createElement('img');
    image.src = activeProfile.photo_url;
    image.alt = '';
    image.onerror = () => { image.remove(); };
    selectedUserAvatar.replaceChildren(image);
  }
  noUserState.hidden = true;
  selectedUser.hidden = false;
  renderInventory();
};

const selectProfile = (profile) => {
  activeProfile = profile;
  renderSelectedProfile();
  renderSearchResults(lastSearchResults);
  renderGiftCatalog();
};

let allProfiles = [];
let lastSearchResults = [];

const sortProfiles = (profiles) => profiles.sort((left, right) =>
  getDisplayName(left).localeCompare(getDisplayName(right), 'ru', { sensitivity: 'base' }));

const loadUsers = async () => {
  if (!adminSupabase) {
    setFeedback('Не удалось подключить Supabase. Проверьте загрузку SDK и конфигурацию.');
    return;
  }

  userResults.replaceChildren();
  const loading = document.createElement('p');
  loading.className = 'empty-note';
  loading.textContent = 'Загружаем пользователей…';
  userResults.append(loading);

  const pageSize = 500;
  const profiles = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await adminSupabase
      .from('telegram_profiles')
      .select('*')
      .range(offset, offset + pageSize - 1);
    if (error) {
      renderSearchResults([]);
      setFeedback(error.message || 'Не удалось загрузить пользователей.');
      return;
    }
    profiles.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }

  allProfiles = sortProfiles(profiles);
  lastSearchResults = allProfiles;
  setFeedback('');
  renderSearchResults(lastSearchResults);
};

const searchProfiles = async (event) => {
  event?.preventDefault();
  if (!adminSupabase) {
    setFeedback('Не удалось подключить Supabase. Проверьте загрузку SDK и конфигурацию.');
    return;
  }
  const query = searchInput.value.trim();
  const safeQuery = query.replace(/[%,_()[\]{}]/g, '').trim();
  if (!safeQuery) {
    setFeedback('');
    lastSearchResults = allProfiles;
    renderSearchResults(lastSearchResults);
    return;
  }

  setFeedback('');
  userResults.replaceChildren();
  const loading = document.createElement('p');
  loading.className = 'empty-note';
  loading.textContent = 'Ищем…';
  userResults.append(loading);
  const columns = ['nickname', 'telegram_username', 'telegram_first_name', 'profile_first_name'];
  const requests = columns.map((column) => adminSupabase
    .from('telegram_profiles')
    .select('*')
    .ilike(column, `%${safeQuery}%`)
    .limit(12));
  if (/^\d+$/.test(safeQuery) && Number.isSafeInteger(Number(safeQuery))) {
    requests.unshift(adminSupabase.from('telegram_profiles').select('*').eq('telegram_id', Number(safeQuery)).limit(12));
  }

  const results = await Promise.all(requests);
  const failed = results.find(({ error }) => error);
  if (failed) {
    lastSearchResults = [];
    renderSearchResults([]);
    setFeedback(failed.error.message || 'Ошибка поиска в Supabase.');
    return;
  }
  const unique = new Map();
  results.flatMap(({ data }) => data || []).forEach((profile) => unique.set(String(profile.telegram_id), profile));
  lastSearchResults = sortProfiles([...unique.values()]);
  renderSearchResults(lastSearchResults);
  if (!lastSearchResults.length) setFeedback('Пользователи не найдены.');
};

searchInput.addEventListener('input', () => {
  if (searchInput.value.trim()) return;
  setFeedback('');
  lastSearchResults = allProfiles;
  renderSearchResults(lastSearchResults);
});

const saveProfileUpdate = async (updates, successMessage) => {
  if (!activeProfile || !adminSupabase || isSaving) return;
  const targetTelegramId = activeProfile.telegram_id;
  setBusy(true);
  try {
    const { data, error } = await adminSupabase
      .from('telegram_profiles')
      .update(updates)
      .eq('telegram_id', targetTelegramId)
      .select('*')
      .single();
    if (error) throw error;
    if (!data || String(data.telegram_id) !== String(targetTelegramId)) {
      throw new Error('Supabase не вернул обновлённый профиль. Проверьте политику UPDATE и SQL-схему.');
    }
    activeProfile = data;
    allProfiles = allProfiles.map((profile) => String(profile.telegram_id) === String(data.telegram_id) ? data : profile);
    lastSearchResults = lastSearchResults.map((profile) => String(profile.telegram_id) === String(data.telegram_id) ? data : profile);
    renderSelectedProfile();
    renderSearchResults(lastSearchResults);
    renderGiftCatalog();
    showToast(successMessage);
  } catch (error) {
    showToast(error.message || 'Не удалось сохранить изменения.', 'error');
  } finally {
    setBusy(false);
    renderInventory();
  }
};

const changeInventory = (index, gift) => {
  if (!activeProfile) return;
  const nfts = [...(Array.isArray(activeProfile.nfts) ? activeProfile.nfts : [])];
  if (gift) {
    nfts.push({ ...gift, issuedAt: new Date().toISOString() });
  } else {
    nfts.splice(index, 1);
  }
  const updates = { nfts, updated_at: new Date().toISOString() };
  saveProfileUpdate(updates, gift ? `Выдано: ${gift.name} #${gift.id}` : 'Подарок убран из коллекции.');
};

const renderGiftCatalog = () => {
  const query = catalogSearch.value.trim().toLocaleLowerCase('ru-RU');
  const gifts = catalog.filter((gift) => `${gift.name} ${gift.id} ${gift.slug}`.toLocaleLowerCase('ru-RU').includes(query));
  catalogCount.textContent = String(gifts.length);
  giftCatalog.replaceChildren();
  catalogEmpty.hidden = gifts.length > 0;

  gifts.forEach((gift) => {
    const card = document.createElement('article');
    card.className = 'catalog-gift';
    const image = document.createElement('img');
    image.className = 'catalog-gift-image';
    image.src = `https://nft.fragment.com/gift/${gift.slug}-${gift.id}.webp`;
    image.alt = '';
    image.loading = 'lazy';
    image.onerror = () => { image.hidden = true; };
    const info = document.createElement('div');
    info.className = 'catalog-gift-info';
    const name = document.createElement('strong');
    name.textContent = gift.name;
    const id = document.createElement('span');
    id.textContent = `#${gift.id}`;
    info.append(name, id);
    const issue = document.createElement('button');
    issue.className = 'gift-issue';
    issue.type = 'button';
    const isOwned = activeProfile?.nfts?.some((item) => item.slug === gift.slug && Number(item.id) === Number(gift.id)) || false;
    issue.textContent = isOwned ? 'Выдать ещё' : 'Выдать';
    issue.disabled = !activeProfile || isSaving;
    issue.addEventListener('click', () => changeInventory(-1, gift));
    card.append(image, info, issue);
    giftCatalog.append(card);
  });
};

searchForm.addEventListener('submit', searchProfiles);
catalogSearch.addEventListener('input', renderGiftCatalog);
balanceForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!activeProfile || isSaving) return;
  const amount = Number(balanceAmount.value);
  const action = event.submitter?.dataset.balanceAction;
  if (!Number.isSafeInteger(amount) || amount < 1) {
    showToast('Введите целое количество звёзд.', 'error');
    return;
  }
  const current = Number(activeProfile.stars_balance) || 0;
  if (action === 'subtract' && amount > current) {
    showToast('Нельзя списать больше текущего баланса.', 'error');
    return;
  }
  const nextBalance = action === 'subtract' ? current - amount : current + amount;
  saveProfileUpdate({ stars_balance: nextBalance, updated_at: new Date().toISOString() }, action === 'subtract' ? `Списано ${formatNumber(amount)} звёзд.` : `Начислено ${formatNumber(amount)} звёзд.`);
  balanceForm.reset();
});

if (!adminSupabase) {
  updateConnection('error', 'Нет подключения');
  setFeedback('Проверьте подключение SDK и конфигурацию Supabase.');
} else {
  updateConnection('connected', 'Supabase');
}
renderGiftCatalog();
loadUsers();
