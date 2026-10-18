const navItems = [...document.querySelectorAll('.nav-button')];
const keyboardFocusKeys = new Set(['Tab', 'ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown', 'Enter', ' ']);
document.addEventListener('pointerdown', () => {
	document.documentElement.classList.add('has-pointer-focus');
}, true);
document.addEventListener('keydown', (event) => {
	if (keyboardFocusKeys.has(event.key)) {
		document.documentElement.classList.remove('has-pointer-focus');
	}
}, true);

const navButtons = navItems.filter((item) => item.tagName === 'BUTTON');
const bottomNav = document.querySelector('.bottom-nav');
const navIndicator = document.querySelector('.nav-indicator');
let activeItem = document.querySelector('.nav-button.is-active');
const telegramWebApp = window.Telegram?.WebApp;
const telegramUserStorageKey = 'vyrn.telegram.user.v1';
const supabaseConfig = window.VYRN_SUPABASE_CONFIG;
const supabaseClient = window.supabase?.createClient(supabaseConfig?.url, supabaseConfig?.publishableKey, {
	auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
}) ?? null;
window.VYRN_SUPABASE_CLIENT = supabaseClient;
const getTelegramUser = () => {
	let telegramUser = telegramWebApp?.initDataUnsafe?.user;
	if (!telegramUser) {
		try {
			const userData = new URLSearchParams(telegramWebApp?.initData || '').get('user');
			telegramUser = userData ? JSON.parse(userData) : null;
		} catch {
			telegramUser = null;
		}
	}
	if (telegramUser) {
		try {
			sessionStorage.setItem(telegramUserStorageKey, JSON.stringify(telegramUser));
		} catch {
		}
		return telegramUser;
	}
	try {
		const storedUser = JSON.parse(sessionStorage.getItem(telegramUserStorageKey) || 'null');
		return storedUser && typeof storedUser.first_name === 'string' ? storedUser : null;
	} catch {
		return null;
	}
};
telegramWebApp?.ready();
const telegramUser = getTelegramUser();
const localUserStorageKey = 'vyrn.local.user.v1';
const getOrCreateLocalUser = () => {
	let localUser = null;
	try {
		localUser = JSON.parse(localStorage.getItem(localUserStorageKey) || 'null');
	} catch {
	}
	if (Number.isSafeInteger(localUser?.id) && localUser.id > 0) return localUser;
	const id = 8000000000000000 + Math.floor(Math.random() * 1000000000);
	localUser = { id, first_name: 'Локальный аккаунт', username: `local_${id}` };
	try {
		localStorage.setItem(localUserStorageKey, JSON.stringify(localUser));
	} catch {
	}
	return localUser;
};
const currentUser = telegramUser || getOrCreateLocalUser();
const isLocalAccount = !telegramUser;
const requestedProfileId = Number(new URLSearchParams(window.location.search).get('user'));
const profileOwnerId = Number.isSafeInteger(requestedProfileId) && requestedProfileId > 0 ? requestedProfileId : currentUser.id;
const isViewingOtherProfile = String(profileOwnerId) !== String(currentUser.id);
window.VYRN_CURRENT_USER = currentUser;
const balanceStorageKey = `vyrn.stars.balance.v1.${currentUser.id}`;
const getCachedStarsBalance = () => {
	try {
		const cachedBalance = localStorage.getItem(balanceStorageKey);
		if (cachedBalance === null) return null;
		const balance = Number(cachedBalance);
		return Number.isSafeInteger(balance) && balance >= 0 ? balance : null;
	} catch {
		return null;
	}
};
const renderAccountBalance = (balance) => {
	const formattedBalance = balance.toLocaleString('ru-RU');
	document.querySelectorAll('.star-balance').forEach((element) => {
		const value = element.querySelector('span');
		if (value) value.textContent = formattedBalance;
		element.setAttribute('aria-label', `Баланс: ${formattedBalance} звёзд`);
	});
	const walletBalance = document.querySelector('[data-wallet-balance]');
	if (walletBalance) walletBalance.textContent = formattedBalance;
};
let cachedStarsBalance = getCachedStarsBalance();
if (cachedStarsBalance === null) {
	document.querySelectorAll('.star-balance').forEach((element) => {
		const value = element.querySelector('span');
		if (value) value.textContent = '…';
		element.setAttribute('aria-label', 'Баланс загружается');
	});
	const walletBalance = document.querySelector('[data-wallet-balance]');
	if (walletBalance) walletBalance.textContent = '…';
} else {
	renderAccountBalance(cachedStarsBalance);
}
document.addEventListener('vyrn:supabase-profile-loaded', (event) => {
	if (String(event.detail?.telegram_id) !== String(currentUser.id)) return;
	const balance = Number(event.detail?.stars_balance);
	if (!Number.isSafeInteger(balance) || balance < 0) return;
	cachedStarsBalance = balance;
	try {
		localStorage.setItem(balanceStorageKey, String(balance));
	} catch {
	}
	renderAccountBalance(balance);
});
let storedProfile = null;
if (isLocalAccount) {
	try {
		storedProfile = JSON.parse(localStorage.getItem('vyrn.profile.editor.v1') || 'null');
	} catch {
	}
}
let supabaseAccountProfile = null;
const profileDataFromSupabase = (profile) => ({
	firstName: profile.profile_first_name || profile.telegram_first_name || '',
	lastName: profile.profile_last_name ?? profile.telegram_last_name ?? '',
	about: profile.about || '',
	username: profile.nickname ? `@${profile.nickname}` : '',
	birthday: profile.birthday || '',
	phone: profile.phone || '',
	avatar: profile.photo_url || ''
});
const publicProfilePage = document.querySelector('.profile-page:not(.player-profile-page)');
if (publicProfilePage && isViewingOtherProfile) {
	publicProfilePage.classList.add('is-public-profile');
	const editButton = publicProfilePage.querySelector('.profile-edit-button');
	const actions = publicProfilePage.querySelector('.public-profile-actions');
	const messageAction = actions?.querySelector('[data-public-action="message"]');
	const nameElement = publicProfilePage.querySelector('.profile-name');
	const detailValues = [...publicProfilePage.querySelectorAll('.profile-detail-value')];
	const avatarImage = publicProfilePage.querySelector('.profile-avatar-image');
	const phoneRow = publicProfilePage.querySelector('.public-profile-phone-row');
	const phoneValue = publicProfilePage.querySelector('.public-profile-phone');
	const birthdayRow = publicProfilePage.querySelector('.public-profile-birthday-row');
	const birthdayValue = publicProfilePage.querySelector('.public-profile-birthday');
	if (editButton) editButton.hidden = true;
	if (actions) actions.hidden = false;
	const renderPublicProfile = (profile) => {
		if (String(profile?.telegram_id) !== String(profileOwnerId)) return;
		const profileData = profileDataFromSupabase(profile);
		nameElement.textContent = [profileData.firstName, profileData.lastName].filter(Boolean).join(' ');
		if (detailValues[0]) detailValues[0].textContent = profileData.username;
		if (detailValues[1]) detailValues[1].textContent = profileData.about;
		const phone = profileData.phone.trim();
		phoneRow.hidden = !phone;
		phoneValue.textContent = phone;
		const birthday = profileData.birthday;
		birthdayRow.hidden = !birthday;
		birthdayValue.textContent = birthday
			? new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
				.format(new Date(`${birthday}T00:00:00`)).replace(/\.$/, '')
			: '';
		if (messageAction) {
			messageAction.hidden = false;
			messageAction.href = `chats.html?user=${encodeURIComponent(profileOwnerId)}`;
		}
		if (profileData.avatar) {
			avatarImage.src = profileData.avatar;
			avatarImage.hidden = false;
		} else {
			avatarImage.removeAttribute('src');
			avatarImage.hidden = true;
		}
	};
	document.addEventListener('vyrn:supabase-profile-loaded', (event) => renderPublicProfile(event.detail));
	if (supabaseClient) {
		supabaseClient.from('telegram_profiles').select('*').eq('telegram_id', profileOwnerId).single()
			.then(({ data, error }) => {
				if (error) throw error;
				document.dispatchEvent(new CustomEvent('vyrn:supabase-profile-loaded', { detail: data }));
			})
			.catch((error) => document.dispatchEvent(new CustomEvent('vyrn:supabase-profile-load-failed', { detail: error })));
	}
}
const syncSupabaseProfile = async (profileData) => {
	if (!supabaseClient || !currentUser) {
		throw new Error('Supabase client or account is unavailable.');
	}
	const telegramProfile = {
		telegram_id: currentUser.id,
		telegram_username: currentUser.username || null,
		telegram_first_name: currentUser.first_name,
		telegram_last_name: currentUser.last_name || '',
		language_code: currentUser.language_code || null,
		is_premium: currentUser.is_premium === true,
		photo_url: currentUser.photo_url || null,
		nickname: currentUser.username || currentUser.first_name,
		profile_first_name: currentUser.first_name,
		profile_last_name: currentUser.last_name || ''
	};
	const { error: insertError } = await supabaseClient
		.from('telegram_profiles')
		.upsert(telegramProfile, { onConflict: 'telegram_id', ignoreDuplicates: true });
	if (insertError) throw insertError;

	if (profileData) {
		const nickname = profileData.username.replace(/^@+/, '') || currentUser.username || currentUser.first_name;
		const { error: updateError } = await supabaseClient
			.from('telegram_profiles')
			.update({
				nickname,
				profile_first_name: profileData.firstName,
				profile_last_name: profileData.lastName,
				about: profileData.about,
				birthday: profileData.birthday || null,
				phone: profileData.phone
			})
			.eq('telegram_id', currentUser.id);
		if (updateError) throw updateError;
	}
	const { data: profile, error: selectError } = await supabaseClient
		.from('telegram_profiles')
		.select('*')
		.eq('telegram_id', currentUser.id)
		.single();
	if (selectError) throw selectError;
	supabaseAccountProfile = profile;
	const balance = Number(profile.stars_balance);
	if (Number.isSafeInteger(balance) && balance >= 0) {
		cachedStarsBalance = balance;
		try {
			localStorage.setItem(balanceStorageKey, String(balance));
		} catch {
		}
		renderAccountBalance(balance);
	}
	document.dispatchEvent(new CustomEvent('vyrn:supabase-profile-loaded', { detail: profile }));
	return profile;
};
const refreshSupabaseAccountProfile = async () => {
	if (!supabaseClient || !currentUser) {
		throw new Error('Профиль аккаунта недоступен.');
	}
	const { data: profile, error } = await supabaseClient
		.from('telegram_profiles')
		.select('*')
		.eq('telegram_id', currentUser.id)
		.single();
	if (error) throw error;
	supabaseAccountProfile = profile;
	document.dispatchEvent(new CustomEvent('vyrn:supabase-profile-loaded', { detail: profile }));
	return profile;
};
if (supabaseClient && currentUser) {
	syncSupabaseProfile(isLocalAccount ? storedProfile : undefined).catch((error) => {
		console.error('Supabase profile sync failed:', error);
		document.dispatchEvent(new CustomEvent('vyrn:supabase-profile-load-failed', { detail: error }));
	});
}
const avatarName = [storedProfile?.firstName, storedProfile?.lastName]
	.filter((name) => typeof name === 'string' && name.trim())
	.join(' ')
	|| [currentUser?.first_name, currentUser?.last_name].filter(Boolean).join(' ');
