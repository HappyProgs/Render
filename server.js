(function() {
    'use strict';
    
    const SEND_TO_SERVER = true; // true - you send your player info to the server and show other script users.
                                // false - you are hidden (not sent to server) and cannot see other script users.

    let totalBlocked = 0;
    let stateCleanCount = 0;

    window.addEventListener('error', function(e) {
        e.preventDefault();
        e.stopPropagation();
        return true;
    }, true);

    const origWebSocket = window.WebSocket;
    window.WebSocket = function() {
        const ws = new origWebSocket(...arguments);
        const origSend = ws.send;
        ws.send = function(data) {
            try {
                let str = typeof data === 'string' ? data : JSON.stringify(data);
                if (/report|flag|cheat|scan|kick|ban/.test(str)) {
                    totalBlocked++;
                    console.log('%c[BLOCKED WS #' + totalBlocked + ']', 'color: red; font-size: 12px');
                    return;
                }
            } catch(e) {}
            return origSend.apply(this, arguments);
        };
        return ws;
    };

    const ioCheck = setInterval(() => {
        if (window.io && io.Socket) {
            const origEmit = io.Socket.prototype.emit;
            io.Socket.prototype.emit = function() {
                let argsStr = JSON.stringify(arguments);
                if (/report|flag|kick|scan|cheat|ban/.test(argsStr) || arguments[0] === 'pong' && arguments[1] > 15000) {
                    totalBlocked++;
                    console.log('%c[BLOCKED EMIT #' + totalBlocked + ']', 'color: red; font-size: 12px');
                    return;
                }
                return origEmit.apply(this, arguments);
            };
            clearInterval(ioCheck);
        }
    }, 80);

    setInterval(() => {
        if (window.io && io.state && Object.keys(io.state).length > 10) {
            stateCleanCount++;
            Object.keys(io.state).slice(0, -6).forEach(k => delete io.state[k]);
            console.log('%c[CLEANED STATE #' + stateCleanCount + ']', 'color: lime; font-size: 12px');
        }
    }, 3200);

    const origGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function() {
        const ctx = origGetContext.apply(this, arguments);
        if (ctx) {
            const dummy = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGAoQAAAABJRU5ErkJggg==';
            ctx.toDataURL = () => dummy;
            ctx.toBlob = (cb) => cb(null);
            const origImageData = ctx.getImageData;
            ctx.getImageData = function() { return origImageData.apply(this, arguments); };
        }
        return ctx;
    };

    const spoofNav = { deviceMemory: 8, hardwareConcurrency: 8, webdriver: false, languages: ['en-US', 'en'], platform: 'Win32' };
    Object.keys(spoofNav).forEach(prop => {
        try {
            delete navigator[prop];
            Object.defineProperty(navigator, prop, { value: spoofNav[prop], writable: false, configurable: false });
        } catch(e) {}
    });

    try {
        Object.defineProperties(document, {
            hidden: { value: false, writable: false, configurable: false },
            visibilityState: { value: 'visible', writable: false, configurable: false }
        });
    } catch(e) {}

    const blockSet = new Set(['debugger', 'eval', 'Function']);
    const origTimeout = window.setTimeout;
    window.setTimeout = function(fn, delay) {
        if (typeof fn === 'string' && blockSet.has(fn.trim().split(' ')[0])) return 0;
        return origTimeout.apply(this, arguments);
    };
    const origInterval = window.setInterval;
    window.setInterval = function(fn, delay) {
        if (typeof fn === 'string' && blockSet.has(fn.trim().split(' ')[0])) return 0;
        return origInterval.apply(this, arguments);
    };

    function initScript() {
    const activeSkins = {};
    let _gameMe = null;
    let gameMeHooked = false;

    function hookGameMe() {
        if (typeof game !== 'undefined' && !gameMeHooked) {
            try {
                _gameMe = game.me;
                Object.defineProperty(game, 'me', {
                    get: function() { return _gameMe; },
                    set: function(newValue) {
                        _gameMe = newValue;
                        if (_gameMe && activeSkins[_gameMe.name] !== undefined) {
                            _gameMe.skin = activeSkins[_gameMe.name];
                        }
                    },
                    configurable: true,
                    enumerable: true
                });
                gameMeHooked = true;
            } catch (e) {}
        }
    }

    const originalRAF = window.requestAnimationFrame;
    window.requestAnimationFrame = function(callback) {
        return originalRAF(function(timestamp) {
            if (typeof game !== 'undefined' && game.me) {
                const currentType = game.me.name;
                if (activeSkins[currentType] !== undefined) {
                    game.me.skin = activeSkins[currentType];
                    if (game.gameObjects && game.me.id && game.gameObjects[game.me.id]) {
                        game.gameObjects[game.me.id].skin = activeSkins[currentType];
                    }
                }
            }
            if (typeof callback === 'function') {
                callback(timestamp);
            }
        });
    };

    setInterval(() => { hookGameMe(); }, 1000);

    const initSkinInterval = setInterval(() => {
        if (typeof user !== 'undefined' && user.selectedSkins && typeof game !== 'undefined' && game.loadSkin && game.objectsDef) {
            const neededTypes = user.selectedSkins.split(',').map(p => p.split(':')[0]).filter(t => t);
            const allReady = neededTypes.every(t => game.objectsDef[t]);
            if (!allReady) return;

            clearInterval(initSkinInterval);
            user.selectedSkins.split(',').forEach(part => {
                const [t, sId] = part.split(':');
                if (t && sId) {
                    activeSkins[t] = parseInt(sId);
                    try { game.loadSkin(t, parseInt(sId)); } catch (e) {}
                }
            });
        }
    }, 100);

    function applySkin(type, id) {
        activeSkins[type] = id;
        if (typeof user !== 'undefined') {
            let currentSkins = {};
            if (user.selectedSkins) {
                user.selectedSkins.split(',').forEach(part => {
                    const [t, sId] = part.split(':');
                    if (t && sId) currentSkins[t] = parseInt(sId);
                });
            }
            currentSkins[type] = id;
            const newSkinStr = Object.keys(currentSkins).map(k => `${k}:${currentSkins[k]}`).join(',');
            user.selectedSkins = newSkinStr;
            if (typeof setCookie === 'function') {
                setCookie("selectedSkins", newSkinStr, 365);
            } else {
                document.cookie = "selectedSkins=" + newSkinStr + "; path=/;Secure;SameSite=None";
            }
        }
        if (typeof game !== 'undefined' && game.loadSkin) {
            game.loadSkin(type, id);
        }
    }
    
    const gameReady = setInterval(() => {
        if (window.game && game.me && game.dynamicContext) {
            clearInterval(gameReady);
            if (game.lightPoints) game.lightPoints.length = 0;
        }
    }, 1500);

    Object.freeze(navigator);
    Object.freeze(document);

    console.clear();
    console.log('%cPROTECTION STARTED', 'color: lime; font-size: 16px; background: black; padding: 6px');

    const global = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;
    
    setTimeout(() => {
        window.open('https://t.me/evoezsquad', '_blank');
    }, 1000);

    const cleanup = ['ezsquad-menu', 'ez-overlay', 'ez-keybinds'];
    cleanup.forEach(id => { const el = document.getElementById(id); if (el) el.remove(); });

    const REAPER_TYPES = new Set(["grimReaper", "pumpkinGhost", "ghostlyReaper"]);
    const SCYTHE_OFFSETS = {
        grimReaper: { left: 42, top: 63, width: 52, height: 141 },
        pumpkinGhost: { left: 43, top: 68, width: 62, height: 150 },
        ghostlyReaper: { left: 32, top: 16.5, width: 43, height: 98.5 }
    };
    const REAPER_HEIGHTS = {
        grimReaper: 156,
        pumpkinGhost: 169,
        ghostlyReaper: 165
    };
    const HitRangeX = {
        grimReaper: { grimReaper: 138, pumpkinGhost: 124, ghostlyReaper: 108 },
        pumpkinGhost: { grimReaper: 161, pumpkinGhost: 151, ghostlyReaper: 108 },
        ghostlyReaper: { grimReaper: 98, pumpkinGhost: 87, ghostlyReaper: 108 }
    };
    const HitBackRangeX = {
        grimReaper: { grimReaper: 134, pumpkinGhost: 150, ghostlyReaper: 144 },
        pumpkinGhost: { grimReaper: 158, pumpkinGhost: 148, ghostlyReaper: 172 },
        ghostlyReaper: { grimReaper: 134, pumpkinGhost: 87, ghostlyReaper: 105 }
    };

    const SERVER_URL = 'https://gmmmg.onrender.com';
    const ICON_URL = 'https://raw.githubusercontent.com/csuserbro/esp-lib/refs/heads/main/photo_2026-01-09_09-40-39.jpg';

    const scriptIcon = new Image();
    scriptIcon.src = ICON_URL;
    scriptIcon.crossOrigin = "anonymous";

    window.esp = { connected: false, list: [], status: "WAKING UP..." };
    const state = {
        espPlayer: false,
        espPlayerShowName: false,
        espPlayerShowTracer: false,
        espPlayerShowDistance: false,
        espPlayerShowBox: false,
        espPlayerShowImage: false,
        espPlayerColorName: '#ffffff',
        espPlayerColorTracer: '#ffffff',
        espPlayerColorDistance: '#ffffff',
        espPlayerColorBox: '#ffffff',

        espDanger: false,
        espDangerShowName: false,
        espDangerShowTracer: false,
        espDangerShowDistance: false,
        espDangerShowBox: false,
        espDangerShowImage: false,
        espDangerColorName: '#ff0000',
        espDangerColorTracer: '#ff0000',
        espDangerColorDistance: '#ff0000',
        espDangerColorBox: '#ff0000',

        espOther: false,
        espOtherShowTracerFood: false,
        espOtherShowDistanceFood: false,
        espOtherShowNameFood: false,
        espOtherShowTracerHide: false,
        espOtherShowDistanceHide: false,
        espOtherShowNameHide: false,
        espOtherColorTracerFood: '#00ff00',
        espOtherColorDistanceFood: '#00ff00',
        espOtherColorNameFood: '#00ff00',
        espOtherColorTracerHide: '#0000ff',
        espOtherColorDistanceHide: '#0000ff',
        espOtherColorNameHide: '#0000ff',
        espOtherShowTracerTeleport: false,
        espOtherShowDistanceTeleport: false,
        espOtherShowNameTeleport: false,
        espOtherShowTracerMisc: false,
        espOtherShowDistanceMisc: false,
        espOtherShowNameMisc: false,
        espOtherShowImageMisc: false,
        espOtherColorTracerTeleport: '#ffff00',
        espOtherColorDistanceTeleport: '#ffff00',
        espOtherColorNameTeleport: '#ffff00',
        espOtherColorTracerMisc: '#00ffff',
        espOtherColorDistanceMisc: '#00ffff',
        espOtherColorNameMisc: '#00ffff',

        antifog: false,
        fullbright: false,
        autohit: false,
        autoflick: false,
        onlyReapers: false,
        hitboxes: false,
        autohitBind: 'r',
        autoflickBind: 'v',
        menuOpen: true,
        hitboxColor: '#ff3333',
        hitLimit: 45,
        hitsCount: 0,
        hitTimer: Date.now(),
        tab: 'visuals',
        showKbs: true,
        menuBind: 'n',
        autoRespawn: false,
        emoteSpammer: false,
        bossTimer: false,
        zoomHackEnabled: false,
        zoomValue: 1.0
    };
    window.fullBrightEnabled = false;

    const originalDrawImage = CanvasRenderingContext2D.prototype.drawImage;
    const originalFillRect = CanvasRenderingContext2D.prototype.fillRect;

    CanvasRenderingContext2D.prototype.drawImage = function(img, ...args) {
        if (window.fullBrightEnabled && state.fullbright) {
            if (img instanceof HTMLCanvasElement && img.width > 0 && !img.id) {
                const canvasW = this.canvas.width;
                const imgW = img.width;
                if (canvasW > 0 && imgW > 0) {
                    const ratio2 = Math.abs(imgW * 2 - canvasW);
                    const ratio4 = Math.abs(imgW * 4 - canvasW);
                    if (ratio2 < 2 || ratio4 < 2) {
                        return;
                    }
                }
            }
        }
        if (state.antifog && img && img.name) {
            const n = img.name.toLowerCase();
            const isEnv = n.includes('cloud') || n.includes('bush') || n.includes('leaf') || 
                          n.includes('swamp') || n.includes('toxic') || n.includes('lava');
            const isMonster = n.includes('monster') || n.includes('_left') || n.includes('_right');
            if (isEnv && !isMonster) {
                const oldAlpha = this.globalAlpha;
                this.globalAlpha = 0.2;
                const res = originalDrawImage.apply(this, [img, ...args]);
                this.globalAlpha = oldAlpha;
                return res;
            }
        }
        return originalDrawImage.apply(this, arguments);
    };

    CanvasRenderingContext2D.prototype.fillRect = function(x, y, w, h) {
        if (window.fullBrightEnabled && x === 0 && y === 0) {
            const c = this.canvas;
            if (c && !c.id) {
                const cw = c.width;
                const ch = c.height;
                if (cw > 0 && ch > 0 && w === cw && h === ch) {
                     return;
                }
            }
        }
        return originalFillRect.apply(this, arguments);
    };


    let selectedPet = 0;
    let originalHide = null;

    function initPetChanger() {
        if (window.petHackerInitialized) return;
        window.petHackerInitialized = true;

        const style = document.createElement('style');
        style.innerHTML = `
            .petChangerButton { display: inline-table !important; visibility: visible !important; opacity: 1 !important; z-index: 10000 !important; }
            .petChanger { 
                max-height: 400px !important; width: 320px !important; 
                overflow-y: auto !important; background: rgba(0, 0, 0, 0.95) !important; 
                border: 2px solid #00acff !important; border-radius: 10px !important; 
                z-index: 10001 !important; padding: 5px !important;
            }
            .petChanger img {
                width: 48px !important; height: 48px !important; margin: 4px !important; 
                border-radius: 6px; background: rgba(255,255,255,0.1); 
                border: 2px solid transparent; cursor: pointer; display: inline-block;
            }
            .petChanger img:hover { border-color: #00acff; background: rgba(255,255,255,0.2); }
        `;
        document.head.appendChild(style);

        function initPetHacker() {
            if (typeof $ === 'undefined' || typeof game === 'undefined' || !window.user) {
                setTimeout(initPetHacker, 100); return;
            }

            originalHide = $.fn.hide;
            const oEmpty = $.fn.empty;

            $.fn.empty = function() {
                if (this.hasClass('petChanger')) return this;
                return oEmpty.apply(this, arguments);
            };
            $.fn.hide = function() {
                if (this.hasClass('petChangerButton')) return this;
                if (this.hasClass('petChanger')) {
                    if (arguments[0] === 'p_force') return originalHide.apply(this);
                    return this;
                }
                return originalHide.apply(this, arguments);
            };

            const allPets = Array.from({length: 40}, (_, i) => i).join(',');
            const skinsValue = "pets," + allPets;
            
            Object.defineProperty(user, 'skins', { get: () => skinsValue });
            Object.defineProperty(user, 'premium', { get: () => true });

            $(document).off('mousedown', '.petChangerButton');
            $(document).on('mousedown', '.petChangerButton', function(e) {
                e.stopImmediatePropagation();
                const menu = $(".petChanger");
                if (menu.is(':visible')) {
                    originalHide.apply(menu, ['p_force']);
                } else {
                    menu.show();
                    rebuildPetUI(true);
                }
            });

            const patchPet = (me) => {
                if (!me || me._petPatched) return;
                try {
                    Object.defineProperty(me, 'petID', { 
                        get: () => selectedPet,
                        set: (v) => {},
                        configurable: true 
                    });
                    me._petPatched = true;
                } catch(e) {}
            };
            setInterval(() => { if (game.me) patchPet(game.me); }, 250);
        }

        function rebuildPetUI(forced = false) {
            if (typeof game === 'undefined' || !game.me) return;
            const el = document.querySelector(".petChanger");
            if (!el || (window.getComputedStyle(el).display === 'none' && !forced)) return;

            const cdn = window.cdnServer || "https://evoworld.io/";
            el.innerHTML = "";

            for (let i = 0; i <= 38; i++) {
                const img = document.createElement('img');
                
                if (i === 0) {
                    img.src = cdn + "images/red-cross.png";
                } else {
                    img.src = `${cdn}sprites/pets/${i}/1.png`;
                }

                img.onclick = () => {
                    selectedPet = i;
                    if (game.me) {
                        if (game.me.pet) {
                            game.deleteObject(game.me.pet);
                            game.me.pet = null;
                        }
                    }
                    rebuildPetUI(true);
                };

                if (i === selectedPet) {
                    img.style.borderColor = "#00acff";
                    img.style.boxShadow = "0 0 8px #00acff";
                }

                img.onerror = function() { this.remove(); };
                el.appendChild(img);
            }
        }

        initPetHacker();
    }

    function getEntityBoxSize(ent) {
        if (!ent) return { w: 40, h: 80 };
        if (typeof ent.hitboxWidth === 'number' && typeof ent.hitboxHeight === 'number') {
            return { w: ent.hitboxWidth, h: ent.hitboxHeight };
        }
        if (typeof ent.width === 'number' && typeof ent.height === 'number') {
            return { w: ent.width, h: ent.height };
        }
        if (ent.size && typeof ent.size.x === 'number' && typeof ent.size.y === 'number') {
            return { w: ent.size.x, h: ent.size.y };
        }
        if (ent.name && REAPER_HEIGHTS[ent.name]) {
            const h = REAPER_HEIGHTS[ent.name];
            return { w: Math.max(30, h * 0.6), h: h };
        }
        return { w: 40, h: 80 };
    }

    function getHalfExtents(ent) {
        const s = getEntityBoxSize(ent);
        return { halfW: s.w / 2, halfH: s.h / 2 };
    }

    function isWithinXRange(attacker, target, rangeTable, distAdjustment = 0) {
        if (!attacker || !target) return false;
        const aX = attacker.position.x;
        const bX = target.position.x;

        const aHalf = getHalfExtents(attacker).halfW;
        const bHalf = getHalfExtents(target).halfW;

        const relativeSpeed = Math.abs((attacker.moveSpeed && attacker.moveSpeed.x ? attacker.moveSpeed.x : 0) - (target.moveSpeed && target.moveSpeed.x ? target.moveSpeed.x : 0));
        const frameTime = (typeof window.lastFps === 'number' && window.lastFps > 0) ? (1000 / window.lastFps) : 16;
        const serverDelay = (typeof window.latency === 'number') ? window.latency : 0;
        const totalDelay = frameTime + serverDelay;

        const centerDist = Math.abs(bX - aX);
        const edgeGap = centerDist - (aHalf + bHalf);
        const effectiveDist = edgeGap - totalDelay * relativeSpeed / 1000 + distAdjustment;

        let allowedRange = 0;
        try {
            if (rangeTable && attacker.name && target.name && rangeTable[attacker.name] && typeof rangeTable[attacker.name][target.name] !== 'undefined') {
                allowedRange = rangeTable[attacker.name][target.name];
            }
        } catch (e) { allowedRange = 0; }

        return effectiveDist <= allowedRange;
    }

    function isWithinYRange(attacker, target, heights, distAdjustment = 0) {
        if (!attacker || !target) return false;
        const aY = attacker.position.y;
        const bY = target.position.y;

        const aHalf = getHalfExtents(attacker).halfH;
        const bHalf = getHalfExtents(target).halfH;

        const relativeSpeed = Math.abs((attacker.moveSpeed && attacker.moveSpeed.y ? attacker.moveSpeed.y : 0) - (target.moveSpeed && target.moveSpeed.y ? target.moveSpeed.y : 0));
        const frameTime = (typeof window.lastFps === 'number' && window.lastFps > 0) ? (1000 / window.lastFps) : 16;
        const serverDelay = (typeof window.latency === 'number') ? window.latency : 0;
        const totalDelay = frameTime + serverDelay;

        const centerDist = Math.abs(bY - aY);
        const edgeGap = centerDist - (aHalf + bHalf);
        const effectiveDist = edgeGap - totalDelay * relativeSpeed / 1000 + distAdjustment;

        let allowedRangeY = 0;
        try {
            if (heights && attacker.name && target.name) {
                allowedRangeY = heights[target.name] || heights[attacker.name] || 0;
            }
        } catch (e) { allowedRangeY = 0; }

        return effectiveDist <= allowedRangeY;
    }

    const Combat = {
        getTarget() {
            const game = global.game;
            if (!game?.me || global.imDead) return null;

            let target = null;
            let bestScore = -1;
            let players = [];
            try {
                players = game.hashMap?.retrieveVisibleByClient(game) || [];
            } catch(e) {
                players = [];
            }
            if (!players || players.length === 0) {
                if (game.gameObjects) {
                    for (let id in game.gameObjects) {
                        const obj = game.gameObjects[id];
                        if (obj && obj.type === 0x1 && obj !== game.me && !obj.deleted) {
                            players.push(obj);
                        }
                    }
                }
            }

            players.forEach(p => {
                if (!p || p.deleted || p.hp <= 0 || p === game.me) return;
                if (p.type !== 0x1) return;
                if (state.onlyReapers && !REAPER_TYPES.has(p.name)) return;
                if (global.friendsList?.includes(p.nick)) return;

                const dx = game.me.position.x - p.position.x;
                const dy = game.me.position.y - p.position.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                const score = 1 / (dist + 1) * (2 - (p.hp / (p.maxHp || 1000)));
                if (score > bestScore) { bestScore = score; target = p; }
            });
            return target;
        },

        performFlick(dir) {
            if (!global.game?.me) return;
            if (global.gameServer?.connected) {
                global.gameServer.emit(2, dir);
            }
            const key = dir === 1 ? "ArrowRight" : "ArrowLeft";
            const code = dir === 1 ? 39 : 37;
            document.dispatchEvent(new KeyboardEvent("keydown", { key, code, bubbles: true }));
            setTimeout(() => document.dispatchEvent(new KeyboardEvent("keyup", { key, code, bubbles: true })), 10);
        },

        doHit() {
            const now = Date.now();
            if (now - state.hitTimer > 1000) { state.hitsCount = 0; state.hitTimer = now; }
            if (state.hitsCount >= state.hitLimit) return;

            if (global.gameServer?.connected) {
                state.hitsCount++;
                const delay = 5 + Math.random() * 5;
                global.gameServer.emit(4, true);
                setTimeout(() => global.gameServer.emit(4, false), delay);
            }
        },

        loop() {
            if (global.imDead || !global.joinedGame) return;
            const me = global.game?.me;
            if (!me || !me.position) return;

            const target = Combat.getTarget();

            if (state.autoflick) {
                if (target && target.position) {
                    const dx = target.position.x - me.position.x;
                    const dy = target.position.y - me.position.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    
                    if (dist <= 190) {
                        const requiredDir = (target.position.x > me.position.x) ? 1 : -1;
                        if (me.direction !== requiredDir) {
                            Combat.performFlick(requiredDir);
                        }
                    }
                }
            }

            if (state.autohit) {
                if (!target || !target.position) return;
                if (!REAPER_TYPES.has(me.name)) return;

                const onLeftSide = me.position.x <= target.position.x;
                const facingEnemy = (onLeftSide && me.direction === 1) || (!onLeftSide && me.direction === -1);

                if (facingEnemy) {
                    const enemyFlicking = (onLeftSide && target.direction === 1) || (!onLeftSide && target.direction === -1);
                    const rangeTable = enemyFlicking ? HitBackRangeX : HitRangeX;
                    
                    if (isWithinXRange(me, target, rangeTable) && isWithinYRange(me, target, REAPER_HEIGHTS)) {
                        Combat.doHit();
                    }
                }
            }
        }
    };

    function combatLoop() {
        Combat.loop();
        const nextDelay = 8 + Math.random() * 4;
        setTimeout(combatLoop, nextDelay);
    }
    combatLoop();

    const eaters = {
        'fly': ['poo', 'deadFish'],
        'butterfly': ['flower_1_face_on_red'],
        'mosquito': ['pig', 'cat'],
        'dragonfly': ['fly', 'butterfly', 'mosquito', 'ladybug'],
        'wasp': ['beehive', 'flower_1_face_on_red', 'cherry', 'currant', 'strawberry', 'blueBird', 'hen', 'pigeon', 'woodpecker'],
        'hornet': ['cherry', 'currant', 'strawberry', 'blueBird', 'hen', 'parrot', 'stork', 'pigeon', 'woodpecker', 'wasp', 'redBird', 'bat', 'pompadourCotinga', 'beehive', 'evilBat'],
        'pigeon': ['seed', 'bread', 'worm'],
        'hen': ['seed', 'bread', 'worm'],
        'duck': ['seed', 'bread', 'fishPink', 'worm'],
        'parrot': ['seed', 'bread', 'cherry', 'currant', 'strawberry', 'worm', 'starFruit'],
        'turkey': ['seed', 'cherry', 'currant', 'strawberry', 'worm', 'dragonfly', 'wasp', 'snake', 'egg'],
        'blueBird': ['fly', 'cherry', 'currant', 'strawberry', 'seed', 'bread', 'worm', 'egg'],
        'redBird': ['mosquito', 'butterfly', 'fly', 'cherry', 'currant', 'strawberry', 'seed', 'bread', 'worm', 'egg'],
        'pelican': ['fishPink', 'frog', 'crab'],
        'seagull': ['fishPink', 'starfish', 'crab'],
        'stork': ['frog', 'worm', 'fishPink'],
        'vulture': ['deadFish'],
        'bat': ['mouse', 'evilRat'],
        'madBat': ['mouse', 'pigeon', 'woodpecker', 'duck', 'parrot', 'stork', 'blueBird', 'hen', 'redBird', 'pelican', 'seagull', 'turkey', 'commonBlackbird', 'owl', 'pompadourCotinga', 'falcon', 'eagle', 'snowyOwl', 'pig', 'cat', 'snake', 'meat', 'penguin', 'egg', 'evilRat'],
        'pterodactylChild': ['starFruit', 'crocodile', 'crab', 'turtle', 'shark'],
        'pterodactyl': ['pigeon', 'woodpecker', 'duck', 'parrot', 'stork', 'blueBird', 'hen', 'redBird', 'pelican', 'seagull', 'turkey', 'vulture', 'bat', 'commonBlackbird', 'pompadourCotinga', 'falcon', 'owl', 'eagle', 'snowyOwl', 'hawk', 'raven', 'madBat', 'pig', 'cat', 'crab', 'turtle', 'snake', 'meat', 'penguin', 'crocodile', 'mammoth', 'shark', 'piranha'],
        'demonicBat': ['pigeon', 'woodpecker', 'duck', 'parrot', 'stork', 'blueBird', 'hen', 'redBird', 'pelican', 'seagull', 'turkey', 'vulture', 'bat', 'commonBlackbird', 'pompadourCotinga', 'falcon', 'owl', 'eagle', 'snowyOwl', 'hawk', 'raven', 'madBat', 'eggRed'],
        'stoneEater': ['stone', 'stoneEater'],
        'demonicEggEater': ['eggRed'],
        'commonBlackbird': ['butterfly', 'fly', 'mosquito', 'wasp', 'cherry', 'currant', 'strawberry', 'seed', 'bread', 'worm', 'egg'],
        'pompadourCotinga': ['butterfly', 'fly', 'pigeon', 'woodpecker', 'mosquito', 'wasp', 'cherry', 'currant', 'strawberry', 'seed', 'dragonfly', 'worm', 'egg', 'hornet'],
        'falcon': ['pigeon', 'woodpecker', 'duck', 'parrot', 'blueBird', 'hen', 'mouse', 'frog', 'meat', 'egg', 'evilBat'],
        'owl': ['pigeon', 'woodpecker', 'duck', 'parrot', 'mouse', 'worm', 'frog', 'egg'],
        'snowyOwl': ['penguin', 'lemming'],
        'eagle': ['bat', 'blueBird', 'hen', 'redBird', 'pigeon', 'woodpecker', 'duck', 'parrot', 'stork', 'seagull', 'cat', 'meat', 'penguin', 'egg', 'evilBat'],
        'hawk': ['blueBird', 'hen', 'redBird', 'bat', 'pigeon', 'woodpecker', 'duck', 'parrot', 'stork', 'pig', 'pelican', 'seagull', 'commonBlackbird', 'turkey', 'cat', 'meat', 'penguin', 'egg', 'evilBat'],
        'raven': ['blueBird', 'hen', 'pigeon', 'woodpecker', 'duck', 'parrot', 'redBird', 'deadFish', 'snake', 'worm', 'frog', 'meat', 'penguin', 'egg'],
        'alienBug': ['cosmicPlant', 'cosmicEgg'],
        'alienBigEye': ['alienFruit1', 'alienFruit2', 'alienFruit3', 'cherry', 'currant', 'strawberry', 'starFruit'],
        'alienAngryEye': ['cosmicEgg', 'alienEye', 'alienBigInsect', 'alienBug', 'alienBigEye'],
        'alienBat': ['cosmicEgg', 'alienEye', 'pigeon', 'woodpecker', 'duck', 'parrot', 'stork', 'blueBird', 'hen', 'redBird', 'pelican', 'seagull', 'turkey', 'vulture', 'bat', 'commonBlackbird', 'pompadourCotinga', 'falcon', 'owl', 'snowyOwl', 'eagle', 'hawk', 'raven', 'madBat', 'pig', 'cat', 'crab', 'turtle', 'snake', 'alienBug', 'alienBigEye', 'alienAngryEye', 'pterodactylChild', 'pterodactyl', 'meat', 'penguin', 'demonicBat', 'demonicImp', 'alienBigInsect', 'swampMonster', 'dragon', 'egg', 'evilRat'],
        'demonicImp': ['pigeon', 'woodpecker', 'duck', 'parrot', 'stork', 'blueBird', 'hen', 'redBird', 'pelican', 'seagull', 'turkey', 'vulture', 'bat', 'commonBlackbird', 'pompadourCotinga', 'falcon', 'owl', 'snowyOwl', 'eagle', 'hawk', 'raven', 'madBat', 'pterodactylChild', 'pterodactyl', 'swampMonster', 'yeti', 'blackWidow', 'mummy', 'giantRat'],
        'dragon': ['pigeon', 'woodpecker', 'duck', 'parrot', 'stork', 'blueBird', 'hen', 'redBird', 'pelican', 'seagull', 'turkey', 'vulture', 'bat', 'commonBlackbird', 'pompadourCotinga', 'falcon', 'owl', 'snowyOwl', 'eagle', 'hawk', 'raven', 'madBat', 'pig', 'cat', 'crab', 'turtle', 'snake', 'pterodactylChild', 'pterodactyl', 'meat', 'penguin', 'mammoth', 'swampMonster', 'egg', 'evilBat'],
        'phoenix': ['pigeon', 'woodpecker', 'duck', 'parrot', 'stork', 'blueBird', 'hen', 'redBird', 'pelican', 'seagull', 'turkey', 'vulture', 'bat', 'commonBlackbird', 'pompadourCotinga', 'falcon', 'owl', 'snowyOwl', 'eagle', 'hawk', 'raven', 'madBat', 'pterodactylChild', 'pterodactyl', 'swampMonster', 'yeti', 'blackWidow', 'mummy', 'crocodile', 'tyrannosaurus', 'mammoth', 'pig', 'cat', 'crab', 'turtle', 'penguin', 'snake', 'evilBat'],
        'swampMonster': ['pigeon', 'woodpecker', 'duck', 'parrot', 'stork', 'blueBird', 'hen', 'redBird', 'pelican', 'seagull', 'turkey', 'vulture', 'bat', 'commonBlackbird', 'pompadourCotinga', 'falcon', 'owl', 'snowyOwl', 'eagle', 'hawk', 'raven', 'madBat', 'frog', 'deadFish', 'demonicImp', 'poo'],
        'overfedAlienBat': [],
        'ghost': ['zombie'],
        'pumpkinCharacter': ['pumpkin'],
        'ghostlyReaper': [],
        'grimReaper': [],
        'pumpkinGhost': [],
        'frog': ['fly', 'butterfly', 'mosquito', 'wasp', 'dragonfly'],
        'pig': ['dragonfly'],
        'alienBigInsect': ['fly', 'butterfly', 'mosquito', 'wasp', 'hornet', 'dragonfly', 'pigeon', 'duck', 'parrot', 'stork', 'blueBird', 'hen', 'redBird', 'pelican', 'seagull', 'turkey', 'bat', 'vulture', 'commonBlackbird', 'pompadourCotinga', 'falcon', 'owl', 'snowyOwl', 'eagle', 'hawk', 'raven', 'madBat', 'alienBug', 'pterodactylChild', 'pterodactyl', 'demonicBat', 'swampMonster', 'dragon', 'alienAngryEye'],
        'evilBat': ['fly', 'butterfly', 'mosquito', 'wasp', 'dragonfly', 'duck', 'parrot', 'stork', 'blueBird', 'pigeon', 'hen', 'redBird', 'pelican', 'seagull', 'turkey', 'commonBlackbird', 'owl', 'pompadourCotinga', 'falcon', 'hornet', 'eagle', 'vulture', 'snowyOwl', 'hawk', 'raven'],
        'tyrannosaurus': ['fly', 'butterfly', 'mosquito', 'wasp', 'hornet', 'dragonfly', 'pigeon', 'duck', 'parrot', 'stork', 'blueBird', 'hen', 'redBird', 'pelican', 'seagull', 'turkey', 'bat', 'vulture', 'commonBlackbird', 'pompadourCotinga', 'falcon', 'owl', 'snowyOwl', 'eagle', 'hawk', 'raven', 'madBat', 'alienBug', 'pterodactylChild', 'demonicBat', 'swampMonster', 'dragon'],
        'mammoth': ['fly', 'butterfly', 'mosquito', 'wasp', 'hornet', 'dragonfly', 'pigeon', 'duck', 'parrot', 'stork', 'blueBird', 'hen', 'redBird', 'pelican', 'seagull', 'turkey', 'bat', 'vulture', 'commonBlackbird', 'pompadourCotinga', 'falcon', 'owl', 'snowyOwl', 'eagle', 'hawk', 'raven', 'madBat', 'alienBug', 'pterodactylChild', 'demonicBat', 'swampMonster', 'dragon', 'demonicImp', 'pterodactyl'],
        'smallDemon': ['fly', 'butterfly', 'mosquito', 'wasp', 'hornet', 'dragonfly', 'pigeon', 'duck', 'parrot', 'stork', 'blueBird', 'hen', 'redBird', 'pelican', 'seagull', 'turkey', 'bat', 'vulture', 'commonBlackbird', 'pompadourCotinga', 'falcon', 'owl', 'snowyOwl', 'eagle', 'hawk', 'raven', 'madBat', 'alienBug', 'pterodactylChild', 'stoneEater', 'demonicEggEater', 'demonicBat', 'swampMonster', 'dragon'],
        'blackWidow': ['fly', 'butterfly', 'mosquito', 'wasp', 'dragonfly', 'pigeon', 'duck', 'parrot', 'stork', 'blueBird', 'hen', 'redBird', 'pelican', 'seagull', 'turkey', 'bat', 'vulture', 'hornet', 'commonBlackbird', 'pompadourCotinga', 'falcon', 'owl', 'snowyOwl', 'eagle', 'hawk', 'raven', 'madBat', 'alienBug', 'pterodactylChild', 'demonicBat', 'swampMonster', 'dragon', 'demonicImp'],
        'zombie': ['fly', 'butterfly', 'mosquito', 'wasp', 'dragonfly', 'pigeon', 'duck', 'parrot', 'stork', 'blueBird', 'hen', 'redBird', 'pelican', 'seagull', 'turkey', 'bat', 'vulture', 'hornet', 'commonBlackbird', 'pompadourCotinga', 'falcon', 'owl', 'snowyOwl', 'eagle', 'hawk', 'raven', 'madBat', 'alienBug', 'pterodactylChild', 'demonicBat', 'swampMonster', 'dragon', 'phoenix', 'stoneEater', 'demonicEggEater', 'demonicImp', 'pterodactyl', 'alienBigEye', 'alienAngryEye', 'alienBat'],
        'mummy': ['fly', 'butterfly', 'mosquito', 'wasp', 'dragonfly', 'pigeon', 'duck', 'parrot', 'stork', 'blueBird', 'hen', 'redBird', 'pelican', 'seagull', 'turkey', 'bat', 'vulture', 'hornet', 'commonBlackbird', 'pompadourCotinga', 'falcon', 'owl', 'snowyOwl', 'eagle', 'hawk', 'raven', 'madBat', 'alienBug', 'pterodactylChild', 'demonicBat', 'swampMonster', 'dragon', 'demonicImp'],
        'yeti': ['fly', 'butterfly', 'mosquito', 'wasp', 'dragonfly', 'pigeon', 'duck', 'parrot', 'stork', 'blueBird', 'hen', 'redBird', 'pelican', 'seagull', 'turkey', 'bat', 'vulture', 'hornet', 'commonBlackbird', 'pompadourCotinga', 'falcon', 'owl', 'snowyOwl', 'eagle', 'hawk', 'raven', 'madBat', 'alienBug', 'pterodactylChild', 'demonicBat', 'swampMonster', 'dragon', 'demonicImp'],
        'giantRat': ['fly', 'butterfly', 'mosquito', 'wasp', 'dragonfly', 'pigeon', 'duck', 'parrot', 'stork', 'blueBird', 'hen', 'redBird', 'pelican', 'seagull', 'turkey', 'bat', 'vulture', 'hornet', 'commonBlackbird', 'pompadourCotinga', 'falcon', 'owl', 'snowyOwl', 'eagle', 'hawk', 'raven', 'madBat', 'alienBug', 'pterodactylChild', 'demonicBat', 'swampMonster', 'dragon', 'demonicImp'],
        'alienEye': ['fly', 'butterfly', 'mosquito', 'wasp', 'hornet', 'dragonfly', 'pigeon', 'duck', 'parrot', 'stork', 'blueBird', 'hen', 'redBird', 'pelican', 'seagull', 'turkey', 'bat', 'vulture', 'commonBlackbird', 'pompadourCotinga', 'falcon', 'owl', 'snowyOwl', 'eagle', 'hawk', 'raven', 'alienBug', 'pterodactylChild', 'demonicBat', 'swampMonster', 'dragon'],
        'evilRat': ['fly', 'butterfly', 'mosquito', 'wasp', 'hornet', 'dragonfly', 'pigeon', 'duck', 'parrot', 'stork', 'blueBird', 'hen', 'redBird', 'pelican', 'seagull', 'turkey', 'bat', 'madBat', 'vulture', 'commonBlackbird', 'pompadourCotinga', 'falcon', 'owl', 'snowyOwl', 'eagle', 'hawk', 'raven', 'alienBug', 'pterodactylChild'],
        'snake': ['pigeon', 'duck', 'parrot', 'stork', 'blueBird', 'hen', 'redBird', 'pelican', 'seagull', 'bat', 'vulture', 'commonBlackbird', 'pompadourCotinga', 'falcon', 'owl', 'snowyOwl', 'eagle', 'hawk'],
        'beehive': ['pigeon', 'duck', 'parrot', 'stork', 'blueBird', 'hen', 'redBird', 'pelican', 'seagull', 'bat', 'vulture', 'commonBlackbird', 'pompadourCotinga', 'falcon', 'owl', 'snowyOwl', 'eagle', 'hawk', 'turkey', 'raven', 'madBat', 'hornet'],
        'crab': ['fly', 'butterfly', 'mosquito', 'wasp', 'hornet', 'dragonfly', 'pigeon', 'duck', 'parrot', 'stork', 'blueBird', 'hen', 'redBird', 'pelican', 'seagull', 'bat', 'vulture', 'commonBlackbird', 'pompadourCotinga', 'falcon', 'owl', 'snowyOwl', 'eagle', 'hawk', 'pterodactylChild'],
        'turtle': ['fly', 'butterfly', 'mosquito', 'wasp', 'hornet', 'dragonfly', 'pigeon', 'duck', 'parrot', 'stork', 'blueBird', 'hen', 'redBird', 'pelican', 'turkey', 'seagull', 'bat', 'vulture', 'commonBlackbird', 'pompadourCotinga', 'falcon', 'owl', 'snowyOwl', 'eagle', 'hawk', 'raven', 'madBat', 'pterodactylChild'],
        'shark': ['fly', 'butterfly', 'mosquito', 'wasp', 'hornet', 'dragonfly', 'pigeon', 'duck', 'parrot', 'stork', 'blueBird', 'hen', 'redBird', 'pelican', 'seagull', 'turkey', 'bat', 'vulture', 'commonBlackbird', 'pompadourCotinga', 'falcon', 'owl', 'snowyOwl', 'eagle', 'hawk', 'raven', 'madBat', 'alienBug', 'pterodactylChild', 'demonicBat', 'swampMonster', 'pterodactyl'],
        'piranha': ['fly', 'butterfly', 'mosquito', 'wasp', 'hornet', 'dragonfly', 'pigeon', 'duck', 'parrot', 'stork', 'blueBird', 'hen', 'redBird', 'pelican', 'seagull', 'turkey', 'bat', 'vulture', 'commonBlackbird', 'pompadourCotinga', 'falcon', 'owl', 'snowyOwl', 'eagle', 'hawk', 'raven', 'madBat', 'alienBug', 'pterodactylChild', 'demonicBat', 'swampMonster', 'dragon', 'pterodactyl', 'demonicImp'],
        'crocodile': ['fly', 'butterfly', 'mosquito', 'wasp', 'hornet', 'dragonfly', 'pigeon', 'duck', 'parrot', 'stork', 'blueBird', 'hen', 'redBird', 'pelican', 'seagull', 'turkey', 'bat', 'vulture', 'commonBlackbird', 'pompadourCotinga', 'falcon', 'owl', 'snowyOwl', 'eagle', 'hawk', 'raven', 'madBat', 'alienBug', 'demonicBat', 'swampMonster', 'pterodactylChild'],
        'boss1': ['grimReaper', 'ghostlyReaper', 'pumpkinCharacter', 'pumpkinGhost', 'fly', 'butterfly', 'mosquito', 'wasp', 'dragonfly', 'pigeon', 'duck', 'parrot', 'stork', 'blueBird', 'hen', 'redBird', 'pelican', 'seagull', 'turkey', 'bat', 'vulture', 'hornet', 'commonBlackbird', 'pompadourCotinga', 'falcon', 'owl', 'snowyOwl', 'eagle', 'hawk', 'raven', 'madBat', 'alienBug', 'pterodactylChild', 'demonicBat', 'swampMonster', 'dragon', 'phoenix', 'stoneEater', 'demonicEggEater', 'demonicImp', 'pterodactyl', 'alienBigEye', 'alienAngryEye', 'alienBat', 'zombie', 'mummy', 'yeti', 'blackWidow', 'giantRat', 'alienEye', 'evilRat', 'snake', 'beehive', 'crab', 'turtle', 'shark', 'piranha', 'crocodile', 'tyrannosaurus', 'mammoth', 'smallDemon', 'alienBigInsect', 'evilBat', 'frog', 'pig', 'cat', 'mouse', 'lemming']
    };

    let autoRespawnInterval = null;
    function startAutoRespawn() {
        if (autoRespawnInterval) clearInterval(autoRespawnInterval);
        autoRespawnInterval = setInterval(() => {
            const btn = document.querySelector('.btnPlayAgain');
            if (btn && btn.offsetParent !== null) {
                btn.click();
            }
        }, 300);
    }

    const EMOTE_TYPE = 0xc;
    const emoteList = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
    let emoteTimeout = null;
    function startEmoteSpammer() {
        if (emoteTimeout) clearTimeout(emoteTimeout);
        function loop() {
            if (state.emoteSpammer && window.joinedGame && !window.imDead && window.gameServer.connected) {
                const randomId = emoteList[Math.floor(Math.random() * emoteList.length)];
                window.gameServer.emit(EMOTE_TYPE, { emoteId: randomId });
            }
            if (state.emoteSpammer) {
                let nextRun = Math.floor(Math.random() * (7000 - 3000 + 1)) + 3000;
                emoteTimeout = setTimeout(loop, nextRun);
            }
        }
        loop();
    }

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.id = 'ez-fileInput';
    fileInput.style.display = 'none';
    fileInput.accept = '.json';
    document.body.appendChild(fileInput);

    async function syncWithServer() {
        if (typeof SEND_TO_SERVER !== 'undefined' && !SEND_TO_SERVER) {
            window.esp.connected = false;
            window.esp.status = "HIDDEN";
            window.esp.list = [];
            const statusSpan = document.getElementById('esp-status');
            if (statusSpan) {
                statusSpan.textContent = window.esp.status;
                statusSpan.style.color = 'gray';
            }
            const usersSpan = document.getElementById('esp-users');
            if (usersSpan) {
                usersSpan.textContent = '0';
            }
            return;
        }

        if (!window.game || !game.me || !game.me.nick || game.me.nick === 'player_spawn') return;
        try {
            const response = await fetch(`${SERVER_URL}/sync`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nick: game.me.nick.trim() })
            });
            if (response.ok) {
                window.esp.list = await response.json();
                window.esp.connected = true;
                window.esp.status = "ONLINE";
            }
        } catch (e) {
            window.esp.status = "SERVER SLEEPING...";
        }
        
        const statusSpan = document.getElementById('esp-status');
        if (statusSpan) {
            statusSpan.textContent = window.esp.status;
            statusSpan.style.color = window.esp.connected ? 'lime' : 'orange';
        }
        
        const usersSpan = document.getElementById('esp-users');
        if (usersSpan) {
            usersSpan.textContent = window.esp.list.length;
        }
    }
    setInterval(syncWithServer, 4000);

    const gui = document.createElement('div');
    gui.id = 'ezsquad-menu';
    gui.style = 'position:fixed; top:100px; left:20px; width:420px; background:rgba(10,10,10,0.95); border:1px solid #fff; color:white; font-family:Arial; padding:10px; z-index:10001; border-radius:4px; user-select:none; box-shadow:0 0 15px #000;';
    
    let guiDragging = false;
    let guiOffsetX = 0, guiOffsetY = 0;
    
    function makeDraggable(element, handle) {
        if (!element || !handle) return;
        
        handle.onmousedown = function(e) {
            e.preventDefault();
            guiDragging = true;
            guiOffsetX = element.offsetLeft - e.clientX;
            guiOffsetY = element.offsetTop - e.clientY;
        };
    }
    
    document.onmousemove = function(e) {
        if (guiDragging) {
            gui.style.left = (e.clientX + guiOffsetX) + 'px';
            gui.style.top = (e.clientY + guiOffsetY) + 'px';
        }
    };
    
    document.onmouseup = function() {
        guiDragging = false;
    };
    
    function updateMenu() {
        let content = `
            <div id="ez-h" style="text-align:center; font-weight:bold; border-bottom:1px solid #444; margin-bottom:8px; cursor:move; padding-bottom:5px;">
                <a href="https://t.me/evoezsquad" target="_blank" style="color:#00e0ff;text-decoration:none;font-weight:bold;">https://t.me/evoezsquad</a> | 
                <span id="esp-status" style="color:${window.esp.connected ? 'lime' : 'orange'}">${window.esp.status}</span> | 
                Users: <span id="esp-users">${window.esp.list.length}</span>
            </div>
            <div style="display:flex; justify-content:space-around; margin-bottom:10px;">
                <button id="tab-visuals" style="background:${state.tab === 'visuals' ? '#444' : '#222'}; border:1px solid #555; color:white; padding:5px 10px; cursor:pointer;">Visuals</button>
                <button id="tab-misc" style="background:${state.tab === 'misc' ? '#444' : '#222'}; border:1px solid #555; color:white; padding:5px 10px; cursor:pointer;">Misc</button>
                <button id="tab-settings" style="background:${state.tab === 'settings' ? '#444' : '#222'}; border:1px solid #555; color:white; padding:5px 10px; cursor:pointer;">Settings</button>
            </div>
        `;
        if (state.tab === 'visuals') {
            content += `
                <div style="display:flex; flex-wrap:nowrap; justify-content:space-between;">
                    <div style="width:48%; border:1px solid #333; padding:5px; border-radius:4px; margin-right:4%;">
                        <div style="text-align:center; font-size:12px; border-bottom:1px solid #444; padding-bottom:3px;">Player ESP</div>
                        <div style="display:flex; align-items:center; margin:3px 0; font-size:11px;">Toggle: <input type="checkbox" id="ez-espPlayer" ${state.espPlayer ? 'checked' : ''} style="margin-left:5px;"></div>
                        <div style="display:flex; align-items:center; margin:3px 0; font-size:11px;">Name: <input type="checkbox" id="ez-espPlayerName" ${state.espPlayerShowName ? 'checked' : ''} style="margin-left:5px;"> <input type="color" id="ez-espPlayerColorName" value="${state.espPlayerColorName}" style="margin-left:5px; width:20px; height:15px;"></div>
                        <div style="display:flex; align-items:center; margin:3px 0; font-size:11px;">Tracer: <input type="checkbox" id="ez-espPlayerTracer" ${state.espPlayerShowTracer ? 'checked' : ''} style="margin-left:5px;"> <input type="color" id="ez-espPlayerColorTracer" value="${state.espPlayerColorTracer}" style="margin-left:5px; width:20px; height:15px;"></div>
                        <div style="display:flex; align-items:center; margin:3px 0; font-size:11px;">Distance: <input type="checkbox" id="ez-espPlayerDistance" ${state.espPlayerShowDistance ? 'checked' : ''} style="margin-left:5px;"> <input type="color" id="ez-espPlayerColorDistance" value="${state.espPlayerColorDistance}" style="margin-left:5px; width:20px; height:15px;"></div>
                        <div style="display:flex; align-items:center; margin:3px 0; font-size:11px;">Box: <input type="checkbox" id="ez-espPlayerBox" ${state.espPlayerShowBox ? 'checked' : ''} style="margin-left:5px;"> <input type="color" id="ez-espPlayerColorBox" value="${state.espPlayerColorBox}" style="margin-left:5px; width:20px; height:15px;"></div>
                        <div style="display:flex; align-items:center; margin:3px 0; font-size:11px;">Image: <input type="checkbox" id="ez-espPlayerImage" ${state.espPlayerShowImage ? 'checked' : ''} style="margin-left:5px;"></div>
                    </div>
                    <div style="width:48%; border:1px solid #333; padding:5px; border-radius:4px;">
                        <div style="text-align:center; font-size:12px; border-bottom:1px solid #444; padding-bottom:3px;">Danger Player</div>
                        <div style="display:flex; align-items:center; margin:3px 0; font-size:11px;">Toggle: <input type="checkbox" id="ez-espDanger" ${state.espDanger ? 'checked' : ''} style="margin-left:5px;"></div>
                        <div style="display:flex; align-items:center; margin:3px 0; font-size:11px;">Name: <input type="checkbox" id="ez-espDangerName" ${state.espDangerShowName ? 'checked' : ''} style="margin-left:5px;"> <input type="color" id="ez-espDangerColorName" value="${state.espDangerColorName}" style="margin-left:5px; width:20px; height:15px;"></div>
                        <div style="display:flex; align-items:center; margin:3px 0; font-size:11px;">Tracer: <input type="checkbox" id="ez-espDangerTracer" ${state.espDangerShowTracer ? 'checked' : ''} style="margin-left:5px;"> <input type="color" id="ez-espDangerColorTracer" value="${state.espDangerColorTracer}" style="margin-left:5px; width:20px; height:15px;"></div>
                        <div style="display:flex; align-items:center; margin:3px 0; font-size:11px;">Distance: <input type="checkbox" id="ez-espDangerDistance" ${state.espDangerShowDistance ? 'checked' : ''} style="margin-left:5px;"> <input type="color" id="ez-espDangerColorDistance" value="${state.espDangerColorDistance}" style="margin-left:5px; width:20px; height:15px;"></div>
                        <div style="display:flex; align-items:center; margin:3px 0; font-size:11px;">Box: <input type="checkbox" id="ez-espDangerBox" ${state.espDangerShowBox ? 'checked' : ''} style="margin-left:5px;"> <input type="color" id="ez-espDangerColorBox" value="${state.espDangerColorBox}" style="margin-left:5px; width:20px; height:15px;"></div>
                        <div style="display:flex; align-items:center; margin:3px 0; font-size:11px;">Image: <input type="checkbox" id="ez-espDangerImage" ${state.espDangerShowImage ? 'checked' : ''} style="margin-left:5px;"></div>
                    </div>
                </div>
                <div style="width:100%; border:1px solid #333; padding:5px; border-radius:4px; margin-top:10px;">
                    <div style="text-align:center; font-size:12px; border-bottom:1px solid #444; padding-bottom:3px;">Other ESP</div>
                    <div style="display:flex; align-items:center; margin:3px 0; font-size:11px;">Toggle: <input type="checkbox" id="ez-espOther" ${state.espOther ? 'checked' : ''} style="margin-left:5px;"></div>
                    <div style="display:flex; align-items:center; margin:3px 0; font-size:11px;">Tracer Food: <input type="checkbox" id="ez-espOtherTracerFood" ${state.espOtherShowTracerFood ? 'checked' : ''} style="margin-left:5px;"> <input type="color" id="ez-espOtherColorTracerFood" value="${state.espOtherColorTracerFood}" style="margin-left:5px; width:20px; height:15px;"></div>
                    <div style="display:flex; align-items:center; margin:3px 0; font-size:11px;">Distance Food: <input type="checkbox" id="ez-espOtherDistanceFood" ${state.espOtherShowDistanceFood ? 'checked' : ''} style="margin-left:5px;"> <input type="color" id="ez-espOtherColorDistanceFood" value="${state.espOtherColorDistanceFood}" style="margin-left:5px; width:20px; height:15px;"></div>
                    <div style="display:flex; align-items:center; margin:3px 0; font-size:11px;">Name Food: <input type="checkbox" id="ez-espOtherNameFood" ${state.espOtherShowNameFood ? 'checked' : ''} style="margin-left:5px;"> <input type="color" id="ez-espOtherColorNameFood" value="${state.espOtherColorNameFood}" style="margin-left:5px; width:20px; height:15px;"></div>
                    <div style="display:flex; align-items:center; margin:3px 0; font-size:11px;">Tracer Hide: <input type="checkbox" id="ez-espOtherTracerHide" ${state.espOtherShowTracerHide ? 'checked' : ''} style="margin-left:5px;"> <input type="color" id="ez-espOtherColorTracerHide" value="${state.espOtherColorTracerHide}" style="margin-left:5px; width:20px; height:15px;"></div>
                    <div style="display:flex; align-items:center; margin:3px 0; font-size:11px;">Distance Hide: <input type="checkbox" id="ez-espOtherDistanceHide" ${state.espOtherShowDistanceHide ? 'checked' : ''} style="margin-left:5px;"> <input type="color" id="ez-espOtherColorDistanceHide" value="${state.espOtherColorDistanceHide}" style="margin-left:5px; width:20px; height:15px;"></div>
                    <div style="display:flex; align-items:center; margin:3px 0; font-size:11px;">Name Hide: <input type="checkbox" id="ez-espOtherNameHide" ${state.espOtherShowNameHide ? 'checked' : ''} style="margin-left:5px;"> <input type="color" id="ez-espOtherColorNameHide" value="${state.espOtherColorNameHide}" style="margin-left:5px; width:20px; height:15px;"></div>
                    <div style="display:flex; align-items:center; margin:3px 0; font-size:11px;">Tracer Teleport: <input type="checkbox" id="ez-espOtherTracerTeleport" ${state.espOtherShowTracerTeleport ? 'checked' : ''} style="margin-left:5px;"> <input type="color" id="ez-espOtherColorTracerTeleport" value="${state.espOtherColorTracerTeleport}" style="margin-left:5px; width:20px; height:15px;"></div>
                    <div style="display:flex; align-items:center; margin:3px 0; font-size:11px;">Distance Teleport: <input type="checkbox" id="ez-espOtherDistanceTeleport" ${state.espOtherShowDistanceTeleport ? 'checked' : ''} style="margin-left:5px;"> <input type="color" id="ez-espOtherColorDistanceTeleport" value="${state.espOtherColorDistanceTeleport}" style="margin-left:5px; width:20px; height:15px;"></div>
                    <div style="display:flex; align-items:center; margin:3px 0; font-size:11px;">Name Teleport: <input type="checkbox" id="ez-espOtherNameTeleport" ${state.espOtherShowNameTeleport ? 'checked' : ''} style="margin-left:5px;"> <input type="color" id="ez-espOtherColorNameTeleport" value="${state.espOtherColorNameTeleport}" style="margin-left:5px; width:20px; height:15px;"></div>
                    <div style="display:flex; align-items:center; margin:3px 0; font-size:11px;">Tracer Misc: <input type="checkbox" id="ez-espOtherTracerMisc" ${state.espOtherShowTracerMisc ? 'checked' : ''} style="margin-left:5px;"> <input type="color" id="ez-espOtherColorTracerMisc" value="${state.espOtherColorTracerMisc}" style="margin-left:5px; width:20px; height:15px;"></div>
                    <div style="display:flex; align-items:center; margin:3px 0; font-size:11px;">Distance Misc: <input type="checkbox" id="ez-espOtherDistanceMisc" ${state.espOtherShowDistanceMisc ? 'checked' : ''} style="margin-left:5px;"> <input type="color" id="ez-espOtherColorDistanceMisc" value="${state.espOtherColorDistanceMisc}" style="margin-left:5px; width:20px; height:15px;"></div>
                    <div style="display:flex; align-items:center; margin:3px 0; font-size:11px;">Name Misc: <input type="checkbox" id="ez-espOtherNameMisc" ${state.espOtherShowNameMisc ? 'checked' : ''} style="margin-left:5px;"> <input type="color" id="ez-espOtherColorNameMisc" value="${state.espOtherColorNameMisc}" style="margin-left:5px; width:20px; height:15px;"></div>
                    <div style="display:flex; align-items:center; margin:3px 0; font-size:11px;">Show Image Misc: <input type="checkbox" id="ez-espOtherImageMisc" ${state.espOtherShowImageMisc ? 'checked' : ''} style="margin-left:5px;"></div>
                </div>
            `;
        } else if (state.tab === 'misc') {
            content += `
                <div style="display:flex; align-items:center; margin-bottom:5px; font-size:12px;">
                    Auto Hit: <input type="checkbox" id="ez-ah" ${state.autohit ? 'checked' : ''} style="margin-left:5px;">
                    <input type="text" id="ez-bind" value="${state.autohitBind.toUpperCase()}" style="width:20px; background:#222; border:1px solid #555; color:white; text-align:center; margin-left:5px;" readonly>
                </div>
                <div style="display:flex; align-items:center; margin-bottom:5px; font-size:12px;">Auto Flick: <input type="checkbox" id="ez-af" ${state.autoflick ? 'checked' : ''} style="margin-left:5px;">
                    <input type="text" id="ez-flick-bind" value="${state.autoflickBind.toUpperCase()}" style="width:20px; background:#222; border:1px solid #555; color:white; text-align:center; margin-left:5px;" readonly>
                </div>
                <div style="display:flex; align-items:center; margin-bottom:5px; font-size:12px;">Only Reapers: <input type="checkbox" id="ez-reap" ${state.onlyReapers ? 'checked' : ''} style="margin-left:5px;"></div>
                <div style="display:flex; align-items:center; margin-bottom:5px; font-size:12px;">Hitboxes: <input type="checkbox" id="ez-hb" ${state.hitboxes ? 'checked' : ''} style="margin-left:5px;"> <input type="color" id="ez-hb-color" value="${state.hitboxColor}" style="margin-left:5px; width:20px; height:15px;"></div>
                <div style="display:flex; align-items:center; margin-bottom:5px; font-size:12px;">Auto Respawn: <input type="checkbox" id="ez-autoRespawn" ${state.autoRespawn ? 'checked' : ''} style="margin-left:5px;"></div>
                <div style="display:flex; align-items:center; margin-bottom:5px; font-size:12px;">Emote Spammer: <input type="checkbox" id="ez-emoteSpammer" ${state.emoteSpammer ? 'checked' : ''} style="margin-left:5px;"></div>
                <div style="display:flex; align-items:center; margin-bottom:5px; font-size:12px;">Boss Timer: <input type="checkbox" id="ez-bossTimer" ${state.bossTimer ? 'checked' : ''} style="margin-left:5px;"></div>
                <div style="border-top:1px solid #333; padding-top:5px; margin-top:10px;"></div>
                <div style="display:flex; align-items:center; margin-bottom:5px; font-size:12px;">Fullbright: <input type="checkbox" id="ez-fb" ${state.fullbright ? 'checked' : ''} style="margin-left:5px;"></div>
                <div style="display:flex; align-items:center; margin-bottom:5px; font-size:12px;">Anti Fog / Reveal Invis: <input type="checkbox" id="ez-fog" ${state.antifog ? 'checked' : ''} style="margin-left:5px;"></div>
                <div style="border-top:1px solid #333; padding-top:5px; margin-top:10px;"></div>
                <div style="display:flex; align-items:center; margin-bottom:5px; font-size:12px;">Zoom Hack: <input type="checkbox" id="ez-zoomHack" ${state.zoomHackEnabled ? 'checked' : ''} style="margin-left:5px;"></div>
                <div id="ez-zoomSliderContainer" style="display:${state.zoomHackEnabled ? 'flex' : 'none'}; align-items:center; margin-bottom:5px; font-size:12px;">Zoom: <input type="range" id="ez-zoomSlider" min="0.15" max="4.30" step="0.01" value="${state.zoomValue}" style="width:150px; margin-left:5px;"><span id="ez-zoomValue" style="margin-left:5px; font-size:11px;">${state.zoomValue.toFixed(2)}x</span></div>
                
                <div style="border-top:1px solid #333; padding-top:5px; margin-top:10px;"></div>
                <div style="text-align:center; font-size:12px; margin-bottom:5px; color:#aaa;">Changer</div>
                <div style="display:flex; flex-direction:column; gap:5px; margin-bottom:5px;">
                    <select id="ez-skinType" style="background:#222; color:white; border:1px solid #555; padding:3px; width:100%;">
                        <option value="ghost">Ghost (Max: 31)</option>
                        <option value="grimReaper">Grim Reaper (Max: 112)</option>
                        <option value="ghostlyReaper">Ghostly Reaper (Max: 35)</option>
                        <option value="pumpkinGhost">Pumpkin Ghost (Max: 40)</option>
                    </select>
                    <div style="display:flex; gap:5px;">
                        <input type="number" id="ez-skinId" placeholder="ID" style="background:#222; color:white; border:1px solid #555; padding:3px; width:60px;">
                        <button id="ez-applySkin" style="flex:1; background:#222; border:1px solid #555; color:white; cursor:pointer;">Apply Skin</button>
                    </div>
                </div>
                <button id="ez-unlockPets" style="background:#222; border:1px solid #555; color:white; padding:5px; cursor:pointer; margin-top:5px; width:100%;">Pet Changer</button>
            `;
        } else if (state.tab === 'settings') {
            content += `
                <div style="display:flex; flex-direction:column; font-size:12px;">
                    <div style="display:flex; align-items:center; margin-bottom:5px;">Show Keybinds: <input type="checkbox" id="ez-showKbs" ${state.showKbs ? 'checked' : ''} style="margin-left:5px;"></div>
                    <div style="display:flex; align-items:center; margin-bottom:5px;">Menu Key: <input type="text" id="ez-menuBind" value="${state.menuBind.toUpperCase()}" style="width:30px; background:#222; border:1px solid #555; color:white; text-align:center; margin-left:5px;" readonly></div>
                    <div style="border-top:1px solid #333; padding-top:5px; margin-top:10px;">Config System</div>
                    <button id="ez-loadConfig" style="background:#222; border:1px solid #555; color:white; padding:5px; cursor:pointer; margin-top:5px;">Load Config</button>
                    <button id="ez-saveConfig" style="background:#222; border:1px solid #555; color:white; padding:5px; cursor:pointer; margin-top:5px;">Download Config</button>
                </div>
            `;
        }
        gui.innerHTML = content;

        const ezH = document.getElementById('ez-h');
        if (ezH) makeDraggable(gui, ezH);

        const tabVisuals = document.getElementById('tab-visuals');
        if (tabVisuals) tabVisuals.onclick = () => { state.tab = 'visuals'; updateMenu(); };
        const tabMisc = document.getElementById('tab-misc');
        if (tabMisc) tabMisc.onclick = () => { state.tab = 'misc'; updateMenu(); };
        const tabSettings = document.getElementById('tab-settings');
        if (tabSettings) tabSettings.onclick = () => { state.tab = 'settings'; updateMenu(); };
        
        if (state.tab === 'visuals') {
            document.getElementById('ez-espPlayer').onchange = (e) => state.espPlayer = e.target.checked;
            document.getElementById('ez-espPlayerName').onchange = (e) => state.espPlayerShowName = e.target.checked;
            document.getElementById('ez-espPlayerTracer').onchange = (e) => state.espPlayerShowTracer = e.target.checked;
            document.getElementById('ez-espPlayerDistance').onchange = (e) => state.espPlayerShowDistance = e.target.checked;
            document.getElementById('ez-espPlayerBox').onchange = (e) => state.espPlayerShowBox = e.target.checked;
            document.getElementById('ez-espPlayerImage').onchange = (e) => state.espPlayerShowImage = e.target.checked;
            document.getElementById('ez-espPlayerColorName').onchange = (e) => state.espPlayerColorName = e.target.value;
            document.getElementById('ez-espPlayerColorTracer').onchange = (e) => state.espPlayerColorTracer = e.target.value;
            document.getElementById('ez-espPlayerColorDistance').onchange = (e) => state.espPlayerColorDistance = e.target.value;
            document.getElementById('ez-espPlayerColorBox').onchange = (e) => state.espPlayerColorBox = e.target.value;

            document.getElementById('ez-espDanger').onchange = (e) => state.espDanger = e.target.checked;
            document.getElementById('ez-espDangerName').onchange = (e) => state.espDangerShowName = e.target.checked;
            document.getElementById('ez-espDangerTracer').onchange = (e) => state.espDangerShowTracer = e.target.checked;
            document.getElementById('ez-espDangerDistance').onchange = (e) => state.espDangerShowDistance = e.target.checked;
            document.getElementById('ez-espDangerBox').onchange = (e) => state.espDangerShowBox = e.target.checked;
            document.getElementById('ez-espDangerImage').onchange = (e) => state.espDangerShowImage = e.target.checked;
            document.getElementById('ez-espDangerColorName').onchange = (e) => state.espDangerColorName = e.target.value;
            document.getElementById('ez-espDangerColorTracer').onchange = (e) => state.espDangerColorTracer = e.target.value;
            document.getElementById('ez-espDangerColorDistance').onchange = (e) => state.espDangerColorDistance = e.target.value;
            document.getElementById('ez-espDangerColorBox').onchange = (e) => state.espDangerColorBox = e.target.value;

            document.getElementById('ez-espOther').onchange = (e) => state.espOther = e.target.checked;
            document.getElementById('ez-espOtherTracerFood').onchange = (e) => state.espOtherShowTracerFood = e.target.checked;
            document.getElementById('ez-espOtherDistanceFood').onchange = (e) => state.espOtherShowDistanceFood = e.target.checked;
            document.getElementById('ez-espOtherNameFood').onchange = (e) => state.espOtherShowNameFood = e.target.checked;
            document.getElementById('ez-espOtherTracerHide').onchange = (e) => state.espOtherShowTracerHide = e.target.checked;
            document.getElementById('ez-espOtherDistanceHide').onchange = (e) => state.espOtherShowDistanceHide = e.target.checked;
            document.getElementById('ez-espOtherNameHide').onchange = (e) => state.espOtherShowNameHide = e.target.checked;
            document.getElementById('ez-espOtherColorTracerFood').onchange = (e) => state.espOtherColorTracerFood = e.target.value;
            document.getElementById('ez-espOtherColorDistanceFood').onchange = (e) => state.espOtherColorDistanceFood = e.target.value;
            document.getElementById('ez-espOtherColorNameFood').onchange = (e) => state.espOtherColorNameFood = e.target.value;
            document.getElementById('ez-espOtherColorTracerHide').onchange = (e) => state.espOtherColorTracerHide = e.target.value;
            document.getElementById('ez-espOtherColorDistanceHide').onchange = (e) => state.espOtherColorDistanceHide = e.target.value;
            document.getElementById('ez-espOtherColorNameHide').onchange = (e) => state.espOtherColorNameHide = e.target.value;
            document.getElementById('ez-espOtherTracerTeleport').onchange = (e) => state.espOtherShowTracerTeleport = e.target.checked;
            document.getElementById('ez-espOtherDistanceTeleport').onchange = (e) => state.espOtherShowDistanceTeleport = e.target.checked;
            document.getElementById('ez-espOtherNameTeleport').onchange = (e) => state.espOtherShowNameTeleport = e.target.checked;
            document.getElementById('ez-espOtherColorTracerTeleport').onchange = (e) => state.espOtherColorTracerTeleport = e.target.value;
            document.getElementById('ez-espOtherColorDistanceTeleport').onchange = (e) => state.espOtherColorDistanceTeleport = e.target.value;
            document.getElementById('ez-espOtherColorNameTeleport').onchange = (e) => state.espOtherColorNameTeleport = e.target.value;
            document.getElementById('ez-espOtherTracerMisc').onchange = (e) => state.espOtherShowTracerMisc = e.target.checked;
            document.getElementById('ez-espOtherDistanceMisc').onchange = (e) => state.espOtherShowDistanceMisc = e.target.checked;
            document.getElementById('ez-espOtherNameMisc').onchange = (e) => state.espOtherShowNameMisc = e.target.checked;
            document.getElementById('ez-espOtherImageMisc').onchange = (e) => state.espOtherShowImageMisc = e.target.checked;
            document.getElementById('ez-espOtherColorTracerMisc').onchange = (e) => state.espOtherColorTracerMisc = e.target.value;
            document.getElementById('ez-espOtherColorDistanceMisc').onchange = (e) => state.espOtherColorDistanceMisc = e.target.value;
            document.getElementById('ez-espOtherColorNameMisc').onchange = (e) => state.espOtherColorNameMisc = e.target.value;
        } else if (state.tab === 'misc') {
            document.getElementById('ez-ah').onchange = (e) => { state.autohit = e.target.checked; updateKbs(); };
            document.getElementById('ez-af').onchange = (e) => { state.autoflick = e.target.checked; updateKbs(); };
            document.getElementById('ez-reap').onchange = (e) => { state.onlyReapers = e.target.checked; updateKbs(); };
            const autohitBindInput = document.getElementById('ez-bind');
            if (autohitBindInput) {
                autohitBindInput.onclick = () => {
                    autohitBindInput.value = '...';
                    const listener = (ev) => {
                        state.autohitBind = ev.key.toLowerCase();
                        autohitBindInput.value = state.autohitBind.toUpperCase();
                        updateKbs();
                        document.removeEventListener('keydown', listener);
                    };
                    document.addEventListener('keydown', listener);
                };
            }
            const autoflickBindInput = document.getElementById('ez-flick-bind');
            if (autoflickBindInput) {
                autoflickBindInput.onclick = () => {
                    autoflickBindInput.value = '...';
                    const listener = (ev) => {
                        state.autoflickBind = ev.key.toLowerCase();
                        autoflickBindInput.value = state.autoflickBind.toUpperCase();
                        updateKbs();
                        document.removeEventListener('keydown', listener);
                    };
                    document.addEventListener('keydown', listener);
                };
            }
            document.getElementById('ez-hb').onchange = (e) => state.hitboxes = e.target.checked;
            document.getElementById('ez-hb-color').onchange = (e) => state.hitboxColor = e.target.value;
            document.getElementById('ez-autoRespawn').onchange = (e) => {
                state.autoRespawn = e.target.checked;
                if (state.autoRespawn) {
                    startAutoRespawn();
                } else {
                    if (autoRespawnInterval) clearInterval(autoRespawnInterval);
                }
            };
            document.getElementById('ez-emoteSpammer').onchange = (e) => {
                state.emoteSpammer = e.target.checked;
                if (state.emoteSpammer) startEmoteSpammer();
            };
            document.getElementById('ez-bossTimer').onchange = (e) => {
                state.bossTimer = e.target.checked;
                toggleBossTimer(state.bossTimer);
            };
            document.getElementById('ez-fb').onchange = (e) => { 
                state.fullbright = e.target.checked; 
                window.fullBrightEnabled = state.fullbright; 
                if (!state.fullbright) {
                    if (game.canvas) {
                        const ctx = game.canvas.getContext('2d');
                        if (ctx) {
                            ctx.globalAlpha = 1.0;
                            ctx.restore();
                        }
                    }
                    if (game.clearStaticObjects) game.clearStaticObjects();
                }
            };
            document.getElementById('ez-fog').onchange = (e) => { state.antifog = e.target.checked; };
            document.getElementById('ez-zoomHack').onchange = (e) => {
                state.zoomHackEnabled = e.target.checked;
                const sliderContainer = document.getElementById('ez-zoomSliderContainer');
                if (sliderContainer) {
                    sliderContainer.style.display = state.zoomHackEnabled ? 'flex' : 'none';
                }
                if (state.zoomHackEnabled) {
                    initZoomMod();
                } else {
                    cleanupZoomMod();
                }
                updateMenu();
            };
            const zoomSlider = document.getElementById('ez-zoomSlider');
            const zoomValue = document.getElementById('ez-zoomValue');
            if (zoomSlider) {
                zoomSlider.oninput = function() {
                    const val = parseFloat(this.value);
                    state.zoomValue = val;
                    if (zoomValue) zoomValue.textContent = val.toFixed(2) + 'x';
                    if (state.zoomHackEnabled && window.customZoom !== undefined) {
                        window.customZoom = val;
                        if (window.game && game.setZoom) game.setZoom(val);
                    }
                };
            }
            document.getElementById('ez-unlockPets').onclick = initPetChanger;
            document.getElementById('ez-applySkin').onclick = function() {
                const t = document.getElementById('ez-skinType').value;
                const i = parseInt(document.getElementById('ez-skinId').value);
                if (t && !isNaN(i)) applySkin(t, i);
            };
        } else if (state.tab === 'settings') {
            document.getElementById('ez-showKbs').onchange = (e) => { state.showKbs = e.target.checked; kbs.style.display = state.showKbs ? 'block' : 'none'; };
            const menuBindInput = document.getElementById('ez-menuBind');
            if (menuBindInput) {
                menuBindInput.onclick = () => {
                    menuBindInput.value = '...';
                    const listener = (ev) => {
                        state.menuBind = ev.key.toLowerCase();
                        menuBindInput.value = state.menuBind.toUpperCase();
                        updateKbs();
                        document.removeEventListener('keydown', listener);
                    };
                    document.addEventListener('keydown', listener);
                };
            }
            document.getElementById('ez-loadConfig').onclick = () => document.getElementById('ez-fileInput').click();
            document.getElementById('ez-saveConfig').onclick = () => {
                const data = JSON.stringify(state, null, 2);
                const encryptedData = btoa(data);
                const blob = new Blob([encryptedData], {type: 'application/json'});
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'ezsquad_config.enc.json';
                a.click();
                URL.revokeObjectURL(url);
            };
        }
    }

    document.body.appendChild(gui);
    updateMenu();

    fileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const encryptedData = ev.target.result;
                    const data = atob(encryptedData);
                    const loadedState = JSON.parse(data);
                    Object.assign(state, loadedState);
                    updateMenu();
                    updateKbs();
                    kbs.style.display = state.showKbs ? 'block' : 'none';
                    if (state.autoRespawn) startAutoRespawn();
                    if (state.emoteSpammer) startEmoteSpammer();
                    if (state.bossTimer) toggleBossTimer(true);
                    window.fullBrightEnabled = state.fullbright;
                    if (state.zoomHackEnabled) {
                        setTimeout(() => {
                            if (findGame()) initZoomMod();
                        }, 500);
                    }
                } catch (err) {}
            };
            reader.readAsText(file);
        }
    };

    const kbs = document.createElement('div');
    kbs.id = 'ez-keybinds';
    kbs.style = 'position:fixed; top:100px; right:20px; width:160px; background:rgba(0,0,0,0.85); border:1px solid #fff; color:white; font-family:monospace; padding:8px; z-index:10001; border-radius:4px; display:' + (state.showKbs ? 'block' : 'none') + ';';
    kbs.innerHTML = `<div id="kb-h" style="cursor:move; border-bottom:1px solid #555; margin-bottom:5px; text-align:center; font-size:11px;">KEYBINDS</div><div id="kb-c" style="font-size:10px;"></div>`;
    document.body.appendChild(kbs);

    let kbsDragging = false;
    let kbsOffsetX = 0, kbsOffsetY = 0;
    
    const kbH = document.getElementById('kb-h');
    if (kbH) {
        kbH.onmousedown = function(e) {
            e.preventDefault();
            e.stopPropagation();
            kbsDragging = true;
            kbsOffsetX = kbs.offsetLeft - e.clientX;
            kbsOffsetY = kbs.offsetTop - e.clientY;
        };
    }
    
    document.addEventListener('mousemove', function(e) {
        if (kbsDragging) {
            kbs.style.left = (e.clientX + kbsOffsetX) + 'px';
            kbs.style.top = (e.clientY + kbsOffsetY) + 'px';
        }
    });
    
    document.addEventListener('mouseup', function() {
        kbsDragging = false;
    });

    function updateKbs() {
        const kbC = document.getElementById('kb-c');
        if (kbC) {
            kbC.innerHTML = `
                <div>[${state.autohitBind.toUpperCase()}] Autohit: <span style="color:${state.autohit?'#0f0':'#f00'}">${state.autohit?'ON':'OFF'}</span></div>
                <div>[${state.autoflickBind.toUpperCase()}] Autoflick: <span style="color:${state.autoflick?'#0f0':'#f00'}">${state.autoflick?'ON':'OFF'}</span></div>
                <div>[${state.menuBind.toUpperCase()}] Menu Toggle</div>
                <div>Reapers Only: <span style="color:${state.onlyReapers?'#0f0':'#f00'}">${state.onlyReapers?'ON':'OFF'}</span></div>
            `;
        }
    }
    updateKbs();

    window.onkeydown = (e) => {
        if (e.key.toLowerCase() === state.menuBind) { state.menuOpen = !state.menuOpen; gui.style.display = state.menuOpen?'block':'none'; }
        if (e.key.toLowerCase() === state.autohitBind) { state.autohit = !state.autohit; const ezAh = document.getElementById('ez-ah'); if (ezAh) ezAh.checked = state.autohit; updateKbs(); }
        if (e.key.toLowerCase() === state.autoflickBind) { state.autoflick = !state.autoflick; const ezAf = document.getElementById('ez-af'); if (ezAf) ezAf.checked = state.autoflick; updateKbs(); }
    };

    let game = null;
    const oldOverlay = document.getElementById('ez-overlay');
    if (oldOverlay) oldOverlay.remove();
    
    let gameCanvas = document.getElementById('canvasGame');
    const overlay = document.createElement('canvas');
    overlay.id = 'ez-overlay';
    overlay.style.position = 'absolute';
    overlay.style.pointerEvents = 'none';
    overlay.style.zIndex = '10000';
    document.body.appendChild(overlay);
    let ctx = overlay.getContext('2d');

    function resizeOverlay() {
        gameCanvas = document.getElementById('canvasGame');
        if (!gameCanvas) return;
        overlay.width = gameCanvas.width;
        overlay.height = gameCanvas.height;
        overlay.style.top = gameCanvas.style.marginTop || '0px';
        overlay.style.left = gameCanvas.style.marginLeft || '0px';
        overlay.style.width = gameCanvas.style.width;
        overlay.style.height = gameCanvas.style.height;
    }

    window.addEventListener('resize', resizeOverlay);
    resizeOverlay();

    function findGame() {
        if (window.game && window.game.me && window.game.gameObjects &&
            typeof window.game.getRenderPosition === 'function' && window.game.canvas) {
            game = window.game;
            return true;
        }
        return false;
    }

    const characterImages = new Map();

    function render() {
        try {
            if (!findGame()) {
                requestAnimationFrame(render);
                return;
            }
            
            gameCanvas = document.getElementById('canvasGame');
            if (!gameCanvas) {
                requestAnimationFrame(render);
                return;
            }
            
            if (overlay.width !== gameCanvas.width) resizeOverlay();
            ctx.clearRect(0, 0, overlay.width, overlay.height);
            
            if (!game.me || !game.me.position || !game.me.width || !game.me.height || game.me.deleted) {
                requestAnimationFrame(render);
                return;
            }
            
            const zoom = game.zoom || 1;
            const scaleX = (game.scaleX || 1) * zoom;
            const scaleY = (game.scaleY || 1) * zoom;
            
            const myRaw = game.getRenderPosition(game.me.position.x, game.me.position.y);
            if (!myRaw) {
                requestAnimationFrame(render);
                return;
            }
            const myX = myRaw.x + (game.me.width * scaleX) / 2;
            const myY = myRaw.y - (game.me.height * scaleY) / 2;

            if (state.hitboxes) {
                let visible = [];
                let useGameObjects = false;
                if (state.zoomHackEnabled && syncTrackingEnabled) {
                    if (game.gameObjects) {
                        for (let id in game.gameObjects) {
                            const obj = game.gameObjects[id];
                            if (obj && obj.type === 0x1 && (syncedObjects.has(obj.id) || syncedObjects.has(parseInt(obj.id)))) {
                                visible.push(obj);
                            }
                        }
                    }
                } else {
                    try {
                        visible = game.hashMap?.retrieveVisibleByClient(game) || [];
                    } catch(e) {
                        visible = [];
                        useGameObjects = true;
                    }
                    if (!visible || visible.length === 0) {
                        useGameObjects = true;
                    }
                    if (useGameObjects && game.gameObjects) {
                        visible = [];
                        for (let id in game.gameObjects) {
                            const obj = game.gameObjects[id];
                            if (obj && obj.type === 0x1 && obj !== game.me && !obj.deleted && obj.position) {
                                visible.push(obj);
                            }
                        }
                    }
                }
                visible.forEach(p => {
                    if (!p || p.deleted || p.hp <= 0 || !REAPER_TYPES.has(p.name)) return;

                    const enemyRaw = game.getRenderPosition(p.position.x, p.position.y);
                    if (!enemyRaw) return;

                    const enemyX = enemyRaw.x + (p.width * scaleX) / 2;
                    const enemyY = enemyRaw.y - (p.height * scaleY) / 2;
                    
                    const margin = 300 * zoom;
                    if (enemyX < -margin || enemyX > overlay.width + margin ||
                        enemyY < -margin || enemyY > overlay.height + margin) {
                        return;
                    }
                    
                    if (p.colliderRectangleOffset) {
                        const colliderLeft = enemyRaw.x + p.colliderRectangleOffset.left * p.width * scaleX;
                        const colliderTop = enemyRaw.y - p.height * scaleY + p.colliderRectangleOffset.top * p.height * scaleY;
                        const colliderWidth = p.width * scaleX * (1 - p.colliderRectangleOffset.right - p.colliderRectangleOffset.left);
                        const colliderHeight = p.height * scaleY * (1 - p.colliderRectangleOffset.top - p.colliderRectangleOffset.bottom);
                        
                        ctx.lineWidth = 1;
                        ctx.strokeStyle = '#000000';
                        ctx.strokeRect(colliderLeft, colliderTop, colliderWidth, colliderHeight);
                    }
                    
                    const scythe = SCYTHE_OFFSETS[p.name];
                    if (scythe) {
                        const w = scythe.width * game.scaleX * zoom;
                        const h = scythe.height * game.scaleY * zoom;
                        
                        let drawX;
                        if (p.direction === 1 || p.direction > 0) {
                            drawX = enemyX + scythe.left * game.scaleX * zoom;
                        } else {
                            drawX = enemyX - scythe.left * game.scaleX * zoom - w;
                        }
                        
                        const drawY = enemyY - scythe.top * game.scaleY * zoom;
                        ctx.lineWidth = 2;
                        ctx.strokeStyle = state.hitboxColor;
                        ctx.strokeRect(drawX, drawY, w, h);
                    }
                });
            }

            if (window.esp.connected && game.gameObjects) {
                for (let id in game.gameObjects) {
                    const obj = game.gameObjects[id];
                    if (obj && obj.type === 1 && obj !== game.me && !obj.deleted && obj.nick) {
                        if (window.esp.list.includes(obj.nick.trim())) {
                            const friendRaw = game.getRenderPosition(obj.position.x, obj.position.y);
                            if (!friendRaw) continue;

                            const friendX = friendRaw.x + (obj.width * scaleX) / 2;
                            const friendY = friendRaw.y - (obj.height * scaleY) / 2;

                            const margin = 300 * zoom;
                            if (friendX < -margin || friendX > overlay.width + margin ||
                                friendY < -margin || friendY > overlay.height + margin) {
                                continue;
                            }

                            const size = 45 * zoom;
                            if (scriptIcon.complete) {
                                ctx.save();
                                ctx.drawImage(
                                    scriptIcon, 
                                    friendX - size / 2, 
                                    friendY + 10, 
                                    size, 
                                    size
                                );
                                ctx.restore();
                            }
                        }
                    }
                }
            }

            let visible = [];
            let useGameObjects = false;
            if (state.zoomHackEnabled && syncTrackingEnabled) {
                if (game.gameObjects) {
                    for (let id in game.gameObjects) {
                        const obj = game.gameObjects[id];
                        if (obj && obj.type === 0x1 && syncedObjects.has(obj.id)) {
                            visible.push(obj);
                        }
                    }
                }
            } else {
                try {
                    visible = game.hashMap?.retrieveVisibleByClient(game) || [];
                } catch(e) {
                    visible = [];
                    useGameObjects = true;
                }
                if (!visible || visible.length === 0) {
                    useGameObjects = true;
                }
                if (useGameObjects && game.gameObjects) {
                    visible = [];
                    for (let id in game.gameObjects) {
                        const obj = game.gameObjects[id];
                        if (obj && obj.type === 0x1 && obj !== game.me && !obj.deleted && obj.position) {
                            visible.push(obj);
                        }
                    }
                }
            }

            visible.forEach(obj => {
                if (!obj || obj === game.me || obj.type !== 0x1 || !obj.position || !obj.width || !obj.height || !obj.name || obj.deleted) return;
                
                const objCenterX = obj.position.x;
                const objCenterY = obj.position.y;
                const objRaw = game.getRenderPosition(obj.position.x, obj.position.y);
                if (!objRaw) return;
                
                const objX = objRaw.x + (obj.width * scaleX) / 2;
                const objY = objRaw.y - (obj.height * scaleY) / 2;
                const tl = objRaw;
                
                let isDanger = false;
                let isEatable = eaters[game.me.name] && eaters[game.me.name].includes(obj.name);
                let isMutual = false;
                let isGhost = obj.name === 'ghost';
                let colorName = state.espPlayerColorName;
                let colorTracer = state.espPlayerColorTracer;
                let colorDistance = state.espPlayerColorDistance;
                let colorBox = state.espPlayerColorBox;
                let showName = state.espPlayerShowName;
                let showTracer = state.espPlayerShowTracer;
                let showDistance = state.espPlayerShowDistance;
                let showBox = state.espPlayerShowBox;
                let showImage = state.espPlayerShowImage;
                let lineWidth = 3;
                let isHidden = obj.inHide === true;

                if (eaters[obj.name] && eaters[obj.name].includes(game.me.name)) {
                    isDanger = true;
                }
                if (REAPER_TYPES.has(obj.name)) {
                    isDanger = true;
                }
                if (isDanger && eaters[game.me.name] && eaters[game.me.name].includes(obj.name)) {
                    isMutual = true;
                }
                if (REAPER_TYPES.has(obj.name) && REAPER_TYPES.has(game.me.name)) {
                    isMutual = true;
                }
                if (isDanger && state.espDanger) {
                    showName = state.espDangerShowName;
                    showTracer = state.espDangerShowTracer;
                    showDistance = state.espDangerShowDistance;
                    showBox = state.espDangerShowBox;
                    showImage = state.espDangerShowImage;
                    colorName = state.espDangerColorName;
                    colorTracer = state.espDangerColorTracer;
                    colorDistance = state.espDangerColorDistance;
                    colorBox = state.espDangerColorBox;
                } else if (isDanger && !state.espDanger && !state.espPlayer) {
                    return;
                }
                if (!state.espPlayer && !state.espDanger) {
                    return;
                }
                if (state.espPlayer && !state.espDanger && isDanger) {
                    showName = state.espPlayerShowName;
                    showTracer = state.espPlayerShowTracer;
                    showDistance = state.espPlayerShowDistance;
                    showBox = state.espPlayerShowBox;
                    showImage = state.espPlayerShowImage;
                    colorName = state.espPlayerColorName;
                    colorTracer = state.espPlayerColorTracer;
                    colorDistance = state.espPlayerColorDistance;
                    colorBox = state.espPlayerColorBox;
                }
                if (isMutual) {
                    colorName = '#ffa500';
                    colorTracer = '#ffa500';
                    colorDistance = '#ffa500';
                    colorBox = '#ffa500';
                }
                if (isGhost) {
                    colorName = '#000000';
                    colorTracer = '#000000';
                    colorDistance = '#000000';
                    colorBox = '#000000';
                }
                if (isHidden) {
                    lineWidth = 5;
                }
                if (isEatable) {
                    return;
                }
                if (state.espPlayer || (state.espDanger && isDanger)) {
                    const meCenterX = game.me.position.x;
                    const meCenterY = game.me.position.y;
                    const dist = Math.hypot(objCenterX - meCenterX, objCenterY - meCenterY);

                    if (showTracer) {
                        ctx.strokeStyle = colorTracer;
                        ctx.lineWidth = lineWidth;
                        ctx.globalAlpha = isHidden ? 1.0 : 0.8;
                        ctx.lineCap = 'round';
                        ctx.beginPath();
                        ctx.moveTo(myX, myY);
                        ctx.lineTo(objX, objY);
                        ctx.stroke();
                    }

                    if (showBox) {
                        const br = game.getRenderPosition(obj.position.x + obj.width, obj.position.y + obj.height);
                        if (br) {
                            ctx.strokeStyle = colorBox;
                            ctx.lineWidth = lineWidth + 1;
                            ctx.globalAlpha = 1.0;
                            ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
                        }
                    }

                    if (showName) {
                        const name = obj.nick || obj.name || '???';
                        const textY = objY - (obj.height * scaleY) / 1.5;
                        ctx.save();
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'bottom';
                        ctx.font = `bold ${Math.max(12, 14 * zoom)}px Arial`;
                        ctx.strokeStyle = 'black';
                        ctx.lineWidth = 3;
                        ctx.strokeText(name, objX, textY);
                        ctx.fillStyle = colorName;
                        ctx.fillText(name, objX, textY);
                        ctx.restore();
                    }

                    if (showDistance) {
                        const distText = Math.round(dist) + 'm';
                        const midX = (myX + objX) / 2;
                        const midY = (myY + objY) / 2;
                        ctx.save();
                        ctx.globalAlpha = 1.0;
                        ctx.font = `bold ${Math.max(10, 14 * zoom)}px Arial`;
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.strokeStyle = 'black';
                        ctx.lineWidth = 3 * zoom;
                        ctx.strokeText(distText, midX, midY);
                        ctx.fillStyle = colorDistance;
                        ctx.fillText(distText, midX, midY);
                        ctx.restore();
                    }

                    if (showImage && dist > 330) {
                        if (!characterImages.has(obj.name)) {
                            const img = new Image();
                            const base = `https://cdn.eu.evoworld.io/sprites/characters/${obj.name}`;
                            const possiblePaths = [
                                '/1.png',
                                '/flying/1.png',
                                '/standard/1.png',
                                '/standard/flying/1.png',
                                '/red/1.png',
                                '/red/flying/1.png',
                                '/cyborg/flying/1.png',
                                '/doctor/flying/1.png'
                            ];
                            let pathIndex = 0;
                            img.onerror = () => {
                                pathIndex++;
                                if (pathIndex < possiblePaths.length) {
                                    img.src = base + possiblePaths[pathIndex];
                                }
                            };
                            img.onload = () => {
                                characterImages.set(obj.name, img);
                            };
                            img.src = base + possiblePaths[0];
                        }
                        const img = characterImages.get(obj.name);
                        if (img) {
                            const dx = objX - myX;
                            const dy = objY - myY;
                            const length = Math.hypot(dx, dy);
                            if (length > 0) {
                                const nx = dx / length;
                                const ny = dy / length;
                                const offset = (obj.radius || 60) * 1.6 * zoom;
                                const imgX = myX + nx * offset - 20;
                                const imgY = myY + ny * offset - 20;
                                ctx.drawImage(img, imgX, imgY, 40 * zoom, 40 * zoom);
                            }
                        }
                    }
                }
            });

            if (state.espOther) {
                let otherVisible = [];
                try {
                    otherVisible = game.hashMap?.retrieveVisibleByClient(game) || [];
                } catch(e) {
                    otherVisible = [];
                }
                if (!otherVisible || otherVisible.length === 0) {
                    if (game.gameObjects) {
                        for (let id in game.gameObjects) {
                            const obj = game.gameObjects[id];
                            if (obj && (obj.type === 0x1 || obj.type === 0x3 || obj.type === 0xa || obj.type === 0x8 || obj.type === 0x9 || obj.type === 0x5) && !obj.deleted) {
                                otherVisible.push(obj);
                            }
                        }
                    }
                }
                otherVisible.forEach(obj => {
                    if (!obj || (obj.type !== 0x1 && obj.type !== 0x3 && obj.type !== 0xa && obj.type !== 0x8 && obj.type !== 0x9 && obj.type !== 0x5) || !obj.position || !obj.width || !obj.height || obj.deleted) return;
                    
                    const objCenterX = obj.position.x;
                    const objCenterY = obj.position.y;
                    const objRaw = game.getRenderPosition(obj.position.x, obj.position.y);
                    if (!objRaw) return;
                    
                    const objX = objRaw.x + (obj.width * scaleX) / 2;
                    const objY = objRaw.y - (obj.height * scaleY) / 2;
                    const tl = objRaw;
                    
                    const margin = 300 * zoom;
                    if (objX < -margin || objX > overlay.width + margin ||
                        objY < -margin || objY > overlay.height + margin) {
                        return;
                    }
                    
                    const meCenterX = game.me.position.x;
                    const meCenterY = game.me.position.y;
                        
                    if (eaters[game.me.name] && eaters[game.me.name].includes(obj.name)) {
                        if (state.espOtherShowTracerFood) {
                            ctx.strokeStyle = state.espOtherColorTracerFood;
                            ctx.lineWidth = 2 * zoom;
                            ctx.globalAlpha = 0.7;
                            ctx.lineCap = 'round';
                            ctx.beginPath();
                            ctx.moveTo(myX, myY);
                            ctx.lineTo(objX, objY);
                            ctx.stroke();
                        }

                        if (state.espOtherShowDistanceFood) {
                            const dist = Math.hypot(objCenterX - meCenterX, objCenterY - meCenterY);
                            const distText = Math.round(dist) + 'm';
                            const midX = (myX + objX) / 2;
                            const midY = (myY + objY) / 2;
                            ctx.save();
                            ctx.globalAlpha = 1.0;
                            ctx.font = `bold ${Math.max(8, 12 * zoom)}px Arial`;
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'middle';
                            ctx.strokeStyle = 'black';
                            ctx.lineWidth = 2 * zoom;
                            ctx.strokeText(distText, midX, midY);
                            ctx.fillStyle = state.espOtherColorDistanceFood;
                            ctx.fillText(distText, midX, midY);
                            ctx.restore();
                        }

                        if (state.espOtherShowNameFood) {
                            const name = obj.nick || obj.name || '';
                            const textY = objY - (obj.height * scaleY) / 1.5;
                            ctx.save();
                            ctx.globalAlpha = 1.0;
                            ctx.fillStyle = state.espOtherColorNameFood;
                            ctx.font = `bold ${Math.max(8, 12 * zoom)}px Arial`;
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'bottom';
                            ctx.strokeStyle = 'black';
                            ctx.lineWidth = 2 * zoom;
                            ctx.strokeText(name, objX, textY);
                            ctx.fillText(name, objX, textY);
                            ctx.restore();
                        }
                    }
                    
                    if (obj.type === 0x5) {
                        if (state.espOtherShowTracerHide) {
                            ctx.strokeStyle = state.espOtherColorTracerHide;
                            ctx.lineWidth = 3 * zoom;
                            ctx.globalAlpha = 0.8;
                            ctx.lineCap = 'round';
                            ctx.beginPath();
                            ctx.moveTo(myX, myY);
                            ctx.lineTo(objX, objY);
                            ctx.stroke();
                        }

                        if (state.espOtherShowDistanceHide) {
                            const dist = Math.hypot(objCenterX - meCenterX, objCenterY - meCenterY);
                            const distText = Math.round(dist) + 'm';
                            const midX = (myX + objX) / 2;
                            const midY = (myY + objY) / 2;
                            ctx.save();
                            ctx.globalAlpha = 1.0;
                            ctx.font = `bold ${Math.max(8, 12 * zoom)}px Arial`;
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'middle';
                            ctx.strokeStyle = 'black';
                            ctx.lineWidth = 2 * zoom;
                            ctx.strokeText(distText, midX, midY);
                            ctx.fillStyle = state.espOtherColorDistanceHide;
                            ctx.fillText(distText, midX, midY);
                            ctx.restore();
                        }

                        if (state.espOtherShowNameHide) {
                            const name = obj.nick || obj.name || 'Hide';
                            const textY = objY - (obj.height * scaleY) / 1.5;
                            ctx.save();
                            ctx.globalAlpha = 1.0;
                            ctx.fillStyle = state.espOtherColorNameHide;
                            ctx.font = `bold ${Math.max(8, 12 * zoom)}px Arial`;
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'bottom';
                            ctx.strokeStyle = 'black';
                            ctx.lineWidth = 2 * zoom;
                            ctx.strokeText(name, objX, textY);
                            ctx.fillText(name, objX, textY);
                            ctx.restore();
                        }
                    }
                    
                    if (obj.type === 0x8) {
                        if (state.espOtherShowTracerTeleport) {
                            ctx.strokeStyle = state.espOtherColorTracerTeleport;
                            ctx.lineWidth = 2 * zoom;
                            ctx.globalAlpha = 0.8;
                            ctx.lineCap = 'round';
                            ctx.beginPath();
                            ctx.moveTo(myX, myY);
                            ctx.lineTo(objX, objY);
                            ctx.stroke();
                        }

                        if (state.espOtherShowDistanceTeleport) {
                            const dist = Math.hypot(objCenterX - meCenterX, objCenterY - meCenterY);
                            const distText = Math.round(dist) + 'm';
                            const midX = (myX + objX) / 2;
                            const midY = (myY + objY) / 2;
                            ctx.save();
                            ctx.globalAlpha = 1.0;
                            ctx.font = `bold ${Math.max(8, 12 * zoom)}px Arial`;
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'middle';
                            ctx.strokeStyle = 'black';
                            ctx.lineWidth = 2 * zoom;
                            ctx.strokeText(distText, midX, midY);
                            ctx.fillStyle = state.espOtherColorDistanceTeleport;
                            ctx.fillText(distText, midX, midY);
                            ctx.restore();
                        }

                        if (state.espOtherShowNameTeleport) {
                            const name = obj.nick || obj.name || 'Teleport';
                            const textY = objY - (obj.height * scaleY) / 1.5;
                            ctx.save();
                            ctx.globalAlpha = 1.0;
                            ctx.fillStyle = state.espOtherColorNameTeleport;
                            ctx.font = `bold ${Math.max(8, 12 * zoom)}px Arial`;
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'bottom';
                            ctx.strokeStyle = 'black';
                            ctx.lineWidth = 2 * zoom;
                            ctx.strokeText(name, objX, textY);
                            ctx.fillText(name, objX, textY);
                            ctx.restore();
                        }
                    }
                    
                    if (obj.type === 0x9) {
                        if (state.espOtherShowTracerMisc) {
                            ctx.strokeStyle = state.espOtherColorTracerMisc;
                            ctx.lineWidth = 2 * zoom;
                            ctx.globalAlpha = 0.8;
                            ctx.lineCap = 'round';
                            ctx.beginPath();
                            ctx.moveTo(myX, myY);
                            ctx.lineTo(objX, objY);
                            ctx.stroke();
                        }

                        if (state.espOtherShowDistanceMisc) {
                            const dist = Math.hypot(objCenterX - meCenterX, objCenterY - meCenterY);
                            const distText = Math.round(dist) + 'm';
                            const midX = (myX + objX) / 2;
                            const midY = (myY + objY) / 2;
                            ctx.save();
                            ctx.globalAlpha = 1.0;
                            ctx.font = `bold ${Math.max(8, 12 * zoom)}px Arial`;
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'middle';
                            ctx.strokeStyle = 'black';
                            ctx.lineWidth = 2 * zoom;
                            ctx.strokeText(distText, midX, midY);
                            ctx.fillStyle = state.espOtherColorDistanceMisc;
                            ctx.fillText(distText, midX, midY);
                            ctx.restore();
                        }

                        if (state.espOtherShowNameMisc) {
                            const name = obj.nick || obj.name || 'Misc';
                            const textY = objY - (obj.height * scaleY) / 1.5;
                            ctx.save();
                            ctx.globalAlpha = 1.0;
                            ctx.fillStyle = state.espOtherColorNameMisc;
                            ctx.font = `bold ${Math.max(8, 12 * zoom)}px Arial`;
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'bottom';
                            ctx.strokeStyle = 'black';
                            ctx.lineWidth = 2 * zoom;
                            ctx.strokeText(name, objX, textY);
                            ctx.fillText(name, objX, textY);
                            ctx.restore();
                        }
                        
                        if (state.espOtherShowImageMisc) {
                            const miscImageNames = ['crate', 'easterRabbit', 'fireball', 'gem', 'roots', 'shuriken', 'snowball'];
                            if (miscImageNames.includes(obj.name)) {
                                if (!characterImages.has(obj.name)) {
                                    const img = new Image();
                                    const cdn = window.cdnServer || "https://evoworld.io/";
                                    let imgPath;
                                    switch(obj.name) {
                                        case 'crate': imgPath = `${cdn}sprites/misc/crate/1.png`; break;
                                        case 'easterRabbit': imgPath = `${cdn}sprites/misc/easterRabbit/idle/1.png`; break;
                                        case 'fireball': imgPath = `${cdn}sprites/misc/fireball/1.png`; break;
                                        case 'gem': imgPath = `${cdn}sprites/misc/gem/1.png`; break;
                                        case 'roots': imgPath = `${cdn}sprites/misc/roots.png`; break;
                                        case 'shuriken': imgPath = `${cdn}sprites/misc/shuriken.png`; break;
                                        case 'snowball': imgPath = `${cdn}sprites/misc/snowball.png`; break;
                                    }
                                    img.onload = () => {
                                        characterImages.set(obj.name, img);
                                    };
                                    img.src = imgPath;
                                }
                                const img = characterImages.get(obj.name);
                                if (img) {
                                    const dx = objX - myX;
                                    const dy = objY - myY;
                                    const length = Math.hypot(dx, dy);
                                    if (length > 0) {
                                        const nx = dx / length;
                                        const ny = dy / length;
                                        const offset = (obj.radius || 60) * 1.6 * zoom;
                                        const imgX = myX + nx * offset - 20;
                                        const imgY = myY + ny * offset - 20;
                                        ctx.drawImage(img, imgX, imgY, 40 * zoom, 40 * zoom);
                                    }
                                }
                            }
                        }
                    }
                });
            }
        } catch (e) {}
        requestAnimationFrame(render);
    }
    render();
    
    let zoomPatched = false;
    let originalEngineSetZoom = null;
    let originalGameZoomDescriptor = null;
    let syncTrackingEnabled = false;
    let syncedObjects = new Map();
    let syncedObjectsAll = new Set();
    let lastSyncTime = Date.now();
    let syncCleanupInterval = null;

    window.customZoom = 1.0;

    function initZoomMod() {
        if (typeof Engine === 'undefined' || typeof game === 'undefined' || !game) return;
        if (zoomPatched && state.zoomHackEnabled) {
            window.customZoom = state.zoomValue;
            if (game.setZoom) game.setZoom(state.zoomValue);
            return;
        }
        if (zoomPatched) return;

        try {
            window.originalZoom = game.zoom || 1.0;
            window.customZoom = state.zoomValue;
            
            originalGameZoomDescriptor = Object.getOwnPropertyDescriptor(game, 'zoom');
            
            Object.defineProperty(game, 'zoom', {
                get: function() {
                    return state.zoomHackEnabled ? window.customZoom : window.originalZoom;
                },
                set: function(v) {
                    window.originalZoom = v;
                    if (!state.zoomHackEnabled && originalGameZoomDescriptor && originalGameZoomDescriptor.set) {
                        originalGameZoomDescriptor.set.call(this, v);
                    }
                },
                configurable: true
            });

            if (typeof Engine !== 'undefined' && Engine.prototype.setZoom) {
                originalEngineSetZoom = Engine.prototype.setZoom;
                
                Engine.prototype.setZoom = function(t) {
                    if (state.zoomHackEnabled) {
                        this.zoom = window.customZoom;
                        this.staticCanvasRenderOffset.restX = 0;
                        this.staticCanvasRenderOffset.restY = 0;
                        this.staticCanvasRenderOffset.x = 0;
                        this.staticCanvasRenderOffset.y = 0;
                        this.staticCanvasRenderPosition.x = 0;
                        this.staticCanvasRenderPosition.y = 0;

                        if (this.context) {
                            this.context.save();
                            this.context.fillStyle = "rgba(0,0,0,1)";
                            this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);
                            this.context.restore();
                        }
                        if (this.clearStaticObjects) {
                            this.clearStaticObjects();
                        }
                    } else {
                        return originalEngineSetZoom.apply(this, arguments);
                    }
                };
            }

            zoomPatched = true;
            initSyncTracking();
        } catch(e) {}
    }

    function cleanupZoomMod() {
        if (originalEngineSetZoom) {
            Engine.prototype.setZoom = originalEngineSetZoom;
        }
        zoomPatched = false;
        
        if (window.game) {
            try {
                if (originalGameZoomDescriptor && game) {
                    Object.defineProperty(game, 'zoom', originalGameZoomDescriptor);
                }
                if (game.setZoom) game.setZoom(1.0);
                if (game.zoom !== undefined) game.zoom = 1.0;
                if (game.engine) {
                    if (game.engine.setZoom) game.engine.setZoom(1.0);
                    if (game.engine.zoom !== undefined) game.engine.zoom = 1.0;
                }
                if (game.canvas && game.canvas.width && game.canvas.height) {
                    if (game.clearStaticObjects) game.clearStaticObjects();
                }
            } catch(e) {}
        }
        window.customZoom = 1.0;
    }

    let lastGameServer = null;
    function initSyncTracking() {
        if (typeof gameServer === 'undefined' || !gameServer) {
            setTimeout(initSyncTracking, 500);
            return;
        }
        
        if (lastGameServer !== gameServer) {
            syncTrackingEnabled = false;
            syncedObjects.clear();
            lastGameServer = gameServer;
        }
        
        if (syncTrackingEnabled) return;
        
        syncTrackingEnabled = true;
        syncedObjects.clear();
        lastSyncTime = Date.now();

        try {
            const SYNC_TYPE = typeof socketMsgType !== 'undefined' ? socketMsgType.SYNC : 1;
            
            if (gameServer._events && gameServer._events[SYNC_TYPE]) {
                const originalHandler = gameServer._events[SYNC_TYPE];
                if (Array.isArray(originalHandler)) {
                    gameServer._events[SYNC_TYPE] = originalHandler.map(h => {
                        return function(response) {
                            trackSyncObjects(response);
                            return h.apply(this, arguments);
                        };
                    });
                } else {
                    gameServer._events[SYNC_TYPE] = function(response) {
                        trackSyncObjects(response);
                        return originalHandler.apply(this, arguments);
                    };
                }
            } else {
                gameServer.on(SYNC_TYPE, function(response) {
                    trackSyncObjects(response);
                });
            }
        } catch(e) {}

        function trackSyncObjects(response) {
            const now = Date.now();
            if (response && response.a) {
                for (let x = 0; x < response.a.length; x++) {
                    const obj = response.a[x];
                    if (obj && obj.a) {
                        syncedObjects.set(parseInt(obj.a), now);
                    }
                }
                lastSyncTime = now;
            }
            if (response && response.c) {
                for (let i = 0; i < response.c.length; i++) {
                     const msg = response.c[i];
                     if (msg && msg.a === (typeof socketMsgType !== 'undefined' ? socketMsgType.REMOVEOBJECT : 2)) {
                         syncedObjects.delete(parseInt(msg.b));
                     }
                }
            }
        }

        if (syncCleanupInterval) clearInterval(syncCleanupInterval);
        syncCleanupInterval = setInterval(() => {
            if (!state.zoomHackEnabled) return;
            if (!game || !game.gameObjects) return;

            const now = Date.now();
            
            for (const [id, time] of syncedObjects) {
                if (now - time > 3000) {
                    syncedObjects.delete(id);
                }
            }

            for (let id in game.gameObjects) {
                const obj = game.gameObjects[id];
                if (obj && obj.type === 0x1 && obj !== game.me && !obj.deleted) {
                    const objId = parseInt(id);
                    if (!syncedObjects.has(objId) && !syncedObjects.has(obj.id)) {
                        try {
                            if (game.deleteObject) {
                                game.deleteObject(obj);
                            }
                        } catch(e) {}
                    }
                }
            }
        }, 500);
    }

    const searchInterval = setInterval(() => {
        if (findGame()) {
            clearInterval(searchInterval);
            render();
            initSyncTracking();
            if (state.zoomHackEnabled) {
                initZoomMod();
            }
        }
    }, 500);
    
    setInterval(() => {
        if (typeof gameServer !== 'undefined' && gameServer && lastGameServer !== gameServer) {
            syncTrackingEnabled = false;
            initSyncTracking();
        }
    }, 1000);

    const bossContainer = document.createElement('div');
    bossContainer.id = 'ez-bossTimerContainer';
    bossContainer.style.position = 'fixed';
    bossContainer.style.top = '50px';
    bossContainer.style.right = '200px';
    bossContainer.style.zIndex = '9999';
    bossContainer.style.display = 'none';
    bossContainer.style.alignItems = 'center';
    bossContainer.style.background = 'rgba(0,0,0,0.5)';
    bossContainer.style.padding = '5px';
    bossContainer.style.borderRadius = '4px';
    bossContainer.style.cursor = 'move';
    bossContainer.style.userSelect = 'none';

    const bossStatusText = document.createElement('div');
    bossStatusText.style.fontSize = '14px';
    bossStatusText.style.color = '#fff';
    bossStatusText.style.marginRight = '10px';
    bossContainer.appendChild(bossStatusText);

    const bossTimerText = document.createElement('div');
    bossTimerText.style.fontSize = '14px';
    bossTimerText.style.color = '#fff';
    bossContainer.appendChild(bossTimerText);

    document.body.appendChild(bossContainer);

    let bossTimerDrag = false;
    let bossTimerOffsetX = 0;
    let bossTimerOffsetY = 0;

    bossContainer.onmousedown = (e) => {
        e.preventDefault();
        bossTimerDrag = true;
        bossTimerOffsetX = bossContainer.offsetLeft - e.clientX;
        bossTimerOffsetY = bossContainer.offsetTop - e.clientY;
    };

    document.addEventListener('mousemove', (e) => {
        if (bossTimerDrag) {
            bossContainer.style.left = (e.clientX + bossTimerOffsetX) + 'px';
            bossContainer.style.top = (e.clientY + bossTimerOffsetY) + 'px';
            bossContainer.style.right = 'auto';
        }
    });

    document.addEventListener('mouseup', () => {
        bossTimerDrag = false;
    });

    function toggleBossTimer(enabled) {
        bossContainer.style.display = enabled ? 'flex' : 'none';
    }

    setInterval(() => {
        if (!state.bossTimer) return;
        
        const bossIndicator = document.querySelector('.bC');
        if (bossIndicator) {
            bossStatusText.innerText = "BOSS ALIVE";
            bossStatusText.style.color = '#ff0000';
            bossTimerText.innerText = "";
        } else {
            bossStatusText.innerText = "Boss Timer:";
            bossStatusText.style.color = '#fff';
            
            const currentTime = new Date();
            const nextBossTime = new Date(currentTime);
            nextBossTime.setHours(currentTime.getHours() + 1);
            nextBossTime.setMinutes(0);
            nextBossTime.setSeconds(0);

            const timeDifference = nextBossTime - currentTime;
            const minutes = Math.floor((timeDifference % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((timeDifference % (1000 * 60)) / 1000);

            const formattedTime = (minutes < 10 ? '0' : '') + minutes + ':' +
                                (seconds < 10 ? '0' : '') + seconds;

            bossTimerText.innerText = formattedTime;
        }
    }, 1000);
} // end initScript

const starter = setInterval(() => {
    if (window.game && window.game.me) {
        clearInterval(starter);
        initScript();
    }
}, 500);

})();
