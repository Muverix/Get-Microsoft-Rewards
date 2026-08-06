// ==UserScript==
// @name         Get Microsoft Rewards (修复/增强版)
// @namespace    https://github.com/Muverix/Get-Microsoft-Rewards
// @version      1.0.1
// @description  微软 Rewards 自动助手：集成本地自动搜索、每日活动与自动签到。基于原脚本二次开发，在 Gemini AI 辅助下优化多区域兼容与卡片过滤逻辑。
// @author       Muverix
// @icon         https://rewards.bing.com/rewardscdn/images/rewards.png
// @homepage     https://github.com/Muverix/Get-Microsoft-Rewards
// @supportURL   https://github.com/Muverix/Get-Microsoft-Rewards/issues
// @updateURL    https://fastly.jsdelivr.net/gh/Muverix/Get-Microsoft-Rewards@main/get-microsoft-rewards.user.js
// @downloadURL  https://fastly.jsdelivr.net/gh/Muverix/Get-Microsoft-Rewards@main/get-microsoft-rewards.user.js
// @license      MIT
// @match        https://www.bing.com/*
// @match        https://cn.bing.com/*
// @match        https://rewards.bing.com/*
// @match        https://login.live.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_notification
// @grant        GM_cookie
// @grant        GM_registerMenuCommand
// @grant        GM_openInTab
// @grant        GM_log
// @connect      bing.com
// @connect      rewards.bing.com
// @connect      www.bing.com
// @connect      cn.bing.com
// @connect      login.live.com
// @connect      prod.rewardsplatform.microsoft.com
// @connect      hot.baiwumm.com
// @connect      hotapi.nntool.cc
// @connect      cnxiaobai.com
// @run-at       document-end
// @tips         本项目基于 MIT 协议开源，修改自原版，由 Gemini AI 辅助优化。
// ==/UserScript==

/* =========================================================================
 * 📜 版权声明与免责条款 (License & Disclaimer)
 * -------------------------------------------------------------------------
 * 1. 本脚本基于 QingJ 的开源项目《Get Microsoft Rewards》二次开发。
 * 2. 借助 Gemini AI，参考并融合了 liyan20001124-byte 的《微软积分商城签到（全能智能重构版）》的核心逻辑与优化思路。
 * 3. 本脚本遵循 MIT 开源许可协议，仅供个人学习研究与自动化测试使用。
 * 4. 作者不对使用本脚本可能产生的任何风险（如账号积分变动或风控等）承担任何法律责任，请合理使用。
 * ========================================================================= */