const avatarInitials = avatarName.split(/\s+/).filter(Boolean).map((name) => [...name][0]).join('').slice(0, 2).toLocaleUpperCase('ru-RU') || 'V';
const avatarSource = currentUser?.photo_url || storedProfile?.avatar || '';
document.querySelectorAll('.nav-avatar').forEach((avatar) => {
	avatar.querySelector('.nav-avatar-fallback').textContent = avatarInitials;
	const image = avatar.querySelector('.nav-avatar-image');
	if (avatarSource) {
		image.onerror = () => { image.hidden = true; };
		image.src = avatarSource;
		image.hidden = false;
	}
});

const walletCard = document.querySelector('.wallet-balance-card');
const walletAddressElement = walletCard?.querySelector('.wallet-card-network');
if (walletCard && walletAddressElement) {
	const telegramUser = getTelegramUser();
	const walletAccountNameElement = walletCard.querySelector('.wallet-account-name');
	let profileName = '';
	if (!telegramUser) {
		try {
			const savedProfile = JSON.parse(localStorage.getItem('vyrn.profile.editor.v1') || 'null');
			profileName = [savedProfile?.firstName, savedProfile?.lastName]
				.filter((name) => typeof name === 'string' && name.trim())
				.join(' ');
		} catch {
		}
	}
	walletAccountNameElement.textContent = profileName
		|| [currentUser?.first_name, currentUser?.last_name].filter(Boolean).join(' ')
		|| 'VYRN';
	document.addEventListener('vyrn:supabase-profile-loaded', (event) => {
		if (String(event.detail?.telegram_id) === String(currentUser?.id)) {
			walletAccountNameElement.textContent = [event.detail.profile_first_name, event.detail.profile_last_name]
				.filter((name) => typeof name === 'string' && name.trim())
				.join(' ') || 'VYRN';
		}
	});
	const addressAlphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
	const storageKey = `vyrn.wallet.address.v2.${currentUser?.id ?? 'local'}`;
	const formatAddressLine = (value) => `${value.slice(0, 3)}- ${value.slice(3, 5)}-${value.slice(5, 6)} ${value.slice(6, 10)} ${value.slice(10, 14)} ${value.slice(14, 17)}- ${value.slice(17, 21)}`;
	let addressCode = '';
	try {
		addressCode = localStorage.getItem(storageKey) || '';
	} catch {
	}
	if (!/^[A-Z0-9]{42}$/.test(addressCode)) {
		const addressBytes = new Uint8Array(42);
		try {
			window.crypto.getRandomValues(addressBytes);
		} catch {
			addressBytes.forEach((_, index) => { addressBytes[index] = Math.floor(Math.random() * 256); });
		}
		addressCode = [...addressBytes].map((byte) => addressAlphabet[byte % addressAlphabet.length]).join('');
		try {
			localStorage.setItem(storageKey, addressCode);
		} catch {
		}
	}
	walletAddressElement.textContent = `${formatAddressLine(addressCode.slice(0, 21))}\n${formatAddressLine(addressCode.slice(21))}`;
	let savedWalletProfile;
	try {
		savedWalletProfile = JSON.parse(localStorage.getItem('vyrn.profile.editor.v1') || 'null');
	} catch {
		savedWalletProfile = null;
	}
	const walletAvatar = savedWalletProfile?.avatar || currentUser?.photo_url || '';
	document.querySelectorAll('.wallet-transaction-avatar-image').forEach((image) => {
		const avatarContainer = image.closest('.wallet-transaction-avatar');
		if (!walletAvatar) {
			avatarContainer.hidden = true;
			return;
		}
		image.onerror = () => {
			image.hidden = true;
			avatarContainer.hidden = true;
		};
		image.src = walletAvatar;
		image.hidden = false;
		avatarContainer.hidden = false;
	});
	walletAddressElement.addEventListener('click', async () => {
		let copied = false;
		try {
			await navigator.clipboard.writeText(walletAddressElement.textContent);
			copied = true;
		} catch {
			const temporaryInput = document.createElement('textarea');
			temporaryInput.value = walletAddressElement.textContent;
			temporaryInput.style.position = 'fixed';
			temporaryInput.style.opacity = '0';
			document.body.append(temporaryInput);
			temporaryInput.select();
			copied = document.execCommand('copy');
			temporaryInput.remove();
		}
		showWalletToast(copied ? 'Адрес кошелька скопирован' : 'Не удалось скопировать адрес');
	});

	const setCardTilt = (tiltX, tiltY, shineX = '50%', shineY = '35%') => {
		walletCard.style.setProperty('--wallet-tilt-x', `${tiltX}deg`);
		walletCard.style.setProperty('--wallet-tilt-y', `${tiltY}deg`);
		walletCard.style.setProperty('--wallet-shine-x', shineX);
		walletCard.style.setProperty('--wallet-shine-y', shineY);
	};
	const clampTilt = (value) => Math.max(-6, Math.min(6, value));
	const setCardAtmosphere = (offsetX, offsetY) => {
		walletCard.style.setProperty('--wallet-fog-x', `${offsetX}px`);
		walletCard.style.setProperty('--wallet-fog-y', `${offsetY}px`);
	};

	walletCard.addEventListener('pointermove', (event) => {
		const bounds = walletCard.getBoundingClientRect();
		const horizontal = (event.clientX - bounds.left) / bounds.width - 0.5;
		const vertical = (event.clientY - bounds.top) / bounds.height - 0.5;
		if (event.pointerType === 'mouse') {
			setCardTilt(-vertical * 10, horizontal * 12, `${(horizontal + 0.5) * 100}%`, `${(vertical + 0.5) * 100}%`);
			return;
		}
		setCardAtmosphere(horizontal * 28, vertical * 22);
	});
	walletCard.addEventListener('pointerleave', () => {
		setCardTilt(0, 0);
		setCardAtmosphere(0, 0);
	});

		const orientationEvent = window.DeviceOrientationEvent;
		if (orientationEvent && typeof orientationEvent.requestPermission !== 'function') {
			let orientationBaseline;
			window.addEventListener('deviceorientation', (event) => {
				if (event.beta == null || event.gamma == null) {
					return;
				}
				orientationBaseline ||= { beta: event.beta, gamma: event.gamma };
				setCardAtmosphere(
					clampTilt((event.gamma - orientationBaseline.gamma) / 3) * 4,
					clampTilt((event.beta - orientationBaseline.beta) / 3) * 3
				);
			});
		} else if (orientationEvent) {
			let orientationStarted = false;
			walletCard.addEventListener('pointerdown', async () => {
				if (orientationStarted) {
					return;
				}
				try {
					if (await orientationEvent.requestPermission() === 'granted') {
						orientationStarted = true;
						let orientationBaseline;
						window.addEventListener('deviceorientation', (event) => {
							if (event.beta == null || event.gamma == null) {
								return;
							}
							orientationBaseline ||= { beta: event.beta, gamma: event.gamma };
							setCardAtmosphere(
								clampTilt((event.gamma - orientationBaseline.gamma) / 3) * 4,
								clampTilt((event.beta - orientationBaseline.beta) / 3) * 3
							);
						});
					}
				} catch {
				}
			}, { once: true });
		}
}

const walletToast = document.querySelector('.wallet-toast');
let walletToastTimer;
const showWalletToast = (message) => {
	if (!walletToast) {
		return;
	}
	walletToast.textContent = message;
	walletToast.hidden = false;
	window.clearTimeout(walletToastTimer);
	walletToastTimer = window.setTimeout(() => {
		walletToast.hidden = true;
	}, 2600);
};
document.querySelectorAll('[data-wallet-message]').forEach((button) => {
	button.addEventListener('click', () => showWalletToast(button.dataset.walletMessage));
});

const walletMenuButton = document.querySelector('.wallet-header-button.is-more');
const walletMoreMenu = document.querySelector('.wallet-more-menu');
const walletCurrencyToggle = document.querySelector('.wallet-currency-toggle');
const walletCurrencyOptions = document.querySelector('.wallet-currency-options');
if (walletMenuButton && walletMoreMenu && walletCurrencyToggle && walletCurrencyOptions) {
	const closeWalletMenu = () => {
		walletMoreMenu.hidden = true;
		walletMenuButton.setAttribute('aria-expanded', 'false');
		walletCurrencyOptions.hidden = true;
		walletCurrencyToggle.setAttribute('aria-expanded', 'false');
	};
	walletMenuButton.addEventListener('click', () => {
		walletMoreMenu.hidden = !walletMoreMenu.hidden;
		walletMenuButton.setAttribute('aria-expanded', String(!walletMoreMenu.hidden));
		if (walletMoreMenu.hidden) {
			walletCurrencyOptions.hidden = true;
			walletCurrencyToggle.setAttribute('aria-expanded', 'false');
		}
	});
	walletCurrencyToggle.addEventListener('click', () => {
		walletCurrencyOptions.hidden = !walletCurrencyOptions.hidden;
		walletCurrencyToggle.setAttribute('aria-expanded', String(!walletCurrencyOptions.hidden));
	});

	const walletBalance = document.querySelector('[data-wallet-balance]');
	const walletEquivalent = document.querySelector('.wallet-balance-usd');
	const walletCurrencyName = document.querySelector('.wallet-menu-current');
	let starsBalance = cachedStarsBalance;
	const usdPerStar = 0.02;
	const rubPerUsd = 90;
	const renderWalletCurrency = (currency) => {
		if (starsBalance === null) {
			walletBalance.textContent = '…';
			walletEquivalent.textContent = '—';
		} else {
			const equivalentUsd = starsBalance * usdPerStar;
			walletBalance.textContent = starsBalance.toLocaleString('ru-RU');
			walletEquivalent.textContent = currency === 'rub'
				? new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(equivalentUsd * rubPerUsd)
				: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(equivalentUsd);
		}
		walletCurrencyName.textContent = currency.toUpperCase();
		document.querySelectorAll('[data-wallet-currency]').forEach((button) => {
			const selected = button.dataset.walletCurrency === currency;
			button.classList.toggle('is-selected', selected);
			button.setAttribute('aria-pressed', String(selected));
		});
	};
	document.querySelectorAll('[data-wallet-currency]').forEach((button) => {
		button.addEventListener('click', () => {
			const currency = button.dataset.walletCurrency;
			try {
				localStorage.setItem('vyrn.wallet.currency.v1', currency);
			} catch {
			}
			renderWalletCurrency(currency);
			closeWalletMenu();
		});
	});
	let savedCurrency = 'usd';
	try {
		savedCurrency = localStorage.getItem('vyrn.wallet.currency.v1') || 'usd';
	} catch {
	}
	renderWalletCurrency(savedCurrency === 'rub' ? 'rub' : 'usd');
	document.addEventListener('vyrn:supabase-profile-loaded', (event) => {
		const balance = Number(event.detail?.stars_balance);
		if (Number.isSafeInteger(balance) && balance >= 0) {
			starsBalance = balance;
			renderWalletCurrency(savedCurrency === 'rub' ? 'rub' : 'usd');
		}
	});
	document.addEventListener('pointerdown', (event) => {
		if (!event.target.closest('.wallet-header-actions')) {
			closeWalletMenu();
		}
	});
	document.addEventListener('keydown', (event) => {
		if (event.key === 'Escape') {
			closeWalletMenu();
		}
	});
}

