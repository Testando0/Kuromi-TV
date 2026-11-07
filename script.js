document.addEventListener('DOMContentLoaded', async () => {
            const tvConfig = { enabled: true, baseUrl: "https://sinalpublicoetv.vercel.app" };
            let channelCatalog = [];
            let currentStream = null;

            // --- CONSTANTES E ELEMENTOS DO DOM ---
            const mainContent = document.getElementById('main-content');
            const authContainer = document.getElementById('auth-container');
            const rechargeContainer = document.getElementById('recharge-container');
            
            const loginForm = document.getElementById('login-form');
            const registerForm = document.getElementById('register-form');
            const rechargeForm = document.getElementById('recharge-form');
            const redeemForm = document.getElementById('redeem-form'); 
            
            const showRegisterLink = document.getElementById('show-register');
            const showLoginLink = document.getElementById('show-login');
            
            const rechargeLogoutButton = document.getElementById('recharge-logout-button'); 
            const settingsIcon = document.getElementById('settings-icon');
            const accountMenu = document.getElementById('account-menu');
            const menuLogoutButton = document.getElementById('menu-logout');
            const menuDeleteButton = document.getElementById('menu-delete-account');
            const menuRedeemCodeButton = document.getElementById('menu-redeem-code'); 
            const closeRedeemModalButton = document.getElementById('close-redeem-modal'); 
            
            const redeemCodeModal = document.getElementById('redeem-code-modal'); 
            const modalOverlay = document.getElementById('modal-overlay'); 

            const loginMessage = document.getElementById('login-message');
            const registerMessage = document.getElementById('register-message');
            const rechargeMessage = document.getElementById('recharge-message');
            const redeemMessage = document.getElementById('redeem-message'); 

            const userSession = document.getElementById('user-session');
            const welcomeMessage = document.getElementById('welcome-message');

            const player = document.getElementById('tv-player');
            const legacyPlayer = document.getElementById('legacy-player');
            const currentChannelDisplay = document.getElementById('current-channel');
            const playerContainer = document.querySelector('.player-container');
            const dynamicChannelsContainer = document.getElementById('dynamic-channels-container');
            const channelSearch = document.getElementById('channel-search');
            const channelCountry = document.getElementById('channel-country');
            const channelCount = document.getElementById('channel-count');

            // --- CÓDIGOS DE RECARGA ---
            let rechargeData = { VALID_CODES: {}, MS_PER_DAY: 0 }; 
            
            const loadRechargeCodes = async () => {
                try {
                    const response = await fetch('codes.json');
                    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                    const data = await response.json();
                    return { 
                        VALID_CODES: data.VALID_CODES || {},
                        MS_PER_DAY: data.MS_PER_DAY || 0 
                    };
                } catch (error) {
                    console.error('Falha ao carregar códigos de recarga:', error);
                    rechargeMessage.textContent = 'Erro ao carregar dados de recarga. Tente novamente mais tarde.';
                    rechargeMessage.style.color = 'var(--accent-color)';
                    return { VALID_CODES: {}, MS_PER_DAY: 0 };
                }
            };

            rechargeData = await loadRechargeCodes();

            // --- FUNÇÕES DE CONTROLE DE TELA E SESSÃO ---
            const showScreen = (screenName) => {
                mainContent.classList.add('hidden');
                authContainer.classList.add('hidden');
                rechargeContainer.classList.add('hidden');
                accountMenu.classList.add('hidden'); 
                redeemCodeModal.classList.add('hidden'); 
                modalOverlay.classList.add('hidden'); 

                if (screenName === 'auth') document.getElementById('auth-container').classList.remove('hidden');
                else if (screenName === 'recharge') document.getElementById('recharge-container').classList.remove('hidden');
                else if (screenName === 'main') document.getElementById('main-content').classList.remove('hidden');
            };

            const logoutSession = () => {
                localStorage.removeItem('kuromi_tv_currentUser');
                if(refreshInterval) clearInterval(refreshInterval);
                loginForm.reset();
                loginMessage.textContent = '';
                showScreen('auth');
            };

            const deleteAccount = () => {
                const currentUser = localStorage.getItem('kuromi_tv_currentUser');
                if (confirm(`Tem certeza que deseja DELETAR a conta "${currentUser}"? Esta ação é irreversível.`)) {
                    const users = JSON.parse(localStorage.getItem('kuromi_tv_users')) || {};
                    delete users[currentUser];
                    localStorage.setItem('kuromi_tv_users', JSON.stringify(users));
                    alert("Conta deletada com sucesso.");
                    logoutSession();
                }
            };

            const checkSession = () => {
                const currentUser = localStorage.getItem('kuromi_tv_currentUser');
                if (!currentUser) {
                    showScreen('auth');
                    return;
                }
                
                const users = JSON.parse(localStorage.getItem('kuromi_tv_users')) || {};
                const userData = users[currentUser];

                if (userData && userData.accessExpires && userData.accessExpires > Date.now()) {
                    welcomeMessage.textContent = `Olá, ${currentUser}!`;
                    userSession.classList.remove('hidden');
                    showScreen('main');
                    startRefreshTimer();
                } else {
                    showScreen('recharge');
                }
            };
            
            const processRechargeCode = (code, currentUser, messageElement, isRechargeScreen = false) => {
                const users = JSON.parse(localStorage.getItem('kuromi_tv_users'));
                const userData = users[currentUser];
                const validCodes = rechargeData.VALID_CODES;
                const MS_PER_DAY = rechargeData.MS_PER_DAY; 

                if (!validCodes[code]) {
                    messageElement.textContent = 'Código de recarga inválido!';
                    messageElement.style.color = 'var(--accent-color)';
                    return; 
                }
                if (userData.usedCodes && userData.usedCodes.includes(code)) {
                    messageElement.textContent = 'Este código já foi utilizado por você!';
                    messageElement.style.color = 'var(--accent-color)';
                    return; 
                }

                const durationInDays = validCodes[code]; 
                const durationInMs = durationInDays * MS_PER_DAY; 
                const startTime = (userData.accessExpires && userData.accessExpires > Date.now()) ? userData.accessExpires : Date.now();
                
                userData.accessExpires = startTime + durationInMs;
                if (!userData.usedCodes) userData.usedCodes = [];
                userData.usedCodes.push(code);

                localStorage.setItem('kuromi_tv_users', JSON.stringify(users));
                messageElement.textContent = `Código ativado! Adicionado ${durationInDays} dia(s) de acesso.`;
                messageElement.style.color = 'lightgreen';
                
                if (isRechargeScreen) {
                    setTimeout(() => checkSession(), 1500);
                } else {
                    setTimeout(() => {
                        redeemCodeModal.classList.add('hidden');
                        modalOverlay.classList.add('hidden');
                        redeemForm.reset();
                        redeemMessage.textContent = '';
                    }, 2000);
                }
            };
            
            // --- EVENT LISTENERS DE AUTENTICAÇÃO E RECARGA ---
            registerForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const username = document.getElementById('register-username').value;
                const password = document.getElementById('register-password').value;
                const users = JSON.parse(localStorage.getItem('kuromi_tv_users')) || {};

                if (users[username]) {
                    registerMessage.textContent = 'Este usuário já existe!';
                    registerMessage.style.color = 'var(--accent-color)';
                } else {
                    users[username] = { password: password, accessExpires: null, usedCodes: [] };
                    localStorage.setItem('kuromi_tv_users', JSON.stringify(users));
                    registerMessage.textContent = 'Conta criada! Faça o login.';
                    registerMessage.style.color = 'lightgreen';
                    setTimeout(() => showLoginLink.click(), 2000);
                }
            });

            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const username = document.getElementById('login-username').value;
                const password = document.getElementById('login-password').value;
                const users = JSON.parse(localStorage.getItem('kuromi_tv_users')) || {};
                const userData = users[username];

                if (userData && userData.password === password) {
                    localStorage.setItem('kuromi_tv_currentUser', username);
                    checkSession();
                } else {
                    loginMessage.textContent = 'Usuário ou senha incorretos!';
                }
            });

            rechargeLogoutButton.addEventListener('click', logoutSession);
            menuLogoutButton.addEventListener('click', logoutSession);
            
            settingsIcon.addEventListener('click', (e) => {
                e.stopPropagation(); 
                accountMenu.classList.toggle('hidden');
            });

            menuDeleteButton.addEventListener('click', deleteAccount);
            
            menuRedeemCodeButton.addEventListener('click', () => {
                accountMenu.classList.add('hidden'); 
                redeemCodeModal.classList.remove('hidden');
                modalOverlay.classList.remove('hidden');
                redeemForm.reset();
                redeemMessage.textContent = '';
            });

            closeRedeemModalButton.addEventListener('click', () => {
                redeemCodeModal.classList.add('hidden');
                modalOverlay.classList.add('hidden');
            });

            document.addEventListener('click', (e) => {
                if (!accountMenu.classList.contains('hidden') && !e.target.closest('#user-session')) {
                    accountMenu.classList.add('hidden');
                }
                if (!redeemCodeModal.classList.contains('hidden') && e.target.id === 'modal-overlay') {
                    redeemCodeModal.classList.add('hidden');
                    modalOverlay.classList.add('hidden');
                }
            });

            rechargeForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const code = document.getElementById('recharge-code').value.toUpperCase();
                const currentUser = localStorage.getItem('kuromi_tv_currentUser');
                processRechargeCode(code, currentUser, rechargeMessage, true);
            });
            
            redeemForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const code = document.getElementById('redeem-code').value.toUpperCase();
                const currentUser = localStorage.getItem('kuromi_tv_currentUser');
                processRechargeCode(code, currentUser, redeemMessage, false);
            });

            showRegisterLink.addEventListener('click', () => {
                document.getElementById('login-form-container').classList.add('hidden');
                document.getElementById('register-form-container').classList.remove('hidden');
            });
            showLoginLink.addEventListener('click', () => {
                document.getElementById('register-form-container').classList.add('hidden');
                document.getElementById('login-form-container').classList.remove('hidden');
            });

            // ==========================================
            // 📺 LÓGICA DINÂMICA DE CANAIS (CRISÁLIDA)
            // ==========================================
            const renderChannels = () => {
                const query = (channelSearch.value || '').trim().toLowerCase();
                const country = channelCountry.value;
                const matches = channelCatalog.filter(c => {
                    const haystack = [c.name, c.id, c.country, ...(c.categories || []), ...(c.languages || [])].join(' ').toLowerCase();
                    return (!query || haystack.includes(query)) && (!country || c.country === country);
                });
                channelCount.textContent = `${matches.length.toLocaleString('pt-BR')} canais`;
                const visible = matches.slice(0, 1000);
                const groups = {};
                visible.forEach(c => {
                    const group = (c.categories && c.categories[0]) || 'other';
                    (groups[group] ||= []).push(c);
                });
                dynamicChannelsContainer.innerHTML = Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)).map(([group, channels]) => `
                    <div class="channel-category">
                        <h2>${group}</h2>
                        <div class="channel-buttons">${channels.map(c => `
                            <button class="channel-button" data-channel="${c.id}" data-name="${c.name}">${c.name}${c.country ? ` <small>(${c.country})</small>` : ''}</button>
                        `).join('')}</div>
                    </div>`).join('') || '<p style="text-align:center; padding:20px;">Nenhum canal encontrado.</p>';
                if (matches.length > visible.length) dynamicChannelsContainer.insertAdjacentHTML('beforeend', `<p style="text-align:center; color:var(--secondary-text-color);">Mostrando 1.000 de ${matches.length.toLocaleString('pt-BR')}. Use a busca para encontrar outros canais.</p>`);
            };

            const loadCatalog = async () => {
                const response = await fetch('channels.json', { cache: 'no-cache' });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const data = await response.json();
                channelCatalog = data.channels || [];
                [...new Set(channelCatalog.map(c => c.country).filter(Boolean))].sort().forEach(country => {
                    channelCountry.insertAdjacentHTML('beforeend', `<option value="${country}">${country}</option>`);
                });
                channelSearch.addEventListener('input', renderChannels);
                channelCountry.addEventListener('change', renderChannels);
                renderChannels();
            };

            // Event Delegation para os botões de canal (mais performático que forEach)
            dynamicChannelsContainer.addEventListener('click', (e) => {
                if (e.target.classList.contains('channel-button')) {
                    const channelId = e.target.getAttribute('data-channel');
                    const channelName = e.target.getAttribute('data-name');
                    
                    const channel = channelCatalog.find(c => c.id === channelId);
                    const stream = channel && channel.streams && channel.streams[0];
                    currentStream = stream && stream.url;
                    if (currentStream) {
                        legacyPlayer.classList.add('hidden');
                        player.classList.remove('hidden');
                        if (window.Hls && Hls.isSupported() && /\.m3u8(?:\?|$)/i.test(currentStream)) {
                            if (window.activeHls) window.activeHls.destroy();
                            window.activeHls = new Hls();
                            window.activeHls.loadSource(currentStream);
                            window.activeHls.attachMedia(player);
                        } else { player.src = currentStream; }
                        player.play().catch(() => {});
                    } else {
                        player.classList.add('hidden');
                        legacyPlayer.classList.remove('hidden');
                        legacyPlayer.src = `${tvConfig.baseUrl}/?id=${channelId}`;
                    }
                    currentChannelDisplay.textContent = `Canal Atual: ${channelName}`;
                    openFullscreen(playerContainer);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                    startRefreshTimer();
                }
            });

            // ➕ ativar canal também com ENTER no controle remoto (D-pad)
            dynamicChannelsContainer.addEventListener('keydown', (e) => {
                if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('channel-button')) {
                    e.preventDefault();
                    e.target.click();
                }
            });

            const openFullscreen = (elem) => {
                if (elem.requestFullscreen) elem.requestFullscreen();
                else if (elem.webkitRequestFullscreen) elem.webkitRequestFullscreen(); /* Safari */
                else if (elem.msRequestFullscreen) elem.msRequestFullscreen(); /* IE11 */
            };
            
            let refreshInterval;
            const REFRESH_INTERVAL_MS = 10 * 60 * 1000; // 10 minutos

            const refreshPlayer = () => {
                console.log(`Atualizando o player (${new Date().toLocaleTimeString()}) para manter a conexão estável.`);
                const currentUser = localStorage.getItem('kuromi_tv_currentUser');
                const users = JSON.parse(localStorage.getItem('kuromi_tv_users')) || {};
                const userData = users[currentUser];
                
                if (userData && userData.accessExpires && userData.accessExpires > Date.now()) {
                    if (currentStream) {
                        player.src = currentStream;
                        player.play().catch(() => {});
                    } else if (!legacyPlayer.classList.contains('hidden')) {
                        legacyPlayer.src = legacyPlayer.src;
                    }
                } else {
                    clearInterval(refreshInterval);
                    checkSession();
                }
            };

            const startRefreshTimer = () => {
                if (refreshInterval) clearInterval(refreshInterval);
                refreshInterval = setInterval(refreshPlayer, REFRESH_INTERVAL_MS);
            };

            // ==========================================
            // ➕ NAVEGAÇÃO POR SETAS (controle remoto / D-pad de qualquer TV)
            // Não interfere nos campos de texto; só age sobre elementos visíveis.
            // ==========================================
            document.addEventListener('keydown', (e) => {
                const navKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
                if (navKeys.indexOf(e.key) === -1) return;

                const active = document.activeElement;
                const tag = (active && active.tagName) || '';
                if (tag === 'INPUT' || tag === 'TEXTAREA') return; // deixa digitar

                let focusables = Array.prototype.slice.call(
                    document.querySelectorAll('button:not([disabled]), a, input, .channel-button')
                ).filter(el => el.offsetParent !== null); // só visíveis

                if (!focusables.length) return;

                let idx = focusables.indexOf(active);
                if (idx === -1) { focusables[0].focus(); e.preventDefault(); return; }

                let n = idx;
                if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = idx + 1;
                if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   n = idx - 1;

                if (n >= 0 && n < focusables.length) {
                    focusables[n].focus();
                    e.preventDefault();
                }
            });
            
            // --- INICIALIZAÇÃO ---
            loadCatalog().catch(error => {
                console.error('Falha ao carregar catálogo de canais:', error);
                dynamicChannelsContainer.innerHTML = '<p style="text-align:center; color:var(--accent-color); padding:20px;">Não foi possível carregar o catálogo de canais.</p>';
            });
            checkSession();
        });

        // ==========================================
        // ➕ REGISTRO DO SERVICE WORKER (app nativo / offline)
        // TVs antigas sem suporte continuam funcionando normalmente.
        // ==========================================
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', function () {
                navigator.serviceWorker.register('sw.js')
                    .then(function (reg) { console.log('[KUROMI TV] SW ativo:', reg.scope); })
                    .catch(function (err) { console.warn('[KUROMI TV] SW não suportado:', err); });
            });
                             }