(function () {
    'use strict';

    // ========== 配置 ==========
    const CONFIG = {
        pc: { minDelay: 15000, maxDelay: 30000 },
        mobile: { minDelay: 20000, maxDelay: 35000 },
        ua: {
            pc: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0',
            mobile: 'Mozilla/5.0 (Linux; Android 16; MEIZU 20 Build/BQ2A.251110.001-BP2A.250605.031.A3; ) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/150.0.7871.181 Mobile Safari/537.36 BingSapphire/33.8.440724006'
        },
        // 多个热搜API备用源
        hotApis: [
            { url: 'https://hot.baiwumm.com/api/', sources: ['weibo', 'douyin', 'baidu', 'zhihu', 'toutiao'] },
            { url: 'https://hotapi.nntool.cc/', sources: ['weibo', 'douyin', 'baidu', 'toutiao', 'zhihu'] },
            { url: 'https://cnxiaobai.com/DailyHotApi/', sources: ['weibo', 'douyin', 'baidu', 'toutiao'] }
        ],
        keywords: ["天气预报", "今日新闻", "体育赛事", "股票行情", "电影推荐", "科技资讯", "美食食谱", "旅游攻略"],
        // 暂停机制配置
        pause: {
            enabled: true,           // 是否启用暂停机制
            interval: 10,            // 每执行多少次搜索后暂停
            duration: 15 * 60 * 1000 // 暂停时长（毫秒），15分钟
        }
    };

    // ========== 状态 ==========
    let state = {
        level: 1, points: 0,
        pcCur: 0, pcMax: 0,
        mobileCur: 0, mobileMax: 0,
        promosTotal: 0, promosDone: 0,
        signDone: false, signPoints: -1,
        readCur: 0, readMax: 0,
        running: false,
        accessToken: null,
        accessTokenExpiresAt: 0,
        updating: false,
        updatingPromise: null,
        // 新增：搜索进度和暂停状态
        searchCount: 0,           // 当前搜索计数（用于暂停判断）
        isPaused: false,          // 是否处于暂停状态
        pauseEndTime: 0,          // 暂停结束时间戳
        countdownStartTime: 0,    // 倒计时开始时间（精确计时）
        countdownDuration: 0,     // 倒计时总时长
        manualPaused: false,      // 手动暂停
        pausePromise: null,
        pauseResolver: null
    };
    let dashboard = null;
    let loginCookie = '';

    // ========== 进度保存/恢复 ==========
    const STORAGE_KEY = 'mr_search_progress';

    function saveProgress() {
        const today = getDateHyphen();
        const data = {
            date: today,
            searchCount: state.searchCount
        };
        GM_setValue(STORAGE_KEY, JSON.stringify(data));
    }

    function loadProgress() {
        try {
            const saved = GM_getValue(STORAGE_KEY);
            if (!saved) return null;
            const data = JSON.parse(saved);
            // 只恢复当天的进度
            if (data.date === getDateHyphen()) {
                state.searchCount = data.searchCount || 0;
                return data;
            }
        } catch (e) { }
        return null;
    }

    async function withAccessTokenRequest(requestFn) {
        // 1. 获取 Token，若为空尝试强制刷新一次
        let token = await getAccessToken();
        if (!token) {
            console.warn('[Rewards] 初始 Token 为空，尝试强制刷新...');
            token = await getAccessToken({ forceRefresh: true });
        }

        if (!token) {
            log('⚠️ 未获取到活动Token，请确认登录状态或刷新页面重试');
            return null;
        }

        try {
            const res = await requestFn(token);

            // 2. 检查返回结果字符串（适配 gmRequest 正常返回 401 错误 JSON 的情况）
            if (typeof res === 'string' && (res.includes('invalid_token') || res.includes('Unauthorized') || res.includes('\"code\":401'))) {
                console.warn('[Rewards] 响应中检测到 Token 失效，重新获取 Token 中...');
                state.accessToken = null;
                state.accessTokenExpiresAt = 0;
                token = await getAccessToken({ forceRefresh: true });
                if (token) {
                    return await requestFn(token);
                }
            }
            return res;
        } catch (e) {
            // 3. 捕获网络层抛出的 401 异常
            const is401 = (e && e.status === 401) || 
                          (e && e.responseStatus === 401) || 
                          (e && e.message && (e.message.includes('401') || e.message.includes('Unauthorized')));

            if (is401) {
                console.warn('[Rewards] 捕获到网络层 401 异常，重新获取 Token 中...');
                state.accessToken = null;
                state.accessTokenExpiresAt = 0;
                token = await getAccessToken({ forceRefresh: true });
                if (token) {
                    return await requestFn(token);
                }
            }
            throw e;
        }
    }
    function resetProgress() {
        state.searchCount = 0;
        GM_setValue(STORAGE_KEY, '');
    }

    // ========== 工具函数 ==========
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const randomPick = arr => arr[Math.floor(Math.random() * arr.length)];
    const randomRange = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
    const uuid = () => crypto.randomUUID();
    const getDateStr = () => {
        const d = new Date();
        return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
    };
    const getDateHyphen = () => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    const isJSON = s => { try { JSON.parse(s); return true; } catch { return false; } };

    // GM_xmlhttpRequest 封装
    async function gmRequest(options) {
        const retries = options.retries ?? 2;
        const retryDelay = options.retryDelay ?? 1000;
        let attempt = 0;

        const shouldRetry = (err) => {
            const status = err?.status || 0;
            return status === 0 || status === 429 || status >= 500 || err?.message === 'Timeout';
        };

        while (true) {
            try {
                return await new Promise((resolve, reject) => {
                    GM_xmlhttpRequest({
                        timeout: 20000,
                        ...options,
                        onload: xhr => {
                            if (xhr.status >= 200 && xhr.status < 300) {
                                resolve(options.returnUrl ? xhr.finalUrl : xhr.responseText);
                            } else if (xhr.status >= 300 && xhr.status < 400) {
                                const loc = xhr.responseHeaders.match(/Location:\s*(.*?)\s*[\r\n]/i);
                                resolve(loc ? loc[1] : xhr.responseText);
                            } else {
                                const err = new Error(`HTTP ${xhr.status}`);
                                err.status = xhr.status;
                                err.responseText = xhr.responseText;
                                err.finalUrl = xhr.finalUrl;
                                reject(err);
                            }
                        },
                        onerror: () => {
                            const err = new Error('Network Error');
                            err.status = 0;
                            reject(err);
                        },
                        ontimeout: () => {
                            const err = new Error('Timeout');
                            err.status = 0;
                            reject(err);
                        }
                    });
                });
            } catch (e) {
                if (attempt >= retries || !shouldRetry(e)) throw e;
                const delay = retryDelay * Math.pow(2, attempt);
                attempt++;
                await sleep(delay + randomRange(0, 250));
            }
        }
    }

    // 获取热搜词（支持多源自动切换）
    async function getHotQuery() {
        // 打乱API顺序，随机选择
        const apis = [...CONFIG.hotApis].sort(() => Math.random() - 0.5);

        for (const api of apis) {
            try {
                const src = randomPick(api.sources);
                const res = await gmRequest({ method: 'GET', url: api.url + src, timeout: 8000 });
                const data = JSON.parse(res);
                if (data.code === 200 && data.data?.length) {
                    const title = randomPick(data.data).title || '';
                    // 随机截取长度，更自然
                    const len = randomRange(8, 25);
                    return title.substring(0, len);
                }
            } catch { /* 尝试下一个API */ }
        }
        // 所有API都失败，使用本地关键词
        return `${randomPick(CONFIG.keywords)} ${Math.random().toString(36).slice(2, 6)}`;
    }

    // Cookie 管理
    function getCookies(url) {
    return new Promise(resolve => {
        try {
            if (typeof GM_cookie === 'undefined') {
                console.warn('[Rewards] GM_cookie不存在');
                return resolve('');
            }

            GM_cookie.list({ url }, cookies => {
                if (!cookies || !cookies.length) {
                    console.warn('[Rewards] Cookie为空:', url);
                    return resolve('');
                }

                const str = cookies
                    .map(c => `${c.name}=${c.value}`)
                    .join('; ');

                console.log('[Rewards] Cookie长度:', str.length, url);
                resolve(str);
            });

        } catch (e) {
            console.error('[Rewards] Cookie获取失败', e);
            resolve('');
        }
    });
}

    function deleteCookie(name, host = 'bing.com') {
        return new Promise(resolve => {
            if (typeof GM_cookie !== 'undefined') {
                GM_cookie('delete', { url: `https://${host}`, name }, resolve);
            } else resolve();
        });
    }

    // ========== 样式 (极简版) ==========
    GM_addStyle(`
        #mr-panel {
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 2147483647;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: #fff;
            border: 1px solid #e0e0e0;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            border-radius: 8px;
        }

        /* 收起状态 */
        #mr-panel.collapsed {
            width: 44px;
            height: 44px;
            border-radius: 50%;
            cursor: pointer;
            display: flex;
            justify-content: center;
            align-items: center;
            background: #fff;
            color: #0078d4;
            box-shadow: 0 4px 16px rgba(0,120,212,0.3);
            border: 1px solid #e0e0e0;
            transition: all 0.2s;
        }
        #mr-panel.collapsed:hover { transform: scale(1.1); box-shadow: 0 6px 20px rgba(0,120,212,0.4); }
        #mr-panel.collapsed svg { width: 24px; height: 24px; fill: currentColor; }
        #mr-panel.collapsed #mr-container { display: none; }

        /* 展开状态 */
        #mr-panel:not(.collapsed) { width: 300px; }
        #mr-panel:not(.collapsed) svg { display: none; }

        #mr-header {
            padding: 12px 16px;
            border-bottom: 1px solid #eee;
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: #f8f9fa;
            border-radius: 8px 8px 0 0;
        }
        #mr-title { font-weight: 600; font-size: 14px; color: #333; }
        #mr-close { cursor: pointer; color: #999; font-size: 18px; line-height: 1; }
        #mr-close:hover { color: #333; }

        #mr-body { padding: 16px; }

        .mr-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 12px; color: #555; }
        .mr-val { font-weight: 600; color: #333; }

        .mr-progress-bg { height: 4px; background: #eee; border-radius: 2px; margin-bottom: 12px; overflow: hidden; }
        .mr-bar { height: 100%; background: #0078d4; }

        .mr-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 16px; }
        .mr-btn {
            border: 1px solid #d0d0d0;
            background: #fff;
            color: #333;
            padding: 6px 10px;
            border-radius: 4px;
            font-size: 12px;
            cursor: pointer;
        }
        .mr-btn:hover { background: #f0f0f0; border-color: #bbb; }
        .mr-btn:active { background: #e5e5e5; }
        .mr-full { grid-column: span 2; background: #0078d4; color: #fff; border: none; }
        .mr-full:hover { background: #006abc; }

        /* Auth */
        #mr-auth { margin-bottom: 12px; padding: 10px; background: #fff8e1; border: 1px solid #ffe0b2; border-radius: 4px; }
        .mr-input { width: 100%; padding: 4px; border: 1px solid #ccc; font-size: 11px; margin: 4px 0; }

        /* Log */
        #mr-log {
            margin-top: 12px;
            height: 80px;
            background: #fafafa;
            border: 1px solid #eee;
            padding: 8px;
            font-size: 10px;
            color: #666;
            overflow-y: auto;
            font-family: monospace;
        }
    `);

    // ========== UI 结构 ==========
    const panel = document.createElement('div');
    panel.id = 'mr-panel';
    panel.className = 'collapsed'; // 默认折叠
    // 礼盒 SVG
    const svgIcon = `<svg viewBox="0 0 24 24"><path d="M20 6h-3V4c0-1.1-.9-2-2-2H9c-1.1 0-2 .9-2 2v2H4c-1.1 0-2 .9-2 2v3h2v9c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-9h2V8c0-1.1-.9-2-2-2zm-9-2h2v2h-2V4zm0 16H6v-9h5v9zm6 0h-5v-9h5v9zm1.5-11H16V7h2v2zm-4.5 0h-2V7h2v2zm-4.5 0H7V7h2v2zm-3.5 0H4V7h1.5v2z"/></svg>`;

    panel.innerHTML = `
        ${svgIcon}
        <div id="mr-container">
            <div id="mr-header">
                <div id="mr-title"><span>🎁</span> Microsoft Rewards</div>
                <div id="mr-close">×</div>
            </div>

            <div id="mr-body">
                <!-- 状态 -->
                <div class="mr-row">
                    <span>等级 <span id="mr-level" style="font-weight:600">-</span></span>
                    <span style="color:#d83b01"><span id="mr-points">0</span> pts</span>
                </div>

                <!-- 进度 -->
                <div class="mr-row"><span>🔍 搜索进度</span><span id="mr-pc">0/0</span></div>
                <div class="mr-progress-bg"><div class="mr-bar" id="mr-pc-bar"></div></div>

                <div class="mr-row"><span>📱 移动签到</span><span id="mr-mobile">0/0</span></div>
                <div class="mr-progress-bg"><div class="mr-bar" id="mr-mobile-bar"></div></div>

                <div class="mr-row"><span>📖 阅读任务</span><span id="mr-read">0/0</span></div>
                <div class="mr-progress-bg"><div class="mr-bar" id="mr-read-bar" style="background:#ff8c00"></div></div>

                <!-- 授权 -->
                <div id="mr-auth" style="display:none">
                    <div style="font-weight:bold;margin-bottom:5px">⚠️ 需授权</div>
                    <button class="mr-btn" id="mr-auth-link" style="width:100%">🔗 获取授权码</button>
                    <input type="text" id="mr-auth-in" class="mr-input" placeholder="粘贴URL...">
                    <button class="mr-btn" id="mr-auth-save" style="width:100%">保存</button>
                </div>

                <!-- 按钮 -->
                <div class="mr-grid">
                    <button id="btn-search" class="mr-btn">🔍 搜索</button>
                    <button id="btn-promo" class="mr-btn">🎯 活动 <span id="val-promo">0/0</span></button>
                    <button id="btn-sign" class="mr-btn">✅ 签到</button>
                    <button id="btn-read" class="mr-btn">📖 阅读</button>
                    <button id="btn-all" class="mr-btn mr-full">🚀 一键全部执行</button>
                </div>

                <!-- 日志 -->
                <div id="mr-log"></div>
            </div>
        </div>
    `;
    document.body.appendChild(panel);

    // 元素引用
    const $ = id => document.querySelector(id);
    const nodes = {
        panel: $('#mr-panel'),
        close: $('#mr-close'),
        level: $('#mr-level'),
        points: $('#mr-points'),
        pc: $('#mr-pc'),
        pcBar: $('#mr-pc-bar'),
        mob: $('#mr-mobile'),
        mobBar: $('#mr-mobile-bar'),
        read: $('#mr-read'),
        readBar: $('#mr-read-bar'),
        btnSearch: $('#btn-search'),
        btnPromo: $('#btn-promo'),
        valPromo: $('#val-promo'),
        btnSign: $('#btn-sign'),
        btnRead: $('#btn-read'),
        btnAll: $('#btn-all'),
        boxAuth: $('#mr-auth'),
        btnAuthLink: $('#mr-auth-link'),
        inAuth: $('#mr-auth-in'),
        btnAuthSave: $('#mr-auth-save'),
        logBox: $('#mr-log')
    };

    // ========== 交互逻辑 ==========

    // 展开/收起
    nodes.panel.onclick = (e) => {
        if (nodes.panel.classList.contains('collapsed')) {
            nodes.panel.classList.remove('collapsed');
        }
    };
    nodes.close.onclick = (e) => {
        e.stopPropagation();
        nodes.panel.classList.add('collapsed');
    };

    const LOG_MAX_LINES = 200;
    const log = (msg) => {
        const div = document.createElement('div');
        div.textContent = `[${new Date().toLocaleTimeString().slice(0, 5)}] ${msg}`;
        nodes.logBox.appendChild(div);
        while (nodes.logBox.childNodes.length > LOG_MAX_LINES) {
            nodes.logBox.removeChild(nodes.logBox.firstChild);
        }
        nodes.logBox.scrollTop = nodes.logBox.scrollHeight;
    };

    const updateAllButton = () => {
        if (!nodes.btnAll) return;
        if (state.manualPaused) {
            nodes.btnAll.textContent = '▶️ 继续执行';
        } else if (state.running || state.allRunning || state.busyCount > 0) {
            nodes.btnAll.textContent = '⏸️ 暂停执行';
        } else {
            nodes.btnAll.textContent = '🚀 一键全部执行';
        }
    };

    const setManualPause = (paused, opts = {}) => {
        if (paused === state.manualPaused) return;
        const silent = !!opts.silent;
        state.manualPaused = paused;
        if (paused) {
            if (!state.pausePromise) {
                state.pausePromise = new Promise(resolve => { state.pauseResolver = resolve; });
            }
        } else if (state.pauseResolver) {
            const resolve = state.pauseResolver;
            state.pauseResolver = null;
            state.pausePromise = null;
            resolve();
        }
        updateAllButton();
        if (!silent) {
            log(paused ? '⏸️ 已手动暂停' : '▶️ 已继续执行');
        }
    };

    const markBusy = (delta) => {
        state.busyCount = Math.max(0, state.busyCount + delta);
        updateAllButton();
    };

    const waitWhilePaused = async () => {
        if (!state.manualPaused) return 0;
        if (!state.pausePromise) {
            state.pausePromise = new Promise(resolve => { state.pauseResolver = resolve; });
        }
        const start = Date.now();
        await state.pausePromise;
        return Date.now() - start;
    };

    // 授权相关
    const AUTH_URL = 'https://login.live.com/oauth20_authorize.srf?client_id=0000000040170455&scope=service::prod.rewardsplatform.microsoft.com::MBI_SSL&response_type=code&redirect_uri=https://login.live.com/oauth20_desktop.srf';

    nodes.btnAuthLink.onclick = () => window.open(AUTH_URL, '_blank');

    nodes.btnAuthSave.onclick = () => {
        const val = nodes.inAuth.value.trim();
        const match = val.match(/M\.[^&]+/);
        if (match) {
            GM_setValue('auth_code', match[0]);
            log('✅ 授权码已保存！');
            nodes.boxAuth.style.display = 'none';
        } else {
            log('❌ 格式错误，请复制完整URL');
        }
    };
    updateAllButton();

    // 自动抓取微软 OAuth Code
    async function checkAuth() {
        try {
            let cookie = '';
            if (typeof getCookies === 'function') {
                cookie = await getCookies('https://login.live.com');
            }

            const authUrl = 'https://login.live.com/oauth20_authorize.srf?client_id=0000000040170455&scope=service::prod.rewardsplatform.microsoft.com::MBI_SSL&response_type=code&redirect_uri=https://login.live.com/oauth20_desktop.srf';

            const res = await new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: authUrl,
                    headers: {
                        'Cookie': cookie,
                        'User-Agent': (typeof CONFIG !== 'undefined' && CONFIG.ua?.pc) ? CONFIG.ua.pc : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    },
                    onload: r => resolve(r),
                    onerror: e => reject(e)
                });
            });

            // 1. 优先从跳转后的 URL 截取 code
            const finalUrl = res.finalUrl || '';
            let codeMatch = finalUrl.match(/[?&]code=([^&]+)/);
            if (codeMatch) return decodeURIComponent(codeMatch[1]);

            // 2. 次之从响应内容或 Header 截取
            const body = res.responseText || '';
            codeMatch = body.match(/[?&]code=([^&"'\s]+)/);
            if (codeMatch) return decodeURIComponent(codeMatch[1]);

            return null;
        } catch (e) {
            console.error('[Rewards] checkAuth 异常:', e);
            return null;
        }
    }

    // ========== 核心逻辑 (简化版引用) ==========

    // 数据刷新
    // 统一获取 Token 的逻辑
    async function getSearchToken() {
        if (!state.searchToken) await updateData();
        return state.searchToken;
    }

    // 数据刷新函数（修复 allP 报错 + 本地签到日期双重校验）
    async function updateData() {
    if (state.updatingPromise) return state.updatingPromise;
    state.updating = true;
    state.updatingPromise = (async () => {
        try {
            const cookie = await getCookies('https://rewards.bing.com');

            let htmlRes = '';
            try {
                htmlRes = await gmRequest({
                    method: 'GET',
                    url: 'https://rewards.bing.com/',
                    headers: {
                        'User-Agent': CONFIG.ua.pc,
                        'Cookie': cookie,
                        'Referer': 'https://www.bing.com/'
                    }
                });

                const tokenMatch = htmlRes.match(/name="__RequestVerificationToken"[^>]*value="([^"]+)"/i)
                                || htmlRes.match(/value="([^"]+)"[^>]*name="__RequestVerificationToken"/i)
                                || htmlRes.match(/RequestVerificationToken["']?\s*[:=]\s*["']([^"']+)["']/i)
                                || htmlRes.match(/"verificationToken"\s*:\s*["']([^"']+)["']/i);
                if (tokenMatch) {
                    state.searchToken = tokenMatch[1];
                }
            } catch (e) {}

            let dashData = null;

            if (htmlRes) {
                const dashMatch = htmlRes.match(/var\s+dashboard\s*=\s*({[\s\S]*?});\s*var/i)
                               || htmlRes.match(/window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?});/i);
                if (dashMatch) {
                    try { dashData = JSON.parse(dashMatch[1]); } catch (e) {}
                }
            }

            if (!dashData || !dashData.userProfile) {
                try {
                    const token = await getAccessToken();
                    if (token) {
                        const dapiRes = await gmRequest({
                            method: 'GET',
                            url: `https://prod.rewardsplatform.microsoft.com/dapi/me?channel=SAAndroid&options=613&_=${Date.now()}`,
                            headers: {
                                'Authorization': `Bearer ${token}`,
                                'X-Rewards-AppId': 'SAAndroid/31.4.2110003555',
                                'X-Rewards-IsMobile': 'true'
                            }
                        });
                        const parsed = JSON.parse(dapiRes);
                        dashData = parsed.response?.dashboard || parsed.response || parsed;
                    }
                } catch (e) {
                    console.error('[Rewards] DAPI 请求错误:', e);
                }
            }

            if (!dashData) {
                log('❌ 获取数据失败，请确认已登录 rewards.bing.com');
                return;
            }

            dashboard = dashData;

            // 1. 解析等级与积分
            const profile = dashData.userProfile || dashData.profile || {};
            const balance = dashData.balance;

            if (typeof balance === 'number') {
                state.points = balance;
            } else if (balance && typeof balance === 'object') {
                state.points = balance.availablePoints ?? balance.points ?? 0;
            } else {
                state.points = profile.availablePoints ?? profile.points ?? dashData.availablePoints ?? 0;
            }

            const rawLevel = (typeof balance === 'object' && balance?.level) 
                          || balance?.levelInfo?.activeLevel 
                          || profile.level 
                          || profile.levelInfo?.activeLevel 
                          || 'Level1';
            state.level = parseInt(String(rawLevel).replace(/\D/g, '')) || 1;

            // 2. 搜索进度解析
            let searchCur = 0, searchMax = 0;
            const candidateCounters = [];

            if (Array.isArray(dashData.counters)) candidateCounters.push(...dashData.counters);
            if (Array.isArray(dashData.userCounters)) candidateCounters.push(...dashData.userCounters);
            if (Array.isArray(dashData.userStatus?.counters)) candidateCounters.push(...dashData.userStatus.counters);

            const promos = [
                ...(Array.isArray(dashData.promotions) ? dashData.promotions : []),
                ...(Array.isArray(dashData.morePromotions) ? dashData.morePromotions : []),
                ...(Array.isArray(dashData.userStatus?.promotions) ? dashData.userStatus.promotions : [])
            ];

            promos.forEach(p => {
                const name = ((p.name || p.id || p.title || p.type || '') + '').toLowerCase();
                if (name.includes('search')) {
                    candidateCounters.push(p);
                }
            });

            candidateCounters.forEach(item => {
                if (!item || typeof item !== 'object') return;
                const cur = Number(item.pointProgress ?? item.progress ?? item.current ?? item.points ?? item.attributes?.progress) || 0;
                const max = Number(item.pointProgressMax ?? item.pointMax ?? item.max ?? item.maxPoints ?? item.attributes?.max) || 0;
                searchCur += cur;
                searchMax += max;
            });

            state.searchCur = searchCur;
            state.searchMax = searchMax > 0 ? searchMax : (searchCur > 0 ? searchCur : (state.level > 1 ? 90 : 60));
            state.pcCur = state.searchCur;
            state.pcMax = state.searchMax;

            // 3. 统一收集所有活动列表
            const today = getDateStr();
            const dailySet = dashData.dailySetPromotions?.[today] 
                          || Object.values(dashData.dailySetPromotions || {}).flat() 
                          || [];
            const morePromos = dashData.morePromotions || dashData.promotions || [];
            const activities = dashData.activities || [];

            const allP = [
                ...(Array.isArray(dailySet) ? dailySet : []),
                ...(Array.isArray(morePromos) ? morePromos : []),
                ...(Array.isArray(activities) ? activities : [])
            ];

            // 4. 签到状态解析
            const lastSignDate = GM_getValue("Config.lastSignDate", "");
            const isLocalSigned = !!lastSignDate && lastSignDate.startsWith(today);

            const dashStr = JSON.stringify(dashData || {});
            let isRemoteSigned = false;

            // A. 优先从常规活动列表中查找
            const checkInPromo = allP.find(p => {
                if (!p || typeof p !== 'object') return false;
                const str = JSON.stringify(p).toLowerCase();
                if (str.includes('fosbury')) return false;
                return str.includes('checkin') || str.includes('signin') || str.includes('streak') || str.includes('签到');
            });

            if (checkInPromo) {
                const cur = Number(checkInPromo.pointProgress ?? checkInPromo.progress ?? checkInPromo.attributes?.progress ?? 0);
                const max = Number(checkInPromo.pointProgressMax ?? checkInPromo.max ?? checkInPromo.attributes?.max ?? 0);
                isRemoteSigned = checkInPromo.complete === true || 
                                 checkInPromo.complete === 'true' || 
                                 checkInPromo.attributes?.complete === 'true' || 
                                 checkInPromo.attributes?.complete === 'True' || 
                                 (max > 0 && cur >= max);
            }

            // B. 网页数据直接正则扫描
            if (!isRemoteSigned && (dashStr.includes('"claimedToday":true') || dashStr.includes(`"${today}`))) {
                isRemoteSigned = true;
            }

            // C. 若网页未扫描到，静默请求移动端 DAPI 接口扫描
            if (!isRemoteSigned && !isLocalSigned) {
                try {
                    const token = typeof getAccessToken === 'function' ? await getAccessToken() : null;
                    if (token) {
                        const dapiRes = await gmRequest({
                            method: 'GET',
                            url: `https://prod.rewardsplatform.microsoft.com/dapi/me?channel=SAAndroid&version=33.8.440724006&_=${Date.now()}`,
                            headers: {
                                'Authorization': `Bearer ${token}`,
                                'User-Agent': CONFIG.ua.mobile,
                                'X-Rewards-AppId': 'SAAndroid/33.8.440724006',
                                'X-Rewards-IsMobile': 'true'
                            }
                        });
                        const resStr = typeof dapiRes === 'string' ? dapiRes : JSON.stringify(dapiRes);
                        if (resStr.includes('"claimedToday":true') || resStr.includes('"claimedToday":"true"') || resStr.includes(`"${today}`)) {
                            isRemoteSigned = true;
                            GM_setValue("Config.lastSignDate", today);
                        }
                    }
                } catch (e) {}
            }

            state.checkedIn = isRemoteSigned || isLocalSigned;

            // =========================================================================
            // 5. 阅读任务与活动列表统计（优先从活动列表中提取真实进度，修复日志进度不一致问题）
            const readOfferId = 'ENUS_readarticle3_30points';
            const readPromo = allP.find(p => {
                if (!p || typeof p !== 'object') return false;
                const offerId = p.attributes?.offerid || p.offerid || '';
                return offerId === readOfferId || offerId.toLowerCase().includes('readarticle');
            });

            if (readPromo && readPromo.attributes) {
                state.readCur = parseInt(readPromo.attributes.progress) || 0;
                state.readMax = parseInt(readPromo.attributes.max) || 30;
            } else {
                if (state.readCur === undefined) state.readCur = 0;
                if (state.readMax === undefined) state.readMax = 30;
            }

            state.promosTotal = allP.length;
            state.promosDone = allP.filter(p => p.complete || p.attributes?.complete === 'true' || p.attributes?.complete === 'True').length;

            render();
            log(`✓ 数据已更新: Lv.${state.level} ${state.points}pts | 搜索: ${state.searchCur}/${state.searchMax}`);
        } catch (e) {
            console.error('updateData error:', e);
            log(`⚠️ 获取数据出错: ${e.message}`);
        } finally {
            state.updating = false;
            state.updatingPromise = null;
        }
    })();
    return state.updatingPromise;
}
    // UI 渲染函数（精准适配原生节点映射）
    function render() {
        if (!nodes.level) return;

        // 1. 等级与积分
        nodes.level.textContent = `Lv.${state.level}`;
        nodes.points.textContent = (state.points || 0).toLocaleString();

        // 2. 搜索进度
        const pcCur = state.searchCur ?? state.pcCur ?? 0;
        const pcMax = state.searchMax ?? state.pcMax ?? 60;
        if (nodes.pc) nodes.pc.textContent = `${pcCur}/${pcMax}`;
        if (nodes.pcBar) nodes.pcBar.style.width = pcMax ? `${(pcCur / pcMax) * 100}%` : '0%';

        // 3. 签到状态（占用原 mob 节点显示已签到/未签到）
        if (nodes.mob) {
            nodes.mob.textContent = state.checkedIn ? '已签到' : '未签到';
            nodes.mob.style.color = state.checkedIn ? '#107c41' : '#d83b01';
        }
        if (nodes.mobBar) {
            nodes.mobBar.style.width = state.checkedIn ? '100%' : '0%';
        }

        // 4. 阅读任务
        const readCur = state.readCur ?? 10;
        const readMax = state.readMax ?? 10;
        if (nodes.read) nodes.read.textContent = `${readCur}/${readMax}`;
        if (nodes.readBar) nodes.readBar.style.width = readMax ? `${(readCur / readMax) * 100}%` : '0%';

        // 5. 活动任务
        if (nodes.valPromo) {
            nodes.valPromo.textContent = `${state.promosDone || 0}/${state.promosTotal || 0}`;
        }
    }

    // Token 获取
    // 获取/刷新 OAuth Access Token
    async function getAccessToken(opts = {}) {
        const forceRefresh = !!opts.forceRefresh;
        const now = Date.now();

        if (!forceRefresh && state.accessToken && state.accessTokenExpiresAt && now < (state.accessTokenExpiresAt - 60000)) {
            return state.accessToken;
        }

        if (state.tokenPromise) {
            return state.tokenPromise;
        }

        state.tokenPromise = (async () => {
            try {
                if (forceRefresh) {
                    state.accessToken = null;
                    state.accessTokenExpiresAt = 0;
                }

                let refreshToken = GM_getValue('refresh_token', '');
                let body = '';

                if (refreshToken) {
                    body = `client_id=0000000040170455&refresh_token=${encodeURIComponent(refreshToken)}&scope=service::prod.rewardsplatform.microsoft.com::MBI_SSL&grant_type=REFRESH_TOKEN`;
                } else {
                    log('🔑 正在重新获取微软活动 Token...');
                    const code = await checkAuth();
                    if (!code) {
                        log('⚠️ 静默授权失败，请确保浏览器已登录 login.live.com 账号');
                        if (nodes.boxAuth) nodes.boxAuth.style.display = 'block';
                        return null;
                    }
                    body = `client_id=0000000040170455&code=${encodeURIComponent(code)}&redirect_uri=https://login.live.com/oauth20_desktop.srf&grant_type=authorization_code`;
                }

                const res = await gmRequest({
                    method: 'POST',
                    url: 'https://login.live.com/oauth20_token.srf',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    data: body
                });

                const data = typeof res === 'string' ? JSON.parse(res) : res;

                if (data.access_token) {
                    state.accessToken = data.access_token;
                    state.accessTokenExpiresAt = Date.now() + (Number(data.expires_in) || 3600) * 1000;
                    if (data.refresh_token) {
                        GM_setValue('refresh_token', data.refresh_token);
                    }
                    log('🔑 活动 Token 建立成功');
                    return data.access_token;
                } else {
                    // 若旧 refresh_token 换取失败，清空并重新走 Code 授权
                    if (refreshToken) {
                        console.warn('[Rewards] RefreshToken 失效，尝试重新 Code 授权...');
                        GM_setValue('refresh_token', '');
                        state.tokenPromise = null;
                        return await getAccessToken({ forceRefresh: true });
                    }
                    log('⚠️ Token 获取失败: ' + (data.error_description || data.error || '未知错误'));
                }
            } catch (e) {
                log('❌ Auth Error: ' + e.message);
            } finally {
                state.tokenPromise = null;
            }
            return null;
        })();

        return state.tokenPromise;
    }
    //签到
    const runSign = async () => {
        nodes.btnSign.disabled = true;
        markBusy(1);
        await waitWhilePaused();
        log('⏳ 正在尝试 App 移动端签到...');

        const region = (state.country || dashboard?.userStatus?.country || 'cn').toLowerCase();

        // 生成 56 位纯 16 进制无连字符特制 ID
        const generateDapiId = () => {
            const raw1 = (typeof uuid === 'function' ? uuid() : Math.random().toString(36)).replace(/-/g, '');
            const raw2 = (typeof uuid === 'function' ? uuid() : Math.random().toString(36)).replace(/-/g, '');
            return (raw1 + raw2).slice(0, 56);
        };

        // 已更新为 MEIZU 20 (Android 16 / Chrome 150) UA + BingSapphire 包名后缀
        const appUa = "Mozilla/5.0 (Linux; Android 16; MEIZU 20 Build/BQ2A.251110.001-BP2A.250605.031.A3; ) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/150.0.7871.181 Mobile Safari/537.36 BingSapphire/33.8.440724006";
        const appId = "SAAndroid/33.8.440724006";

        // 优先获取动态 offerId，无则使用 Sapphire 默认 ID
        let offerId = "Gamification_Sapphire_DailyCheckIn";
        const allPromos = [
            ...(dashboard?.dailySetPromotions?.[getDateStr()] || []),
            ...(dashboard?.morePromotions || []),
            ...(dashboard?.activities || [])
        ];
        const targetPromo = allPromos.find(p => {
            const str = (JSON.stringify(p) || '').toLowerCase();
            return str.includes('checkin') || str.includes('签到') || str.includes('dailycheckin');
        });
        if (targetPromo) {
            offerId = targetPromo.offerId || targetPromo.id || targetPromo.offerid || offerId;
        }

        try {
            const res = await withAccessTokenRequest(token => gmRequest({
                method: 'POST',
                url: 'https://prod.rewardsplatform.microsoft.com/dapi/me/activities',
                headers: {
                    'content-type': 'application/json; charset=UTF-8',
                    'user-agent': appUa,
                    'authorization': `Bearer ${token}`,
                    'x-rewards-appid': appId,
                    'x-rewards-ismobile': 'true',
                    'x-rewards-country': region,
                    'x-rewards-language': 'zh',
                    'x-rewards-partnerid': 'startapp',
                    'x-rewards-flights': 'rwgobig'
                },
                data: JSON.stringify({
                    amount: 1,
                    id: generateDapiId(),
                    type: 103,
                    country: region,
                    channel: 'SAAndroid',
                    attributes: {
                        offerid: offerId
                    }
                })
            }));

            if (res) {
                const data = typeof res === 'string' ? JSON.parse(res) : res;
                const response = data.response || {};
                const act = response.activity;

                const pts = Number(act?.p ?? act?.points ?? 0);
                const hasOfferId = act?.a?.offerid || act?.attributes?.offerid;

                if (act && pts > 0) {
                    log(`✅ App 签到成功 +${pts}分`);
                    GM_setValue("Config.lastSignDate", getDateStr());
                    state.checkedIn = true;
                    render();
                } else if (response.isDuplicate || (act && pts === 0 && hasOfferId)) {
                    log('ℹ️ 今日已经完成过签到');
                    GM_setValue("Config.lastSignDate", getDateStr());
                    state.checkedIn = true;
                    render();
                } else {
                    log('⚠️ 签到未成功触发，请稍后重试');
                    console.log('[Rewards 未成功签到响应]:', data);
                }
            } else {
                log('❌ 签到无响应');
            }

            await updateData();
        } catch (e) {
            log('❌ 签到出错: ' + e.message);
        } finally {
            nodes.btnSign.disabled = false;
            markBusy(-1);
        }
    };
    nodes.btnSign.onclick = runSign;

    
    // 阅读
    const runRead = async () => {
    nodes.btnRead.disabled = true;
    markBusy(1);
    await waitWhilePaused();
    log('⏳ 开始阅读任务...');

    const region = (state.country || dashboard?.userStatus?.country || 'cn').toLowerCase();

    // 1. 生成 56 位无连字符特制 HEX ID
    const generateDapiId = () => {
        const raw1 = (typeof uuid === 'function' ? uuid() : Math.random().toString(36)).replace(/-/g, '');
        const raw2 = (typeof uuid === 'function' ? uuid() : Math.random().toString(36)).replace(/-/g, '');
        return (raw1 + raw2).slice(0, 56);
    };

    const appUa = "Mozilla/5.0 (Linux; Android 16; MEIZU 20 Build/BQ2A.251110.001-BP2A.250605.031.A3; ) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/150.0.7871.181 Mobile Safari/537.36 BingSapphire/33.8.440724006";
    const appId = "SAAndroid/33.8.440724006";
    const readOfferId = 'ENUS_readarticle3_30points';

    try {
        // 2. 获取当前真实阅读进度
        const info = await withAccessTokenRequest(token => gmRequest({
            url: 'https://prod.rewardsplatform.microsoft.com/dapi/me?channel=SAAndroid&options=613',
            headers: {
                'authorization': `Bearer ${token}`,
                'user-agent': appUa,
                'x-rewards-appid': appId,
                'x-rewards-ismobile': 'true',
                'x-rewards-country': region,
                'x-rewards-language': 'zh',
                'x-rewards-partnerid': 'startapp',
                'x-rewards-flights': 'rwgobig'
            }
        }));

        if (info) {
            const d = typeof info === 'string' ? JSON.parse(info) : info;
            const p = d.response?.promotions?.find(x => x.attributes?.offerid === readOfferId);

            if (p && p.attributes) {
                let cur = parseInt(p.attributes.progress) || 0;
                let max = parseInt(p.attributes.max) || 30;
                
                // 判断步长：若 max 为 30 则每篇 +3 分（共 10 篇）；若 max 为 10 则每篇 +1 分
                const step = max >= 30 ? 3 : 1;
                const totalArticles = Math.ceil(max / step);

                state.readCur = cur;
                state.readMax = max;
                render();

                if (cur >= max) {
                    log(`✅ 阅读任务已完成 (${cur}/${max})`);
                } else {
                    log(`📖 当前阅读进度 ${cur}/${max}，准备刷文章...`);

                    let currentArticleIdx = Math.floor(cur / step);

                    // 3. 修复：去掉了 && state.running，兼容单独点击“阅读”按钮
                    // 如果你的脚本有全局终止/停止按钮，可以用 !state.stopped 代替
                    while (cur < max) {
                        // 如果全局点下了停止，才主动跳出
                        if (state.stopped) break;

                        await waitWhilePaused();
                        currentArticleIdx++;
                        log(`📖 正在阅读第 ${currentArticleIdx}/${totalArticles} 篇文章 (进度: ${cur}/${max})...`);

                        const res = await withAccessTokenRequest(token => gmRequest({
                            method: 'POST',
                            url: 'https://prod.rewardsplatform.microsoft.com/dapi/me/activities',
                            headers: {
                                'content-type': 'application/json; charset=utf-8',
                                'user-agent': appUa,
                                'authorization': `Bearer ${token}`,
                                'x-rewards-appid': appId,
                                'x-rewards-ismobile': 'true',
                                'x-rewards-country': region,
                                'x-rewards-language': 'zh',
                                'x-rewards-partnerid': 'startapp',
                                'x-rewards-flights': 'rwgobig'
                            },
                            data: JSON.stringify({
                                amount: 1,
                                country: region,
                                id: generateDapiId(),
                                type: 101,
                                channel: 'SAAndroid',
                                attributes: { offerid: readOfferId }
                            })
                        })).catch(() => null);

                        if (res) {
                            const resData = typeof res === 'string' ? JSON.parse(res) : res;
                            console.log(`[Rewards 阅读上报响应 ${currentArticleIdx}/${totalArticles}]:`, resData);

                            // 阅读成功后：进度 +step(3)，积分固定 +3
                            cur = Math.min(max, cur + step);
                            state.points = (state.points || 0) + 3;
                            state.readCur = cur;
                            render();

                            log(`🎉 第 ${currentArticleIdx}/${totalArticles} 篇阅读成功 (+3积分) | 进度: ${state.readCur}/${max} | 当前总积分: ${state.points}`);
                        } else {
                            log(`⚠️ 第 ${currentArticleIdx}/${totalArticles} 篇上报未收到有效响应，继续下一篇...`);
                        }

                        if (cur < max) {
                            await sleep(typeof randomRange === 'function' ? randomRange(2500, 4500) : 2500);
                        }
                    }

                    log(`✅ 阅读任务执行完毕 (最终进度: ${state.readCur}/${max})`);
                }
            } else {
                log(`⚠️ 未找到阅读任务卡片 (offerid: ${readOfferId})`);
            }
        } else {
            log('❌ 获取阅读进度失败');
        }

        await updateData();
    } catch (e) {
        log('❌ 阅读出错: ' + e.message);
        console.error('[Rewards 阅读异常]:', e);
    } finally {
        nodes.btnRead.disabled = false;
        markBusy(-1);
    }
};