{
	const profileEditButton = document.querySelector('.profile-page:not(.player-profile-page) .profile-edit-button');
const profileContentElement = document.querySelector('.profile-page:not(.player-profile-page) .profile-content');
const profileAvatarElement = document.querySelector('.profile-page:not(.player-profile-page) .profile-avatar');
const profileNameElement = document.querySelector('.profile-page:not(.player-profile-page) .profile-name');
const profileEditorDialog = document.querySelector('.profile-editor-dialog');
const profileEditorForm = profileEditorDialog?.querySelector('.profile-editor-form');
const profileEditorPhotoImage = profileEditorForm?.querySelector('.profile-editor-avatar-image');
const profileEditorError = profileEditorForm?.querySelector('.profile-editor-error');
const profileEditorBirthdayValue = profileEditorForm?.querySelector('.profile-editor-birthday-value');
const profileAvatarImage = profileAvatarElement?.querySelector('.profile-avatar-image');
const profileDetailValues = profileContentElement ? [...profileContentElement.querySelectorAll('.profile-detail-value')] : [];

if (profileEditButton && profileEditorDialog && profileEditorForm && profileAvatarElement && profileNameElement && profileDetailValues.length >= 2 && !isViewingOtherProfile) {
	const telegramUser = getTelegramUser();
	const storedName = profileNameElement.textContent.trim().split(/\s+/);
	const defaultProfile = {
		firstName: telegramUser?.first_name || storedName[0] || '',
		lastName: telegramUser ? telegramUser.last_name || '' : storedName.slice(1).join(' '),
		about: profileDetailValues[1].textContent.trim(),
		username: telegramUser?.username ? `@${telegramUser.username}` : profileDetailValues[0].textContent.trim(),
		birthday: '',
		phone: '',
		avatar: telegramUser?.photo_url || ''
	};
	let profileData = defaultProfile;
	let storedProfile;
	if (!telegramUser) {
		try {
			storedProfile = JSON.parse(localStorage.getItem('vyrn.profile.editor.v1'));
			if (storedProfile && typeof storedProfile === 'object') {
				profileData = { ...defaultProfile, ...storedProfile };
			}
		} catch {
			profileData = defaultProfile;
		}
	}
	const isLegacyPlaceholder = storedProfile?.nameIsCustom === true
		&& profileData.firstName.trim().toLocaleLowerCase('ru-RU') === 'vyrn'
		&& !profileData.lastName.trim();
	if (isLegacyPlaceholder) {
		profileData.firstName = defaultProfile.firstName;
		profileData.lastName = defaultProfile.lastName;
		profileData.avatar = defaultProfile.avatar;
		storedProfile = {
			...storedProfile,
			firstName: profileData.firstName,
			lastName: profileData.lastName,
			nameIsCustom: false,
			avatar: profileData.avatar
		};
		try {
			localStorage.setItem('vyrn.profile.editor.v1', JSON.stringify(storedProfile));
		} catch {
		}
	}
	if (telegramUser) {
		const hasCustomName = !isLegacyPlaceholder && (storedProfile?.nameIsCustom ?? (
			profileData.firstName !== defaultProfile.firstName
			|| profileData.lastName !== defaultProfile.lastName
		));
		if (!hasCustomName) {
			profileData.firstName = defaultProfile.firstName;
			profileData.lastName = defaultProfile.lastName;
		}
		if (!profileData.username || profileData.username === profileDetailValues[0].textContent.trim()) {
			profileData.username = defaultProfile.username;
		}
		profileData.avatar = telegramUser.photo_url || '';
	}

	const setAvatarImage = (image, source) => {
		if (source) {
			image.onerror = () => {
				image.hidden = true;
			};
			image.src = source;
			image.hidden = false;
		} else {
			image.onerror = null;
			image.removeAttribute('src');
			image.hidden = true;
		}
	};
	const formatBirthday = (value) => {
		if (!value) {
			return 'Добавить';
		}

		return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' })
			.format(new Date(`${value}T00:00:00`))
			.replace(/\.$/, '');
	};

	const renderProfile = () => {
		profileNameElement.textContent = [profileData.firstName, profileData.lastName].filter(Boolean).join(' ');
		profileDetailValues[0].textContent = profileData.username || '';
		profileDetailValues[1].textContent = profileData.about || '';
		setAvatarImage(profileAvatarImage, profileData.avatar);
	};
	const applySupabaseProfile = (profile) => {
		if (!currentUser || String(profile?.telegram_id) !== String(currentUser.id)) {
			return;
		}
		profileData = { ...profileData, ...profileDataFromSupabase(profile) };
		renderProfile();
	};
	document.addEventListener('vyrn:supabase-profile-loaded', (event) => applySupabaseProfile(event.detail));
	if (supabaseAccountProfile) applySupabaseProfile(supabaseAccountProfile);

	const loadProfileEditor = () => {
		for (const field of profileEditorForm.elements) {
			if (field.name && Object.hasOwn(profileData, field.name)) {
				if (field.type === 'checkbox') {
					field.checked = Boolean(profileData[field.name]);
				} else {
					field.value = String(profileData[field.name] ?? '');
				}
			}
		}
		profileEditorBirthdayValue.textContent = formatBirthday(profileData.birthday);
		profileEditorError.hidden = true;
		setAvatarImage(profileEditorPhotoImage, profileData.avatar);
	};

	renderProfile();
	profileEditButton.addEventListener('click', () => {
		loadProfileEditor();
		profileEditorDialog.showModal();
		profileEditorForm.elements.namedItem('firstName').focus();
	});
	profileEditorForm.querySelector('.profile-editor-cancel').addEventListener('click', () => profileEditorDialog.close());
	profileEditorForm.elements.namedItem('birthday').addEventListener('input', (event) => {
		profileEditorBirthdayValue.textContent = formatBirthday(event.target.value);
	});
	profileEditorForm.addEventListener('submit', async (event) => {
		event.preventDefault();
		if (!profileEditorForm.reportValidity()) {
			return;
		}

		const username = profileEditorForm.elements.namedItem('username').value.trim().replace(/^@+/, '');
		const firstName = profileEditorForm.elements.namedItem('firstName').value.trim();
		const lastName = profileEditorForm.elements.namedItem('lastName').value.trim();
		const nextProfile = {
			firstName,
			lastName,
			nameIsCustom: telegramUser
				? firstName !== defaultProfile.firstName || lastName !== defaultProfile.lastName
				: firstName !== storedName[0] || lastName !== storedName.slice(1).join(' '),
			about: profileEditorForm.elements.namedItem('about').value.trim(),
			username: username ? `@${username}` : '',
			birthday: profileEditorForm.elements.namedItem('birthday').value,
			phone: profileEditorForm.elements.namedItem('phone').value.trim(),
			avatar: profileData.avatar
		};
		if (supabaseClient && currentUser) {
			try {
				const savedProfile = await syncSupabaseProfile(nextProfile);
				profileData = { ...profileData, ...profileDataFromSupabase(savedProfile) };
				if (isLocalAccount) localStorage.setItem('vyrn.profile.editor.v1', JSON.stringify(nextProfile));
			} catch {
				profileEditorError.textContent = 'Не удалось сохранить изменения в Supabase.';
				profileEditorError.hidden = false;
				return;
			}
		} else {
			try {
				localStorage.setItem('vyrn.profile.editor.v1', JSON.stringify(nextProfile));
			} catch {
				profileEditorError.textContent = 'Не удалось сохранить изменения.';
				profileEditorError.hidden = false;
				return;
			}
			profileData = nextProfile;
		}

		renderProfile();
		profileEditorDialog.close();
	});
}
}

const nftCollection = window.VYRN_NFT_CATALOG || [];
const normalizeUserNfts = (nfts) => Array.isArray(nfts)
	? nfts.filter((gift) => gift
		&& typeof gift.slug === 'string'
		&& /^[a-z0-9]+$/i.test(gift.slug)
		&& Number.isSafeInteger(Number(gift.id))
		&& Number(gift.id) > 0
		&& typeof gift.name === 'string')
		.map((gift) => ({ ...gift, id: Number(gift.id) }))
	: [];
let userNftCollection = normalizeUserNfts(supabaseAccountProfile?.nfts);
let userSaleListings = [];
let profileNftView = 'nft';
const getSellerPayout = (price) => price - Math.ceil(price * 0.05);

const getNftPreviewUrl = (slug, id) => `https://nft.fragment.com/gift/${slug}-${id}.webp?fresh=${Date.now()}`;
const getNftAnimationUrl = (fileName) => `https://nft.fragment.com/gift/${fileName}`;
const createNftPreviewImage = (source, title, className) => {
	const image = document.createElement('img');
	image.className = className;
	image.src = source;
	image.alt = title;
	return image;
};

const collectionPreviewGrid = document.querySelector('.collection-preview-grid');
if (collectionPreviewGrid) {
	const collectionTotal = collectionPreviewGrid.closest('.collection-panel').querySelector('.collection-total');
	if (supabaseClient && currentUser) collectionPreviewGrid.classList.add('is-loading');
	const renderCollectionPreview = () => {
		collectionTotal.textContent = `${userNftCollection.length.toLocaleString('ru-RU')} NFT`;
		collectionTotal.setAttribute('aria-label', `Количество NFT: ${userNftCollection.length}`);
		collectionPreviewGrid.replaceChildren();
		userNftCollection.slice(0, 3).forEach((gift) => {
			const title = `${gift.name} #${gift.id}`;
			const image = createNftPreviewImage(getNftPreviewUrl(gift.slug, gift.id), title, 'collection-preview-image');
			image.loading = 'lazy';
			image.addEventListener('error', () => {
				image.src = './placeholder.png';
			}, { once: true });
			collectionPreviewGrid.append(image);
		});
	};
	renderCollectionPreview();
	document.addEventListener('vyrn:supabase-profile-loaded', (event) => {
		if (String(event.detail?.telegram_id) !== String(profileOwnerId)) return;
		collectionPreviewGrid.classList.remove('is-loading', 'has-load-error');
		userNftCollection = normalizeUserNfts(event.detail.nfts);
		renderCollectionPreview();
	});
	document.addEventListener('vyrn:supabase-profile-load-failed', () => {
		collectionPreviewGrid.classList.remove('is-loading');
		collectionPreviewGrid.classList.add('has-load-error');
	});
}

	const loadTgsData = async (source) => {
	const response = await fetch(source, { cache: 'no-store' });
	if (!response.ok) {
		throw new Error(`NFT request failed: ${response.status}`);
	}

	return new Response(
		response.body.pipeThrough(new DecompressionStream('gzip'))
	).json();
};

const createTgsPreview = async (container, source) => {
	if (!window.lottie || typeof DecompressionStream === 'undefined') {
		throw new Error('TGS animation is not supported in this browser.');
	}

	const animationData = await loadTgsData(source);
	if (!container.isConnected) {
		return;
	}

	const animation = window.lottie.loadAnimation({
		container,
		renderer: 'svg',
		loop: false,
		autoplay: false,
		animationData
	});
	animation.goToAndStop(0, true);
	animation.addEventListener('DOMLoaded', () => animation.goToAndStop(0, true));
	return animation;
};

const nftGrid = document.querySelector('.profile-page:not(.player-profile-page) .profile-nft-grid');
if (nftGrid) {
	if (supabaseClient && currentUser) nftGrid.classList.add('is-loading');
	const startedNftCards = new WeakSet();
	const renderNftCard = (gift, index, isListing = false) => {
		const title = `${gift.name} #${gift.id}`;
		const file = `${gift.slug}-${gift.id}.tgs`;
		const source = getNftAnimationUrl(file);
		const card = document.createElement('button');
		card.className = 'profile-nft-cell';
		card.type = 'button';
		card.dataset.nftSrc = source;
		card.dataset.nftLink = `https://nft.fragment.com/gift/${file}`;
		card.dataset.nftPreview = getNftPreviewUrl(gift.slug, gift.id);
		card.dataset.nftTitle = title;
		card.dataset.nftModel = gift.name;
		card.dataset.nftFile = file;
		card.dataset.nftSlug = gift.slug;
		card.dataset.nftId = String(gift.id);
		card.dataset.nftIndex = String(index);
		card.dataset.nftOwnerId = String(profileOwnerId || '');
		card.dataset.nftIsListing = String(isListing);
		card.setAttribute('aria-label', `Открыть ${title}`);

		const animationHost = document.createElement('div');
		animationHost.className = 'profile-nft-animation is-loading';
		animationHost.setAttribute('aria-hidden', 'true');
		card.append(animationHost);
		nftGrid.append(card);
		return card;
	};

	const loadNftCard = async (card) => {
		const animationHost = card.querySelector('.profile-nft-animation');
		try {
			await createTgsPreview(animationHost, card.dataset.nftSrc);
			animationHost.classList.remove('is-loading');
		} catch {
			animationHost.classList.remove('is-loading');
			animationHost.classList.add('has-nft-preview');
			animationHost.replaceChildren(createNftPreviewImage(
				card.dataset.nftPreview,
				card.dataset.nftTitle,
				'profile-nft-preview'
			));
		}
	};

	let cards = [];
	const updateVisibleNftCards = () => {
		const viewportHeight = window.innerHeight;
		cards.forEach((card) => {
			const rect = card.getBoundingClientRect();
			const isNearViewport = rect.bottom >= -120 && rect.top <= viewportHeight + 120;
			if (isNearViewport && !startedNftCards.has(card)) {
				startedNftCards.add(card);
				loadNftCard(card);
			}
		});
	};
	const renderNftCollection = () => {
		nftGrid.dataset.view = profileNftView;
		nftGrid.replaceChildren();
		const gifts = profileNftView === 'sales'
			? userSaleListings.map((listing) => listing.nft_data)
			: userNftCollection;
		cards = gifts.map((gift, index) => renderNftCard(gift, index, profileNftView === 'sales'));
		updateVisibleNftCards();
	};
	let saleListingsLoaded = false;
	const loadUserSaleListings = async (refresh = false) => {
		if (!supabaseClient || !currentUser || (saleListingsLoaded && !refresh)) return;
		nftGrid.classList.add('is-loading');
		const { data, error } = await supabaseClient
			.from('nft_listings')
			.select('*')
			.eq('seller_telegram_id', profileOwnerId)
			.eq('status', 'active')
			.order('created_at', { ascending: false });
		if (error) {
			nftGrid.classList.remove('is-loading');
			nftGrid.classList.add('has-load-error');
			return;
		}
		userSaleListings = (data || []).filter((listing) => listing?.nft_data?.slug && listing?.nft_data?.id);
		saleListingsLoaded = true;
		nftGrid.classList.remove('is-loading', 'has-load-error');
		if (profileNftView === 'sales') renderNftCollection();
	};
	document.addEventListener('vyrn:profile-view-changed', (event) => {
		if (event.detail === 'sales') loadUserSaleListings();
		renderNftCollection();
	});
	renderNftCollection();
	document.addEventListener('vyrn:supabase-profile-loaded', (event) => {
		if (String(event.detail?.telegram_id) !== String(profileOwnerId)) return;
		nftGrid.classList.remove('is-loading', 'has-load-error');
		userNftCollection = normalizeUserNfts(event.detail.nfts);
		renderNftCollection();
	});
	document.addEventListener('vyrn:supabase-profile-load-failed', () => {
		nftGrid.classList.remove('is-loading');
		nftGrid.classList.add('has-load-error');
	});

	window.addEventListener('scroll', updateVisibleNftCards, { passive: true });
	window.addEventListener('resize', updateVisibleNftCards);
	updateVisibleNftCards();
}

const profileNftTabs = document.querySelector('.profile-nft-tabs');
if (profileNftTabs) {
	const profileNftButtons = [...profileNftTabs.querySelectorAll('.profile-nft-button')];
	const profileNftIndicator = profileNftTabs.querySelector('.profile-nft-indicator');
	const moveProfileNftIndicator = (button) => {
		profileNftIndicator.style.left = `${button.offsetLeft}px`;
		profileNftIndicator.style.setProperty('--profile-nft-indicator-width', `${button.offsetWidth}px`);
	};
	moveProfileNftIndicator(profileNftButtons.find((button) => button.classList.contains('is-active')));
	profileNftButtons.forEach((button) => {
		button.addEventListener('click', () => {
			const wasActive = button.classList.contains('is-active');
			profileNftButtons.forEach((tab) => {
				const isActive = tab === button;
				tab.classList.toggle('is-active', isActive);
				tab.setAttribute('aria-pressed', String(isActive));
			});
			moveProfileNftIndicator(button);
			profileNftView = button.dataset.profileView || 'nft';
			document.dispatchEvent(new CustomEvent('vyrn:profile-view-changed', { detail: profileNftView }));
		});
	});
}