nodes.btnRead.onclick = runRead;

    // 搜索 (复用逻辑)
    // 获取 Reward Token (活动专用)
    // async function getSearchToken() {
    //     try {
    //         const html = await gmRequest({ url: 'https://rewards.bing.com/' });
    //         // 尝试匹配两种常见的 Token 格式
    //         const token = html.match(/RequestVerificationToken.*?value="([^"]+)"/)?.[1] ||
    //             html.match(/"verificationToken":\s*"([^"]+)"/)?.[1];
    //         return token;
    //     } catch { return null; }
    // }

    const runPromo = async () => {
        nodes.btnPromo.disabled = true;
        markBusy(1);
        await waitWhilePaused();
        log('⏳ 开始执行活动任务...');
        await updateData();

        const appUa = "Mozilla/5.0 (Linux; Android 16; MEIZU 20 Build/BQ2A.251110.001-BP2A.250605.031.A3; ) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/150.0.7871.181 Mobile Safari/537.36 BingSapphire/33.8.440724006";
        const appId = "SAAndroid/33.8.440724006";

        // =========================================================================
        // 🌍 区域配置 (默认锁定 'cn')
        // -------------------------------------------------------------------------
        // 【修改说明】：
        // 1. 手动锁定特定区域：将 'cn' 改为相应国家代码，如 'us'(美国)、'hk'(香港) 等
        // 2. 切换为自动全区域：修改为 (state.country || dashboard?.userStatus?.country || 'cn').toLowerCase()
        // =========================================================================
        const customRegion = 'cn'; 
        const region = customRegion.toLowerCase();

        // 计算今日 YYYYMMDD 日期，用于拦截提前加载的未来每日任务
        const now = new Date();
        const todayYmd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;

        const generateDapiId = () => {
            const raw1 = (typeof uuid === 'function' ? uuid() : Math.random().toString(36)).replace(/-/g, '');
            const raw2 = (typeof uuid === 'function' ? uuid() : Math.random().toString(36)).replace(/-/g, '');
            return (raw1 + raw2).slice(0, 56);
        };

        const isTrue = (val) => {
            if (typeof val === 'boolean') return val;
            if (typeof val === 'string') return val.trim().toLowerCase() === 'true';
            return false;
        };

        // 1. 获取 Token
        let token = (typeof getSearchToken === 'function') ? await getSearchToken() : null;
        if (!token) token = state.searchToken;
        const accessToken = await getAccessToken();

        if (!token && !accessToken) {
            log('⚠️ 未获取到活动 Token，请刷新页面重试');
            nodes.btnPromo.disabled = false;
            markBusy(-1);
            return;
        }

        console.group('[Rewards 活动卡片诊断]');
        let rawTasks = [];

        // 递归挖掘任意对象中的卡片
        const extractCardsFromAnyObject = (obj, sourceName) => {
            if (!obj || typeof obj !== 'object') return;
            const found = [];
            const visited = new WeakSet();

            const search = (node) => {
                if (!node || typeof node !== 'object' || visited.has(node)) return;
                visited.add(node);

                const hasId = node.offerId || node.offerid || node.id || node.activityId;
                const hasAttr = node.title || node.name || node.points || node.pointProgressMax !== undefined || node.destinationUrl;

                if (hasId && hasAttr) {
                    found.push(node);
                    return;
                }

                if (Array.isArray(node)) {
                    for (const item of node) search(item);
                } else {
                    for (const key of Object.keys(node)) {
                        if (key.startsWith('jQuery') || key.startsWith('__')) continue;
                        search(node[key]);
                    }
                }
            };

            search(obj);
            if (found.length > 0) {
                console.log(`📌 从 [${sourceName}] 挖掘出 ${found.length} 个活动卡片数据`);
                rawTasks.push(...found);
            }
        };

        // 渠道 1：从本地 state / dashboard 提取
        if (typeof state !== 'undefined' && state.dashboard) extractCardsFromAnyObject(state.dashboard, "state.dashboard");
        if (typeof dashboard !== 'undefined' && dashboard) extractCardsFromAnyObject(dashboard, "全局 dashboard");

        // 渠道 2：通过 DAPI 移动端接口拉取
        if (accessToken) {
            try {
                const dapiRes = await gmRequest({
                    url: `https://prod.rewardsplatform.microsoft.com/dapi/me?channel=SAAndroid&version=33.8.440724006`,
                    headers: {
                        'authorization': `Bearer ${accessToken}`,
                        'user-agent': appUa,
                        'x-rewards-appid': appId,
                        'x-rewards-country': region
                    }
                });
                const dapiData = typeof dapiRes === 'string' ? JSON.parse(dapiRes) : dapiRes;
                if (dapiData?.response) {
                    extractCardsFromAnyObject(dapiData.response, "DAPI 接口 response");
                }
            } catch (e) {
                console.warn('⚠️ DAPI 请求失败:', e.message);
            }
        }

        // 2. 去重与精细化多重校验
        const seenIds = new Set();
        const taskList = [];

        for (const p of rawTasks) {
            if (!p) continue;

            const id = String(p.offerId || p.id || p.offerid || '');
            const title = p.title || p.name || p.description || '未命名活动';
            const progress = Number(p.pointProgress || 0);
            const max = Number(p.pointProgressMax || p.max || 0);

            if (!id || seenIds.has(id)) continue;

            // 规则 A：排除系统通知、漫游提示、每日签到卡片（需单独签到接口）及异常进度卡片
            const idUpper = id.toUpperCase();
            if (idUpper.includes('NOTIFICATION') || 
                idUpper.includes('ROAMING') || 
                idUpper.includes('CHECKIN') || 
                idUpper.includes('CHECK_IN') || 
                max > 100000) {
                console.log(`❌ [跳过-非通用任务/签到卡片] ${title} (id: ${id})`);
                continue;
            }

            // 规则 B：日期精准拦截（对于 DailySet 任务，拦截未到期的未来任务）
            const dateMatch = id.match(/20\d{6}/);
            if (dateMatch) {
                const cardDate = dateMatch[0];
                if (cardDate > todayYmd) {
                    console.log(`❌ [跳过-未来未到期任务] ${title} (id: ${id}, 日期: ${cardDate})`);
                    continue;
                }
            }

            // 规则 C：区域限制隔离（锁定 CN 时，跳过含有外区编码如 ENUS, US, JP 的任务）
            if (region === 'cn') {
                const nonCnRegex = /_(ENUS|US|UK|JP|DE|FR|CA|AU)_/i;
                if (nonCnRegex.test(id)) {
                    console.log(`❌ [跳过-外区任务] ${title} (id: ${id})`);
                    continue;
                }
            }

            // 规则 D：完成度及锁定校验
            const isCompleted = isTrue(p.complete) ||
                                isTrue(p.completed) ||
                                isTrue(p.isCompleted) ||
                                isTrue(p.attributes?.complete) ||
                                p.state === 'CLAIMED' ||
                                (max > 0 && progress >= max);

            if (isCompleted) {
                console.log(`❌ [跳过-已完成] ${title} (id: ${id}, 进度: ${progress}/${max})`);
                continue;
            }

            if (p.priority <= -2 || p.exclusiveLockedFeatureStatus === 'locked') {
                console.log(`❌ [跳过-已锁定] ${title} (id: ${id})`);
                continue;
            }

            seenIds.add(id);
            taskList.push(p);
            console.log(`✅ [待执行活动] ${title} (id: ${id}, 进度: ${progress}/${max})`);
        }

        console.groupEnd();

        if (taskList.length === 0) {
            log('✅ 所有活动已完成！');
            nodes.btnPromo.disabled = false;
            markBusy(-1);
            return;
        }

        log(`🎯 准备上报 ${taskList.length} 个未完成活动 (当前区域: ${region.toUpperCase()})`);

        let count = 0;
        const restInterval = randomRange(3, 5);

        for (const p of taskList) {
            await waitWhilePaused();
            try {
                const title = p.title || p.name || p.description || '活动任务';
                const offerId = p.offerId || p.id || p.offerid;
                const hash = p.hash || p.activityId || p.attributes?.hash || '1';

                log(`▶️ (${count + 1}/${taskList.length}) 执行: ${title}`);

                // 通道 1：Web 端标准 reportactivity
                if (token) {
                    const formData = new URLSearchParams({
                        id: offerId,
                        hash: hash,
                        timeZone: '480',
                        activityAmount: '1',
                        dbs: '0',
                        form: '',
                        type: '',
                        __RequestVerificationToken: token
                    });

                    await gmRequest({
                        method: 'POST',
                        url: 'https://rewards.bing.com/api/reportactivity?X-Requested-With=XMLHttpRequest',
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                            'X-Requested-With': 'XMLHttpRequest',
                            'Referer': 'https://rewards.bing.com/'
                        },
                        data: formData.toString()
                    }).catch(() => null);
                }

                // 通道 2：DAPI 移动端 101 上报
                if (accessToken) {
                    await gmRequest({
                        method: 'POST',
                        url: 'https://prod.rewardsplatform.microsoft.com/dapi/me/activities',
                        headers: {
                            'content-type': 'application/json; charset=UTF-8',
                            'user-agent': appUa,
                            'authorization': `Bearer ${accessToken}`,
                            'x-rewards-appid': appId,
                            'x-rewards-ismobile': 'true',
                            'x-rewards-country': region,
                            'x-rewards-language': 'zh',
                            'x-rewards-partnerid': 'startapp',
                            'x-rewards-flights': 'rwgobig'
                        },
                        data: JSON.stringify({
                            amount: 1,
                            country: region,
                            id: generateDapiId(),
                            type: 101,
                            channel: 'SAAndroid',
                            attributes: { offerid: offerId }
                        })
                    }).catch(() => null);
                }

                count++;

                // 防封随机延迟
                if (count < taskList.length) {
                    if (count % restInterval === 0) {
                        const restTime = randomRange(10000, 18000);
                        log(`☕ 模拟人类阅读休顿 ${(restTime / 1000).toFixed(1)} 秒...`);
                        await sleep(restTime);
                    } else {
                        const baseDelay = randomRange(4500, 8500);
                        log(`⏳ 间隔等待 ${(baseDelay / 1000).toFixed(1)} 秒...`);
                        await sleep(baseDelay);
                    }
                }
            } catch (e) {
                log(`❌ 活动执行失败: ${e.message}`);
            }
        }

        log(`✅ 活动全部完成，成功提交 ${count} 个活动`);
        await updateData();
        nodes.btnPromo.disabled = false;
        markBusy(-1);
    };

    nodes.btnPromo.onclick = runPromo;

    // 搜索模块：重构版（适配最新接口及稳定上报）
    const runSearch = async () => {
        if (state.running) {
            state.running = false;
            if (state.manualPaused) setManualPause(false, { silent: true });
            nodes.btnSearch.textContent = '🔍 搜索';
            updateAllButton();
            return;
        }
        state.running = true;
        nodes.btnSearch.textContent = '⏹ 停止';
        updateAllButton();
        await waitWhilePaused();

        await updateData();

        // 执行单次搜索与奖励触发
        const doSearch = async (query, isMobile = false) => {
            const host = isMobile ? 'cn.bing.com' : 'www.bing.com';
            const cookie = await getCookies(`https://${host}`);
            await waitWhilePaused();

            const ua = isMobile ? CONFIG.ua.mobile : CONFIG.ua.pc;
            const searchUrl = `https://${host}/search?q=${encodeURIComponent(query)}&form=QBLH`;

            try {
                // 1. 发送标准的 Bing 搜索请求
                const searchResult = await gmRequest({
                    url: searchUrl,
                    headers: {
                        'User-Agent': ua,
                        'Cookie': cookie,
                        'Referer': `https://${host}/?form=QBLH`
                    }
                });

                // 提取 IG 用于上报
                const igMatch = searchResult.match(/,IG:"([^"]+)"/) || searchResult.match(/"IG":"([^"]+)"/);
                const ig = igMatch ? igMatch[1] : crypto.randomUUID().replace(/-/g, '').toUpperCase();

                // 2. 使用微软 Rewards 专用侧边栏/头部埋点上报积分
                const reportHeaders = {
                    'User-Agent': ua,
                    'Cookie': cookie,
                    'Referer': searchUrl,
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
                };

                // 触发奖励计数埋点
                await gmRequest({
                    method: 'POST',
                    url: `https://${host}/rewardsapp/ncheader?ver=88888888&IID=SERP.5047&IG=${ig}&ajaxreq=1`,
                    headers: reportHeaders,
                    data: 'wb=1%3bi%3d1%3bv%3d1'
                }).catch(() => {});

                // 触发活动报告接口
                await gmRequest({
                    method: 'POST',
                    url: `https://${host}/rewardsapp/reportActivity?IG=${ig}&IID=SERP.5047&q=${encodeURIComponent(query)}&ajaxreq=1`,
                    headers: reportHeaders,
                    data: `url=${encodeURIComponent(searchUrl)}&V=web`
                }).catch(() => {});

                log(`✓ ${isMobile ? '📱' : '💻'} 搜索: "${query.substring(0, 12)}..."`);
            } catch (e) {
                console.error('[Rewards] 搜索异常:', e);
                log(`✗ 搜索失败: ${e.message}`);
            }
        };

        // 精确等待函数
        const preciseWait = async (ms) => {
            state.countdownStartTime = Date.now();
            state.countdownDuration = ms;
            let endTime = Date.now() + ms;

            while (Date.now() < endTime && state.running) {
                if (state.manualPaused) {
                    const pausedMs = await waitWhilePaused();
                    endTime += pausedMs;
                    state.countdownStartTime += pausedMs;
                    continue;
                }
                const remaining = Math.max(0, endTime - Date.now());
                const secs = Math.ceil(remaining / 1000);
                if (secs % 5 === 0 || secs <= 5) {
                    log(`⏳ 等待 ${secs} 秒...`);
                }
                await sleep(Math.min(1000, remaining));
            }
            state.countdownStartTime = 0;
            state.countdownDuration = 0;
        };

        // 暂停检查函数
        const checkPause = async () => {
            if (!CONFIG.pause.enabled) return;
            state.searchCount++;
            saveProgress();

            if (state.searchCount % CONFIG.pause.interval === 0) {
                state.isPaused = true;
                const pauseMinutes = CONFIG.pause.duration / 60000;
                log(`⏸️ 已完成 ${state.searchCount} 次搜索，暂停 ${pauseMinutes} 分钟...`);
                state.pauseEndTime = Date.now() + CONFIG.pause.duration;
                await preciseWait(CONFIG.pause.duration);
                state.isPaused = false;
                state.pauseEndTime = 0;
                log(`▶️ 暂停结束，继续搜索...`);
            }
        };

        loadProgress();

        // PC Search 循环 (计算还差多少分，每次按 3 分计算次数)
        const pcNeed = Math.ceil((state.pcMax - state.pcCur) / 3);
        if (pcNeed > 0) {
            log(`💻 开始搜索任务，共需执行 ${pcNeed} 次`);
            for (let i = 0; i < pcNeed && state.running; i++) {
                await waitWhilePaused();
                
                // ✨ 核心改为：在每次新搜索执行前同步数据（第1次搜索已在循环前同步过，后续每次倒计时结束后、搜前同步）
                if (i > 0) {
                    await updateData();
                }

                const q = await getHotQuery();
                await doSearch(q, false);
                await checkPause();

                if (!state.running) break;
                await preciseWait(randomRange(CONFIG.pc.minDelay, CONFIG.pc.maxDelay));
            }
        } else {
            log('💻 搜索任务已全部完成');
        }

        await updateData();
        state.running = false;
        nodes.btnSearch.textContent = '🔍 搜索';
        updateAllButton();
        log('🏁 搜索任务全部结束');
        saveProgress();
    };
    nodes.btnSearch.onclick = runSearch;

    nodes.btnAll.onclick = async () => {
        if (state.manualPaused || state.running || state.allRunning || state.busyCount > 0) {
            setManualPause(!state.manualPaused);
            return;
        }
        state.allRunning = true;
        updateAllButton();
        log('🚀 一键执行开始');
        try {
            await waitWhilePaused();
            await runSign();
            await runRead();
            await runPromo();
            await runSearch();
        } finally {
            state.allRunning = false;
            updateAllButton();
        }
    };

    // Init
    (async () => {
        try {
            loginCookie = await getCookies('https://login.live.com');

            console.log(
                '[Rewards] 登录Cookie长度:',
                loginCookie.length
            );
            await updateData();
            // Try load read progress if token exists
            try {
                const info = await withAccessTokenRequest(token => gmRequest({
                    url: 'https://prod.rewardsplatform.microsoft.com/dapi/me?channel=SAAndroid&options=613',
                    headers: { 'Authorization': `Bearer ${token}`, 'X-Rewards-AppId': 'SAAndroid/31.4.2110003555', 'X-Rewards-IsMobile': 'true' }
                }));
                if (info) {
                    const d = JSON.parse(info);
                    const p = d.response?.promotions?.find(x => x.attributes?.offerid === 'ENUS_readarticle3_30points');
                    if (p) { state.readCur = +p.attributes.progress; state.readMax = +p.attributes.max; render(); }
                }
            } catch { }
        } catch { }
        //GM_setValue("Config.lastSignDate", "");
        log('🌟 脚本就绪 v1.0.1');
    })();

    setInterval(updateData, 60000);

})();