const nftGrids = [...document.querySelectorAll('.profile-nft-grid')];
const nftModal = document.querySelector('.nft-modal');
const nftModalAnimation = document.querySelector('.nft-modal-animation');
const nftModalBackdrop = document.querySelector('.nft-modal-backdrop');
if (nftGrids.length && nftModal && nftModalAnimation && nftModalBackdrop) {
	const nftModalArt = nftModal.querySelector('.nft-modal-art');
	const nftModalTitle = nftModal.querySelector('#nft-modal-title');
	const nftModalOwner = nftModal.querySelector('.nft-modal-owner');
	const nftModalModel = nftModal.querySelector('.nft-modal-model');
	const nftModalPrice = nftModal.querySelector('.nft-modal-price');
	const nftModalSellButton = nftModal.querySelector('.nft-modal-sell');
	const nftModalSaleForm = nftModal.querySelector('.nft-modal-sale-form');
	const nftModalSalePrice = nftModalSaleForm.querySelector('#nft-modal-sale-price');
	const nftModalSaleEstimate = nftModalSaleForm.querySelector('.nft-modal-sale-estimate span');
	const nftModalSellerPayout = nftModal.querySelector('.nft-modal-seller-payout');
	const nftModalSellerPayoutLine = nftModal.querySelector('.nft-modal-sale-payout');
	const nftModalListingPayoutRow = nftModal.querySelector('.nft-modal-listing-payout-row');
	const nftModalListingPayout = nftModal.querySelector('.nft-modal-listing-payout');
	const nftModalSaleStatus = nftModalSaleForm.querySelector('.nft-modal-sale-status');
	const nftModalSaleSubmit = nftModalSaleForm.querySelector('.nft-modal-sale-submit');
	const nftModalConfirm = nftModal.querySelector('.nft-modal-confirm');
	const nftModalActionStatus = nftModal.querySelector('.nft-modal-action-status');
	let activeNftAnimation;
	let activeNftBackdrop;
	let activeNftCard;
	let activeSaleListing = null;
	let isWithdrawingListing = false;
	let animationRequestId = 0;

	const clearNftAnimation = () => {
		animationRequestId++;
		activeNftCard = null;
		activeSaleListing = null;
		nftModal.classList.remove('is-sale-mode', 'is-closing');
		nftModalPrice.textContent = '—';
		nftModalSellButton.hidden = true;
		nftModalSaleForm.hidden = true;
		nftModalSaleForm.reset();
		nftModalSellerPayoutLine.hidden = true;
		nftModalListingPayoutRow.hidden = true;
		nftModalSaleStatus.hidden = true;
		nftModalActionStatus.hidden = true;
		nftModalSaleSubmit.disabled = false;
		nftModalSaleSubmit.textContent = 'Выставить на рынок';
		nftModalConfirm.disabled = false;
		nftModalConfirm.hidden = true;
		nftModalConfirm.textContent = 'OK';
		activeNftAnimation?.destroy();
		activeNftAnimation = null;
		activeNftBackdrop?.destroy();
		activeNftBackdrop = null;
		nftModalAnimation.replaceChildren();
		nftModalAnimation.hidden = true;
		nftModalAnimation.classList.remove('is-ready');
		nftModalArt.classList.remove('is-ready');
		nftModalBackdrop.replaceChildren();
		nftModalBackdrop.hidden = true;
		nftModalBackdrop.classList.remove('is-ready');
	};

	const createNftGiftOverlayData = (animationData) => {
		const overlayData = structuredClone(animationData);
		const giftLayer = overlayData.layers.find((layer) => layer.nm === 'Gift');
		if (!giftLayer) {
			return overlayData;
		}

		const scaleData = giftLayer.ks?.s?.k;
		const shrinkScale = (values) => {
			if (Array.isArray(values) && values.length >= 2) {
				values[0] *= 0.7;
				values[1] *= 0.7;
			}
		};
		if (Array.isArray(scaleData)) {
			if (typeof scaleData[0] === 'number') {
				shrinkScale(scaleData);
			} else {
				scaleData.forEach((keyframe) => {
					shrinkScale(keyframe.s);
					shrinkScale(keyframe.e);
				});
			}
		}

		overlayData.layers = [giftLayer];
		return overlayData;
	};

	const loadNftPrice = (fileName, askingPrice = null) => {
		const giftId = fileName.replace(/\.tgs$/, '');
		const gift = nftCollection.find((item) => `${item.slug}-${item.id}` === giftId);
		if (!gift && !Number.isSafeInteger(askingPrice)) {
			nftModalPrice.textContent = 'Нет данных';
			return;
		}

		const priceValue = document.createElement('span');
		priceValue.textContent = Number.isSafeInteger(askingPrice)
			? askingPrice.toLocaleString('ru-RU')
			: Math.round(gift.lastSaleTon * 100).toLocaleString('ru-RU');
		const currencyIcon = document.createElement('img');
		currencyIcon.className = 'nft-modal-price-icon';
		currencyIcon.src = 'stars.png';
		currencyIcon.alt = '';
		currencyIcon.setAttribute('aria-hidden', 'true');
		nftModalPrice.replaceChildren(priceValue, currencyIcon);
	};

	const setSaleEstimate = (gift) => {
		const catalogGift = nftCollection.find((item) => item.slug === gift?.slug && Number(item.id) === Number(gift?.id));
		nftModalSaleEstimate.textContent = catalogGift
			? Math.round(catalogGift.lastSaleTon * 100).toLocaleString('ru-RU')
			: '—';
	};
	const updateSellerPayout = () => {
		const price = Number(nftModalSalePrice.value);
		const hasValidPrice = Number.isSafeInteger(price) && price >= 1;
		nftModalSellerPayoutLine.hidden = !hasValidPrice;
		if (hasValidPrice) nftModalSellerPayout.textContent = getSellerPayout(price).toLocaleString('ru-RU');
	};
	nftModalSalePrice.addEventListener('input', updateSellerPayout);

	nftModalSellButton.addEventListener('click', () => {
		nftModalSaleForm.hidden = false;
		nftModal.classList.add('is-sale-mode');
		nftModalSaleStatus.hidden = true;
		requestAnimationFrame(() => nftModalSalePrice.focus());
	});

	nftModalSaleForm.addEventListener('submit', async (event) => {
		event.preventDefault();
		const price = Number(nftModalSalePrice.value);
		if (!activeNftCard || !currentUser || !supabaseClient) {
			nftModalSaleStatus.textContent = 'Не удалось определить владельца NFT.';
			nftModalSaleStatus.hidden = false;
			return;
		}
		if (!Number.isSafeInteger(price) || price < 1) {
			nftModalSaleStatus.textContent = 'Введите целую цену не меньше 1 звезды.';
			nftModalSaleStatus.hidden = false;
			return;
		}

		const nftIndex = Number(activeNftCard.dataset.nftIndex);
		const gift = userNftCollection[nftIndex];
		if (!gift || gift.slug !== activeNftCard.dataset.nftSlug || Number(gift.id) !== Number(activeNftCard.dataset.nftId)) {
			nftModalSaleStatus.textContent = 'Этот NFT уже недоступен в коллекции.';
			nftModalSaleStatus.hidden = false;
			return;
		}

		nftModalSaleSubmit.disabled = true;
		nftModalSaleSubmit.textContent = 'Выставляем…';
		nftModalSaleStatus.hidden = true;
		try {
			const { data: listing, error } = await supabaseClient.rpc('create_nft_listing', {
				p_seller_telegram_id: currentUser.id,
				p_nft_data: gift,
				p_price: price
			});
			if (error) throw error;
			if (!listing?.id) throw new Error('Supabase не подтвердил создание объявления.');
			const updatedNfts = [...userNftCollection];
			updatedNfts.splice(nftIndex, 1);
			supabaseAccountProfile = { ...supabaseAccountProfile, nfts: updatedNfts };
			document.dispatchEvent(new CustomEvent('vyrn:supabase-profile-loaded', { detail: supabaseAccountProfile }));
			userSaleListings.unshift(listing);
			saleListingsLoaded = true;
			profileNftTabs?.querySelector('[data-profile-view="sales"]')?.click();
			closeNftModal();
			refreshSupabaseAccountProfile().catch((refreshError) => console.error('Could not refresh profile after listing:', refreshError));
		} catch (error) {
			nftModalSaleStatus.textContent = error.message || 'Не удалось выставить NFT на рынок.';
			nftModalSaleStatus.hidden = false;
		} finally {
			nftModalSaleSubmit.disabled = false;
			nftModalSaleSubmit.textContent = 'Выставить на рынок';
		}
	});

	const createNftBackdropData = (animationData) => {
		const backdropData = structuredClone(animationData);
		backdropData.layers = backdropData.layers.filter((layer) => layer.nm !== 'Gift');
		return backdropData;
	};

	const setNftArtAspectRatio = (container) => {
		container.querySelector('svg')?.setAttribute('preserveAspectRatio', 'xMidYMid slice');
	};

	const loadModalAnimation = async (source, preview, title) => {
		const requestId = animationRequestId;
		nftModalAnimation.hidden = false;
		nftModalAnimation.replaceChildren();
		try {
			const animationData = await loadTgsData(source);
			if (requestId !== animationRequestId || !nftModal.open) {
				return;
			}

			let loadedLayers = 0;
			const revealAnimation = () => {
				loadedLayers++;
				if (loadedLayers === 2 && requestId === animationRequestId) {
					nftModalBackdrop.classList.add('is-ready');
					nftModalAnimation.classList.add('is-ready');
					nftModalArt.classList.add('is-ready');
				}
			};

			nftModalBackdrop.replaceChildren();
			nftModalBackdrop.hidden = false;
			activeNftBackdrop = window.lottie.loadAnimation({
				container: nftModalBackdrop,
				renderer: 'svg',
				loop: false,
				autoplay: false,
				animationData: createNftBackdropData(animationData)
			});
			activeNftBackdrop.goToAndStop(0, true);
			activeNftBackdrop.addEventListener('DOMLoaded', () => {
				setNftArtAspectRatio(nftModalBackdrop);
				activeNftBackdrop?.goToAndStop(0, true);
				revealAnimation();
			});

			nftModalAnimation.replaceChildren();
			activeNftAnimation = window.lottie.loadAnimation({
				container: nftModalAnimation,
				renderer: 'svg',
				loop: false,
				autoplay: true,
				animationData: createNftGiftOverlayData(animationData)
			});
			activeNftAnimation.addEventListener('DOMLoaded', () => {
				setNftArtAspectRatio(nftModalAnimation);
				revealAnimation();
			});
		} catch {
			if (requestId === animationRequestId) {
				nftModalAnimation.replaceChildren(createNftPreviewImage(preview, title, 'nft-modal-preview'));
				nftModalBackdrop.replaceChildren(createNftPreviewImage(preview, title, 'nft-modal-backdrop-preview'));
				nftModalBackdrop.hidden = false;
				nftModalBackdrop.classList.add('is-ready');
				nftModalAnimation.classList.add('is-ready');
				nftModalArt.classList.add('is-ready');
			}
		}
	};

	nftModalAnimation.addEventListener('click', (event) => {
		const target = event.target;
		const svg = target instanceof Element ? target.closest('svg') : null;
		if (svg && target !== svg) {
			activeNftAnimation?.goToAndPlay(0, true);
		}
	});

	nftGrids.forEach((grid) => {
		grid.addEventListener('click', (event) => {
			const nftCard = event.target.closest('.profile-nft-cell');
			if (!nftCard) {
				return;
			}

			if (nftCard.tagName === 'A') {
				event.preventDefault();
			}

			nftModalTitle.textContent = nftCard.dataset.nftTitle;
			nftModalOwner.textContent = nftCard.closest('.profile-page')?.querySelector('.profile-name')?.textContent.trim() || '';
			nftModalModel.textContent = nftCard.dataset.nftModel;
			clearNftAnimation();
			activeNftCard = nftCard;
			const isOwnNft = String(nftCard.dataset.nftOwnerId) === String(currentUser?.id);
			const isListing = nftCard.dataset.nftIsListing === 'true';
			const listing = isListing ? userSaleListings[Number(nftCard.dataset.nftIndex)] : null;
			activeSaleListing = listing;
			nftModalSellButton.hidden = !isOwnNft || isListing;
			nftModalConfirm.hidden = !listing;
			nftModalConfirm.textContent = isListing ? 'СНЯТЬ С ПРОДАЖИ' : 'OK';
			nftModalListingPayoutRow.hidden = !listing;
			if (listing) nftModalListingPayout.textContent = getSellerPayout(Number(listing.price)).toLocaleString('ru-RU');
			const gift = listing?.nft_data || userNftCollection[Number(nftCard.dataset.nftIndex)];
			setSaleEstimate(gift);
			nftModal.showModal();
			nftModal.querySelector('.nft-modal-close').focus();
			loadModalAnimation(nftCard.dataset.nftSrc, nftCard.dataset.nftPreview, nftCard.dataset.nftTitle);
			loadNftPrice(nftCard.dataset.nftFile, listing ? Number(listing.price) : null);
		});
	});

	const closeNftModal = () => {
		if (!nftModal.open || nftModal.classList.contains('is-closing')) return;
		nftModal.classList.add('is-closing');
		window.setTimeout(() => {
			if (nftModal.open) nftModal.close();
		}, 220);
	};
	nftModal.querySelector('.nft-modal-close').addEventListener('click', closeNftModal);
	nftModalConfirm.addEventListener('click', async () => {
		if (!activeSaleListing) {
			closeNftModal();
			return;
		}
		if (isWithdrawingListing) return;

		const listing = activeSaleListing;
		isWithdrawingListing = true;
		nftModalConfirm.disabled = true;
		nftModalConfirm.textContent = 'Снимаем…';
		nftModalActionStatus.hidden = true;
		try {
			const { data: cancelledListing, error } = await supabaseClient.rpc('cancel_nft_listing', {
				p_listing_id: listing.id,
				p_seller_telegram_id: currentUser.id
			});
			if (error) throw error;
			if (!cancelledListing || cancelledListing.status !== 'cancelled') {
				throw new Error('Supabase не подтвердил снятие объявления.');
			}

			userSaleListings = userSaleListings.filter((item) => String(item.id) !== String(listing.id));
			userNftCollection = normalizeUserNfts([...userNftCollection, listing.nft_data]);
			supabaseAccountProfile = { ...supabaseAccountProfile, nfts: userNftCollection };
			document.dispatchEvent(new CustomEvent('vyrn:supabase-profile-loaded', { detail: supabaseAccountProfile }));
			profileNftTabs?.querySelector('[data-profile-view="nft"]')?.click();
			closeNftModal();
			refreshSupabaseAccountProfile().catch((refreshError) => console.error('Could not refresh profile after cancelling listing:', refreshError));
		} catch (error) {
			nftModalActionStatus.textContent = error.message || 'Не удалось снять объявление.';
			nftModalActionStatus.hidden = false;
			nftModalConfirm.disabled = false;
			nftModalConfirm.textContent = 'СНЯТЬ С ПРОДАЖИ';
		} finally {
			isWithdrawingListing = false;
		}
	});
	nftModal.addEventListener('click', (event) => {
		if (event.target === nftModal) {
			closeNftModal();
		}
	});
	document.addEventListener('keydown', (event) => {
		if (event.key === 'Escape' && nftModal.open) {
			event.preventDefault();
			closeNftModal();
		}
	});
	nftModal.addEventListener('close', clearNftAnimation);
}

if (bottomNav && navIndicator && activeItem) {
const moveIndicator = (button, animate) => {
	const buttonRect = button.getBoundingClientRect();
	const navRect = bottomNav.getBoundingClientRect();
	const inset = 4;
	const left = buttonRect.left - navRect.left - bottomNav.clientLeft + inset;
	navIndicator.style.left = `${left}px`;
	navIndicator.style.setProperty('--indicator-width', `${buttonRect.width - inset * 2}px`);

	if (animate) {
		navIndicator.classList.remove('is-moving');
		void navIndicator.offsetWidth;
		navIndicator.classList.add('is-moving');
	}
};

const activateNavItem = (item) => {
	navItems.forEach((navItem) => {
		const isActive = navItem === item;
		navItem.classList.toggle('is-active', isActive);

		if (navItem.tagName === 'BUTTON') {
			navItem.setAttribute('aria-pressed', String(isActive));
		} else if (isActive) {
			navItem.setAttribute('aria-current', 'page');
		} else {
			navItem.removeAttribute('aria-current');
		}
	});

	activeItem = item;
	moveIndicator(item, true);
};

bottomNav.classList.add('is-initializing');
moveIndicator(activeItem, false);
requestAnimationFrame(() => {
	requestAnimationFrame(() => bottomNav.classList.remove('is-initializing'));
});
window.addEventListener('resize', () => moveIndicator(activeItem, false));

navButtons.forEach((button) => {
	button.addEventListener('click', () => {
		if (button === activeItem) {
			return;
		}

		activateNavItem(button);
	});
});

navItems.filter((item) => item.tagName === 'A').forEach((link) => {
	link.addEventListener('click', (event) => {
		const destination = new URL(link.href, window.location.href);
		if (destination.origin !== window.location.origin || destination.pathname === window.location.pathname) {
			return;
		}

		event.preventDefault();
		activateNavItem(link);
		bottomNav.classList.add('is-route-transitioning');

		const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 240 : 320;
		window.setTimeout(() => window.location.assign(destination.href), duration);
	});
});
}

const chatRows = [...document.querySelectorAll('.chat-row')];
const conversationDialog = document.querySelector('.conversation-dialog');
const chatsPage = document.querySelector('.chats-page');
const chatsSearchInput = chatsPage?.querySelector('.chats-search-input');

if (chatsPage && chatsSearchInput) {
	let pullStart = null;
	const filterChats = () => {
		const query = chatsSearchInput.value.trim().toLocaleLowerCase('ru-RU');
		chatsPage.querySelectorAll('.chat-row').forEach((row) => {
			const searchableText = `${row.querySelector('.chat-name').textContent} ${row.querySelector('.chat-message').textContent}`;
			row.hidden = !searchableText.toLocaleLowerCase('ru-RU').includes(query);
		});
	};

	chatsSearchInput.addEventListener('input', filterChats);
	chatsSearchInput.addEventListener('keydown', (event) => {
		if (event.key === 'Escape') {
			chatsSearchInput.value = '';
			filterChats();
			chatsPage.classList.remove('is-search-open');
		}
	});

	chatsPage.addEventListener('touchstart', (event) => {
		if (event.touches.length !== 1 || event.target.closest('.chats-search')) {
			pullStart = null;
			return;
		}

		const touch = event.touches[0];
		pullStart = { x: touch.clientX, y: touch.clientY, atTop: window.scrollY <= 0 };
	}, { passive: true });

	chatsPage.addEventListener('touchmove', (event) => {
		if (!pullStart || !pullStart.atTop || window.scrollY > 0 || event.touches.length !== 1) {
			return;
		}

		const touch = event.touches[0];
		const deltaY = touch.clientY - pullStart.y;
		const deltaX = touch.clientX - pullStart.x;
		if (deltaY > 10 && deltaY > Math.abs(deltaX)) {
			event.preventDefault();
		}
		if (deltaY >= 58 && deltaY > Math.abs(deltaX)) {
			chatsPage.classList.add('is-search-open');
			pullStart = null;
		}
	}, { passive: false });

	chatsPage.addEventListener('touchend', () => { pullStart = null; }, { passive: true });
	chatsPage.addEventListener('touchcancel', () => { pullStart = null; }, { passive: true });
}

if (chatRows.length && conversationDialog) {
	const chatList = chatsPage.querySelector('.chat-list');
	const chatsStatus = chatsPage.querySelector('.chats-status');
	const conversationScreen = conversationDialog.querySelector('.conversation-screen');
	const conversationProfile = conversationDialog.querySelector('.conversation-profile');
	const conversationMessages = conversationDialog.querySelector('.conversation-messages');
	const conversationMessageList = conversationDialog.querySelector('.conversation-message-list');
	const conversationStatus = conversationDialog.querySelector('.conversation-status');
	const conversationPeerName = conversationDialog.querySelector('.conversation-peer-name');
	const conversationPeerStatus = conversationDialog.querySelector('.conversation-peer-status');
	const conversationAvatarSlot = conversationDialog.querySelector('.conversation-avatar-slot');
	const conversationComposer = conversationDialog.querySelector('.conversation-composer');
	const conversationReadonlyNotice = conversationDialog.querySelector('.conversation-readonly-notice');
	const conversationAttach = conversationDialog.querySelector('.conversation-attach');
	const conversationInputShell = conversationDialog.querySelector('.conversation-input-shell');
	const conversationInput = conversationDialog.querySelector('.conversation-input');
	const conversationSend = conversationDialog.querySelector('.conversation-send');
	const messageActionScrim = conversationDialog.querySelector('.message-action-scrim');
	const messageActionMenu = conversationDialog.querySelector('.message-action-menu');
	const messageDeleteAction = conversationDialog.querySelector('.message-delete-action');
	const chatSupabase = window.VYRN_SUPABASE_CLIENT;
	const chatCurrentUser = window.VYRN_CURRENT_USER;
	const favoritesChatIndex = chatRows.findIndex((row) => row.dataset.chatType === 'favorites');
	const favoritesStorageKey = 'vyrn.favorites.messages.v1';
	const playerProfileName = conversationProfile.querySelector('.profile-name');
	const playerProfileStatus = conversationProfile.querySelector('.profile-status');
	const playerProfileUsername = conversationProfile.querySelector('.player-profile-username');
	const playerProfileBio = conversationProfile.querySelector('.player-profile-bio');
	const playerProfiles = [
		{ username: 'Канал', status: 'официальный канал', headerStatus: 'официальный канал', bio: 'Новости и обновления проекта VYRN', notice: 'Канал доступен только для чтения' },
		{ username: 'Личное', status: 'только вы', headerStatus: 'Сохранённые сообщения', bio: 'Личное пространство для избранных сообщений.', notice: '', canSend: true }
	];
	let favoriteMessages = [];
	try {
		const savedMessages = JSON.parse(localStorage.getItem(favoritesStorageKey));
		if (Array.isArray(savedMessages)) {
			favoriteMessages = savedMessages
				.filter((message) => message && typeof message.text === 'string' && typeof message.time === 'string')
				.map((message) => ({ text: message.text.slice(0, 4096), time: message.time, outgoing: true }));
		}
	} catch {
		favoriteMessages = [];
	}
	const conversationThreads = [
		[
			{ text: 'Добро пожаловать в VYRN — Портал. Здесь будут публиковаться новости и обновления проекта.', time: '12:00' }
		],
		favoriteMessages
	];
	let activeChatIndex = -1;
	let activeDirectChat = null;
	let activeDirectChannel = null;
	let isSendingDirectMessage = false;
	const directChats = new Map();
	const knownDirectConversationIds = new Set();
	let pendingDirectMessages = [];
	let directChatUpdatesChannel = null;
	let pendingDeleteIndex = -1;
	let activeMessageBubble;
	let activeMessageRow;
	let activeMessageClone;
	const favoritesPreview = chatRows[favoritesChatIndex]?.querySelector('.chat-message');
	if (favoritesPreview && favoriteMessages.length) {
		favoritesPreview.textContent = favoriteMessages.at(-1).text;
	}

	const renderConversationMessages = (animateLatest = false) => {
		conversationMessageList.replaceChildren();
		const messages = activeDirectChat?.messages || conversationThreads[activeChatIndex] || [];
		let latestMessageRow;
		messages.forEach((message, index) => {
			const row = document.createElement('article');
			const isAnimatedMessage = animateLatest && index === messages.length - 1;
			row.className = `conversation-message${message.outgoing ? ' is-outgoing' : ' is-incoming'}${isAnimatedMessage ? ' is-appearance-pending' : ''}`;
			row.tabIndex = message.outgoing && activeChatIndex === favoritesChatIndex ? 0 : -1;
			if (message.outgoing && activeChatIndex === favoritesChatIndex) {
				row.setAttribute('aria-label', `Сообщение: ${message.text}`);
				row.setAttribute('aria-haspopup', 'menu');
			}
			if (isAnimatedMessage) {
				latestMessageRow = row;
			}

			const bubble = document.createElement('div');
			bubble.className = 'conversation-bubble';
			if (message.outgoing && activeChatIndex === favoritesChatIndex) {
				let holdTimer;
				let startPoint;
				let longPressTriggered = false;
				const cancelHold = () => {
					clearTimeout(holdTimer);
					holdTimer = undefined;
				};
				const requestDelete = () => {
					if (activeChatIndex !== favoritesChatIndex || !messageActionMenu.hidden) {
						return;
					}
					pendingDeleteIndex = index;
					activeMessageBubble = bubble;
					activeMessageRow = row;
					const bounds = bubble.getBoundingClientRect();
					bubble.style.visibility = 'hidden';
					row.classList.add('is-action-target');
					messageActionScrim.hidden = false;
					messageActionMenu.hidden = false;
					activeMessageClone = row.cloneNode(true);
					activeMessageClone.classList.remove('is-appearing', 'is-appearance-pending', 'is-action-target');
					activeMessageClone.classList.add('message-action-copy');
					activeMessageClone.setAttribute('aria-hidden', 'true');
					activeMessageClone.style.left = `${bounds.left}px`;
					activeMessageClone.style.top = `${bounds.top}px`;
					activeMessageClone.style.width = `${bounds.width}px`;
					activeMessageClone.style.height = `${bounds.height}px`;
					const clonedBubble = activeMessageClone.querySelector('.conversation-bubble');
					clonedBubble.style.removeProperty('visibility');
					clonedBubble.style.removeProperty('--message-origin-x');
					clonedBubble.style.removeProperty('--message-origin-y');
					conversationScreen.append(activeMessageClone);
					const menuBounds = messageActionMenu.getBoundingClientRect();
					const horizontalPadding = 12;
					const alignedLeft = bounds.right - menuBounds.width;
					const left = Math.min(Math.max(horizontalPadding, alignedLeft), window.innerWidth - menuBounds.width - horizontalPadding);
					const belowTop = bounds.bottom + 8;
					const top = belowTop + menuBounds.height <= window.innerHeight - horizontalPadding
						? belowTop
						: Math.max(horizontalPadding, bounds.top - menuBounds.height - 8);
					messageActionMenu.style.left = `${left}px`;
					messageActionMenu.style.top = `${top}px`;
					messageDeleteAction.focus();
				};
				bubble.addEventListener('pointerdown', (event) => {
					if (activeChatIndex !== favoritesChatIndex || event.button !== 0) {
						return;
					}
					startPoint = { x: event.clientX, y: event.clientY };
					longPressTriggered = false;
					holdTimer = setTimeout(() => {
						longPressTriggered = true;
						requestDelete();
					}, 500);
				});
				bubble.addEventListener('pointermove', (event) => {
					if (startPoint && (Math.abs(event.clientX - startPoint.x) > 12 || Math.abs(event.clientY - startPoint.y) > 12)) {
						cancelHold();
					}
				});
				bubble.addEventListener('pointerup', cancelHold);
				bubble.addEventListener('pointercancel', cancelHold);
				bubble.addEventListener('pointerleave', cancelHold);
				bubble.addEventListener('contextmenu', (event) => {
					event.preventDefault();
					longPressTriggered = true;
					requestDelete();
				});
				row.addEventListener('click', (event) => {
					if (longPressTriggered) {
						event.preventDefault();
						event.stopPropagation();
						longPressTriggered = false;
					}
				});
				row.addEventListener('keydown', (event) => {
					if ((event.shiftKey && event.key === 'F10') || event.key === 'ContextMenu') {
						event.preventDefault();
						requestDelete();
					}
				});
			}
			const text = document.createElement('span');
			text.className = 'conversation-message-text';
			text.textContent = message.text;

			const meta = document.createElement('span');
			meta.className = 'conversation-message-meta';
			const time = document.createElement('time');
			time.textContent = message.time;
			meta.append(time);
			if (message.outgoing) {
				const checks = document.createElement('span');
				checks.className = 'tgico sending-status-is-read time-sending-status conversation-message-checks';
				checks.setAttribute('aria-hidden', 'true');
				checks.innerHTML = '<svg viewBox="0 0 24 24"><path d="M18 6 7 17l-5-5" /><path d="m22 10-7.5 7.5L13 16" /></svg>';
				meta.append(checks);
			}

			bubble.append(text, meta);
			row.append(bubble);
			conversationMessageList.append(row);
		});
		if (animateLatest) {
			conversationMessages.scrollTop = conversationMessages.scrollHeight;
			const bubble = latestMessageRow.querySelector('.conversation-bubble');
			const inputBounds = conversationInputShell.getBoundingClientRect();
			const bubbleBounds = bubble.getBoundingClientRect();
			const originX = inputBounds.left + inputBounds.width / 2 - (bubbleBounds.left + bubbleBounds.width / 2);
			const originY = inputBounds.top + inputBounds.height / 2 - (bubbleBounds.top + bubbleBounds.height / 2);
			bubble.style.setProperty('--message-origin-x', `${originX}px`);
			bubble.style.setProperty('--message-origin-y', `${originY}px`);
			requestAnimationFrame(() => {
				latestMessageRow.classList.remove('is-appearance-pending');
				latestMessageRow.classList.add('is-appearing');
			});
		} else {
			conversationMessages.scrollTop = conversationMessages.scrollHeight;
		}
	};
	const formatDirectChatTime = (value) => value
		? new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(new Date(value))
		: '';
	const getDirectChatPeerName = (chat) => [
		chat.peer.profile_first_name || chat.peer.telegram_first_name,
		chat.peer.profile_last_name || chat.peer.telegram_last_name
	].filter(Boolean).join(' ') || chat.peer.nickname || `ID ${chat.peerId}`;
	const setChatsStatus = (message = '') => {
		chatsStatus.textContent = message;
		chatsStatus.hidden = !message;
	};
	const setConversationStatus = (message = '') => {
		conversationStatus.textContent = message;
		conversationStatus.hidden = !message;
	};
	const updateDirectChatRow = (chat, moveToTop = false) => {
		if (!chat.row) {
			const row = document.createElement('button');
			row.className = 'chat-row direct-chat-row';
			row.type = 'button';
			row.dataset.chatType = 'direct';
			row.dataset.chatId = String(chat.id);
			const avatar = document.createElement('span');
			avatar.className = 'chat-avatar direct-chat-avatar';
			const initials = getDirectChatPeerName(chat).split(/\s+/).filter(Boolean).slice(0, 2).map((part) => [...part][0]).join('').toLocaleUpperCase('ru-RU') || 'V';
			avatar.textContent = initials;
			if (chat.peer.photo_url) {
				const image = document.createElement('img');
				image.className = 'chat-avatar-image';
				image.src = chat.peer.photo_url;
				image.alt = '';
				image.onerror = () => { avatar.textContent = initials; };
				avatar.replaceChildren(image);
			}
			const copy = document.createElement('span');
			copy.className = 'chat-copy';
			const heading = document.createElement('span');
			heading.className = 'chat-heading';
			const name = document.createElement('span');
			name.className = 'chat-name';
			const time = document.createElement('span');
			time.className = 'chat-time';
			const preview = document.createElement('span');
			preview.className = 'chat-preview';
			const message = document.createElement('span');
			message.className = 'chat-message';
			heading.append(name, time);
			preview.append(message);
			copy.append(heading, preview);
			row.append(avatar, copy);
			row.addEventListener('click', () => openDirectChat(chat));
			chat.row = row;
		}

		const name = chat.row.querySelector('.chat-name');
		const time = chat.row.querySelector('.chat-time');
		const message = chat.row.querySelector('.chat-message');
		name.textContent = getDirectChatPeerName(chat);
		time.textContent = formatDirectChatTime(chat.lastMessageAt);
		message.textContent = chat.messages.at(-1)?.text || 'Начните переписку';
		if (!chat.row.isConnected) chatList.append(chat.row);
		if (moveToTop) {
			const firstDirectRow = [...chatList.querySelectorAll('.chat-row[data-chat-type="direct"]')]
				.find((row) => row !== chat.row);
			if (firstDirectRow) chatList.insertBefore(chat.row, firstDirectRow);
		}
	};
	const addDirectMessage = (chat, record, animateLatest = false) => {
		if (chat.messages.some((message) => String(message.id) === String(record.id))) return;
		const message = {
			id: record.id,
			text: record.body,
			time: formatDirectChatTime(record.created_at),
			createdAt: record.created_at,
			outgoing: String(record.sender_telegram_id) === String(chatCurrentUser.id)
		};
		chat.messages.push(message);
		chat.messages.sort((left, right) => new Date(left.createdAt) - new Date(right.createdAt) || Number(left.id) - Number(right.id));
		chat.lastMessageAt = record.created_at;
		updateDirectChatRow(chat, true);
		if (String(activeDirectChat?.id) === String(chat.id)) renderConversationMessages(animateLatest);
	};
	const closeDirectSubscription = () => {
		if (activeDirectChannel && chatSupabase) chatSupabase.removeChannel(activeDirectChannel);
		activeDirectChannel = null;
	};
	const openDirectChat = (chat) => {
		closeDirectSubscription();
		activeChatIndex = -1;
		activeDirectChat = chat;
		setConversationStatus('');
		const name = getDirectChatPeerName(chat);
		const avatar = document.createElement('span');
		avatar.className = 'chat-avatar direct-chat-avatar';
		avatar.textContent = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => [...part][0]).join('').toLocaleUpperCase('ru-RU') || 'V';
		if (chat.peer.photo_url) {
			const image = document.createElement('img');
			image.className = 'chat-avatar-image';
			image.src = chat.peer.photo_url;
			image.alt = '';
			image.onerror = () => {
				avatar.textContent = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => [...part][0]).join('').toLocaleUpperCase('ru-RU') || 'V';
			};
			avatar.replaceChildren(image);
		}
		const headerAvatar = avatar.cloneNode(true);
		headerAvatar.classList.add('conversation-peer-avatar');
		headerAvatar.setAttribute('aria-hidden', 'true');
		conversationAvatarSlot.replaceChildren(headerAvatar);
		const profileAvatar = conversationProfile.querySelector('.profile-avatar');
		const profileAvatarArt = avatar.cloneNode(true);
		profileAvatarArt.classList.add('player-profile-avatar-art');
		profileAvatar.replaceChildren(profileAvatarArt);
		conversationPeerName.textContent = name;
		conversationPeerStatus.textContent = 'личный чат';
		playerProfileName.textContent = name;
		playerProfileStatus.textContent = 'пользователь VYRN';
		playerProfileUsername.textContent = chat.peer.nickname ? `@${chat.peer.nickname}` : '';
		playerProfileBio.textContent = chat.peer.about || '';
		conversationReadonlyNotice.hidden = true;
		conversationComposer.classList.remove('conversation-readonly');
		conversationAttach.hidden = true;
		conversationAttach.disabled = true;
		conversationInputShell.hidden = false;
		conversationInput.disabled = false;
		conversationSend.hidden = false;
		conversationSend.disabled = false;
		conversationDialog.setAttribute('aria-label', `Переписка: ${name}`);
		showConversationProfile(false);
		renderConversationMessages();
		if (!conversationDialog.open) conversationDialog.showModal();
		conversationInput.focus();
		activeDirectChannel = chatSupabase.channel(`direct-chat-${chat.id}`)
			.on('postgres_changes', {
				event: 'INSERT',
				schema: 'public',
				table: 'direct_messages',
				filter: `conversation_id=eq.${chat.id}`
			}, (payload) => addDirectMessage(chat, payload.new))
			.subscribe();
	};
	const fetchDirectChats = async () => {
		if (!chatSupabase || !chatCurrentUser) return;
		const { data: conversations, error: conversationsError } = await chatSupabase
			.from('direct_conversations')
			.select('*')
			.or(`participant_a.eq.${chatCurrentUser.id},participant_b.eq.${chatCurrentUser.id}`)
			.order('last_message_at', { ascending: false });
		if (conversationsError) throw conversationsError;
		const conversationIds = (conversations || []).map((conversation) => conversation.id);
		conversationIds.forEach((id) => knownDirectConversationIds.add(String(id)));
		if (!conversationIds.length) {
			setChatsStatus('');
			return;
		}

		const peerIds = [...new Set(conversations.map((conversation) => String(
			String(conversation.participant_a) === String(chatCurrentUser.id) ? conversation.participant_b : conversation.participant_a
		)))];
		const [profilesResult, messagesResult] = await Promise.all([
			chatSupabase.from('telegram_profiles').select('telegram_id, telegram_username, telegram_first_name, telegram_last_name, profile_first_name, profile_last_name, nickname, about, photo_url').in('telegram_id', peerIds),
			chatSupabase.from('direct_messages').select('*').in('conversation_id', conversationIds).order('created_at', { ascending: true }).order('id', { ascending: true }).limit(2000)
		]);
		if (profilesResult.error) throw profilesResult.error;
		if (messagesResult.error) throw messagesResult.error;
		const profiles = new Map((profilesResult.data || []).map((profile) => [String(profile.telegram_id), profile]));
		const messagesByConversation = new Map(conversationIds.map((id) => [String(id), []]));	
		(messagesResult.data || []).forEach((record) => {
			const chat = conversations.find((conversation) => String(conversation.id) === String(record.conversation_id));
			if (!chat) return;
			const messages = messagesByConversation.get(String(record.conversation_id));
			messages.push({
				id: record.id,
				text: record.body,
				time: formatDirectChatTime(record.created_at),
				createdAt: record.created_at,
				outgoing: String(record.sender_telegram_id) === String(chatCurrentUser.id)
			});
		});

		(conversations || []).forEach((conversation) => {
			const peerId = String(conversation.participant_a) === String(chatCurrentUser.id) ? conversation.participant_b : conversation.participant_a;
			const peer = profiles.get(String(peerId));
			if (!peer) return;
			const chat = directChats.get(String(conversation.id)) || { id: conversation.id, messages: [] };
			chat.peerId = peerId;
			chat.peer = peer;
			chat.messages = messagesByConversation.get(String(conversation.id)) || [];
			chat.lastMessageAt = conversation.last_message_at || conversation.created_at;
			directChats.set(String(chat.id), chat);
			updateDirectChatRow(chat);
		});
		setChatsStatus('');
	};
	let directChatsLoadPromise = null;
	const loadDirectChats = () => {
		if (!directChatsLoadPromise) {
			directChatsLoadPromise = fetchDirectChats().finally(() => { directChatsLoadPromise = null; });
		}
		return directChatsLoadPromise;
	};
	const flushPendingDirectMessages = () => {
		const pending = pendingDirectMessages;
		pendingDirectMessages = [];
		pending.forEach((record) => {
			const chat = directChats.get(String(record.conversation_id));
			if (chat) addDirectMessage(chat, record);
		});
	};
	const subscribeDirectChatUpdates = () => {
		if (!chatSupabase || !chatCurrentUser) return;
		directChatUpdatesChannel = chatSupabase.channel(`direct-chat-updates-${chatCurrentUser.id}`)
			.on('postgres_changes', {
				event: 'INSERT',
				schema: 'public',
				table: 'direct_conversations'
			}, (payload) => {
				const conversation = payload.new;
				if (![conversation.participant_a, conversation.participant_b].some((id) => String(id) === String(chatCurrentUser.id))) return;
				knownDirectConversationIds.add(String(conversation.id));
				loadDirectChats().then(async () => {
					if (!directChats.has(String(conversation.id))) await loadDirectChats();
					flushPendingDirectMessages();
				}).catch((error) => setChatsStatus(error.message || 'Не удалось обновить список чатов.'));
			})
			.on('postgres_changes', {
				event: 'UPDATE',
				schema: 'public',
				table: 'direct_conversations'
			}, (payload) => {
				const conversation = payload.new;
				const chat = directChats.get(String(conversation.id));
				if (!chat || ![conversation.participant_a, conversation.participant_b].some((id) => String(id) === String(chatCurrentUser.id))) return;
				chat.lastMessageAt = conversation.last_message_at;
				updateDirectChatRow(chat, true);
			})
			.on('postgres_changes', {
				event: 'INSERT',
				schema: 'public',
				table: 'direct_messages'
			}, (payload) => {
				const record = payload.new;
				const chat = directChats.get(String(record.conversation_id));
				if (chat) addDirectMessage(chat, record);
				else if (knownDirectConversationIds.has(String(record.conversation_id))) pendingDirectMessages.push(record);
			})
			.subscribe((status) => {
				if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
					setChatsStatus('Не удалось подключить обновления чатов в реальном времени.');
				}
			});
	};
	const openDirectChatWithUser = async (peerId) => {
		if (!chatCurrentUser || !Number.isSafeInteger(peerId) || peerId < 1 || String(peerId) === String(chatCurrentUser.id)) return;
		setChatsStatus('Открываем чат…');
		const { data, error } = await chatSupabase.rpc('get_or_create_direct_conversation', {
			p_requester_id: chatCurrentUser.id,
			p_peer_id: peerId
		});
		if (error) throw error;
		const conversation = Array.isArray(data) ? data[0] : data;
		if (!conversation?.id) throw new Error('Supabase не вернул диалог.');
		await loadDirectChats();
		let chat = directChats.get(String(conversation.id));
		if (!chat) {
			await loadDirectChats();
			chat = directChats.get(String(conversation.id));
		}
		if (!chat) throw new Error('Не удалось загрузить собеседника.');
		setChatsStatus('');
		openDirectChat(chat);
	};
	const startDirectChats = async () => {
		if (!chatSupabase || !chatCurrentUser) {
			if (new URLSearchParams(window.location.search).has('user')) {
				setChatsStatus('Не удалось подключить чаты. Проверьте настройки Supabase.');
			}
			return;
		}
		subscribeDirectChatUpdates();
		try {
			await loadDirectChats();
			flushPendingDirectMessages();
			const requestedPeerId = Number(new URLSearchParams(window.location.search).get('user'));
			if (Number.isSafeInteger(requestedPeerId) && requestedPeerId > 0) {
				await openDirectChatWithUser(requestedPeerId);
			}
		} catch (error) {
			console.error('Could not load direct chats:', error);
			setChatsStatus('Не удалось загрузить чаты. Проверьте supabase/chat.sql.');
		}
	};

	const showConversationProfile = (showProfile) => {
		conversationScreen.hidden = showProfile;
		conversationProfile.hidden = !showProfile;
	};

	chatRows.forEach((chatRow, index) => {
		chatRow.addEventListener('click', () => {
			closeDirectSubscription();
			activeDirectChat = null;
			activeChatIndex = index;
			const name = chatRow.querySelector('.chat-name').textContent.replace(/\s+/g, ' ').trim();
			const channelBadge = chatRow.querySelector('.channel-verified');
			const avatar = chatRow.querySelector('.chat-avatar').cloneNode(true);
			const headerAvatar = avatar.cloneNode(true);
			headerAvatar.classList.add('conversation-peer-avatar');
			headerAvatar.setAttribute('aria-hidden', 'true');
			conversationAvatarSlot.replaceChildren(headerAvatar);
			const profileAvatar = conversationProfile.querySelector('.profile-avatar');
			const profileAvatarArt = avatar.cloneNode(true);
			profileAvatarArt.classList.remove('chat-avatar');
			profileAvatarArt.classList.add('player-profile-avatar-art');
			profileAvatar.replaceChildren(profileAvatarArt);
			profileAvatar.setAttribute('aria-label', `Увеличить аватар ${name}`);
			profileAvatar.setAttribute('aria-expanded', 'false');
			conversationPeerName.replaceChildren(document.createTextNode(name));
			if (channelBadge) {
				conversationPeerName.append(channelBadge.cloneNode(true));
			}
			const profile = playerProfiles[index];
			conversationPeerStatus.textContent = profile.headerStatus;
			playerProfileName.textContent = name;
			playerProfileStatus.textContent = profile.status;
			playerProfileUsername.textContent = profile.username;
			playerProfileBio.textContent = profile.bio;
			conversationReadonlyNotice.querySelector('span').textContent = profile.notice;
			conversationReadonlyNotice.hidden = Boolean(profile.canSend);
			conversationComposer.classList.toggle('conversation-readonly', !profile.canSend);
			conversationAttach.hidden = !profile.canSend;
			conversationAttach.disabled = !profile.canSend;
			conversationInputShell.hidden = !profile.canSend;
			conversationInput.disabled = !profile.canSend;
			conversationSend.hidden = !profile.canSend;
			conversationSend.disabled = !profile.canSend;
			conversationDialog.setAttribute('aria-label', `Переписка: ${name}`);
			showConversationProfile(false);
			renderConversationMessages();
			conversationDialog.showModal();
			requestAnimationFrame(() => {
				conversationMessages.scrollTop = conversationMessages.scrollHeight;
			});
			(profile.canSend ? conversationInput : conversationDialog.querySelector('.conversation-back')).focus();
		});
	});

	const sendFavoriteMessage = () => {
		const text = conversationInput.value.trim();
		if (!text || activeChatIndex !== favoritesChatIndex) {
			return;
		}

		const time = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(new Date());
		const message = { text, time, outgoing: true };
		conversationThreads[favoritesChatIndex].push(message);
		try {
			localStorage.setItem(favoritesStorageKey, JSON.stringify(conversationThreads[favoritesChatIndex]));
		} catch {
		}
		conversationInput.value = '';
		if (favoritesPreview) {
			favoritesPreview.textContent = text;
		}
		renderConversationMessages(true);
		conversationInput.focus();
	};
	const sendDirectMessage = async () => {
		const chat = activeDirectChat;
		const text = conversationInput.value.trim();
		if (!chat || !text || isSendingDirectMessage || !chatSupabase) return;

		isSendingDirectMessage = true;
		conversationInput.disabled = true;
		conversationSend.disabled = true;
		setConversationStatus('');
		try {
			const { data, error } = await chatSupabase
				.from('direct_messages')
				.insert({
					conversation_id: chat.id,
					sender_telegram_id: chatCurrentUser.id,
					body: text
				})
				.select('*')
				.single();
			if (error) throw error;
			if (!data?.id) throw new Error('Supabase не подтвердил отправку сообщения.');
			conversationInput.value = '';
			addDirectMessage(chat, data, true);
			conversationInput.focus();
		} catch (error) {
			setConversationStatus(error.message || 'Не удалось отправить сообщение. Проверьте supabase/chat.sql.');
		} finally {
			isSendingDirectMessage = false;
			conversationInput.disabled = false;
			conversationSend.disabled = false;
		}
	};

	conversationSend.addEventListener('click', () => activeDirectChat ? sendDirectMessage() : sendFavoriteMessage());
	const closeMessageActionMenu = (restoreFocus = false) => {
		messageActionScrim.hidden = true;
		messageActionMenu.hidden = true;
		activeMessageRow?.classList.remove('is-action-target');
		activeMessageBubble?.style.removeProperty('visibility');
		activeMessageClone?.remove();
		if (restoreFocus) {
			activeMessageRow?.focus();
		}
		activeMessageBubble = undefined;
		activeMessageRow = undefined;
		activeMessageClone = undefined;
		pendingDeleteIndex = -1;
	};
	messageActionScrim.addEventListener('click', () => closeMessageActionMenu(true));
	messageDeleteAction.addEventListener('click', () => {
		if (pendingDeleteIndex < 0 || activeChatIndex !== favoritesChatIndex) {
			closeMessageActionMenu();
			return;
		}

		conversationThreads[favoritesChatIndex].splice(pendingDeleteIndex, 1);
		try {
			localStorage.setItem(favoritesStorageKey, JSON.stringify(conversationThreads[favoritesChatIndex]));
		} catch {
		}
		if (favoritesPreview) {
			favoritesPreview.textContent = conversationThreads[favoritesChatIndex].at(-1)?.text || 'Ваши сохранённые сообщения';
		}
		closeMessageActionMenu();
		renderConversationMessages();
		conversationInput.focus();
	});
	messageActionMenu.addEventListener('keydown', (event) => {
		if (event.key === 'Escape') {
			event.preventDefault();
			closeMessageActionMenu(true);
		}
	});
	conversationInput.addEventListener('keydown', (event) => {
		if (event.key === 'Enter') {
			event.preventDefault();
			if (activeDirectChat) sendDirectMessage();
			else sendFavoriteMessage();
		}
	});

	conversationDialog.querySelector('.conversation-back').addEventListener('click', () => conversationDialog.close());
	conversationDialog.querySelector('.conversation-peer').addEventListener('click', () => showConversationProfile(true));
	conversationDialog.querySelector('.player-profile-back').addEventListener('click', () => showConversationProfile(false));
	conversationDialog.addEventListener('close', () => {
		closeDirectSubscription();
		activeDirectChat = null;
		showConversationProfile(false);
		activeChatIndex = -1;
	});
	startDirectChats();
}

const profileSummary = document.querySelector('.profile-summary');
const profileContent = document.querySelector('.profile-content');
const profileAvatar = document.querySelector('.profile-avatar');
const profileName = document.querySelector('.profile-name');
const profileStatus = document.querySelector('.profile-status');

if (profileSummary && profileContent && profileAvatar && profileName && profileStatus) {
	const baseAvatarSize = 112;
	const avatarTransitionDuration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 160 : 280;
	let isExpanded = false;
	let settleTimeout;
	let collapsedSummaryHeight;

	const setAvatarSize = (size) => {
		const maxSize = Math.max(baseAvatarSize, document.documentElement.clientWidth);
		const progress = Math.min(1, Math.max(0, (size - baseAvatarSize) / (maxSize - baseAvatarSize || 1)));
		const contentWidth = profileContent.clientWidth;
		const summaryWidth = contentWidth + (maxSize - contentWidth) * progress;
		const expandedSummaryHeight = size - 56 * progress;
		const contentShift = isExpanded
			? Math.max(0, expandedSummaryHeight - (collapsedSummaryHeight ?? profileSummary.offsetHeight))
			: 0;

		profileSummary.style.setProperty('--profile-viewport-width', `${maxSize}px`);
		profileSummary.style.width = `${summaryWidth}px`;
		profileSummary.style.marginLeft = `${(contentWidth - summaryWidth) / 2}px`;
		profileSummary.style.height = isExpanded ? `${collapsedSummaryHeight}px` : '';
		profileContent.style.setProperty('--profile-avatar-content-shift', `${contentShift}px`);
		profileAvatar.style.transform = `translateY(${-56 * progress}px) scale(${size / baseAvatarSize})`;
		profileAvatar.style.borderRadius = `${50 * (1 - progress)}%`;
	};

	profileAvatar.addEventListener('click', () => {
		clearTimeout(settleTimeout);
		const currentSummaryHeight = profileSummary.getBoundingClientRect().height;
		if (!isExpanded) {
			collapsedSummaryHeight = currentSummaryHeight;
		}
		profileSummary.style.height = `${currentSummaryHeight}px`;
		isExpanded = !isExpanded;
		profileSummary.classList.toggle('is-expanded', isExpanded);
		profileAvatar.setAttribute('aria-expanded', String(isExpanded));
		profileAvatar.setAttribute('aria-label', isExpanded ? 'Свернуть аватар' : 'Увеличить аватар');
		void profileSummary.offsetHeight;
		setAvatarSize(isExpanded ? Math.max(baseAvatarSize, document.documentElement.clientWidth) : baseAvatarSize);

		if (!isExpanded) {
			settleTimeout = setTimeout(() => {
				if (!isExpanded) {
					profileAvatar.style.removeProperty('transform');
					profileAvatar.style.removeProperty('border-radius');
					profileSummary.style.removeProperty('--profile-viewport-width');
					profileSummary.style.removeProperty('width');
					profileSummary.style.removeProperty('margin-left');
					profileSummary.style.removeProperty('height');
					profileContent.style.removeProperty('--profile-avatar-content-shift');
					collapsedSummaryHeight = undefined;
				}
			}, avatarTransitionDuration + 40);
		}
	});

	window.addEventListener('resize', () => {
		if (isExpanded) {
			setAvatarSize(document.documentElement.clientWidth);
		}
	});
}
