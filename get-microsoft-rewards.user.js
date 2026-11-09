// ==UserScript==
// @name         Get Microsoft Rewards (修复/增强版)
// @namespace    https://github.com/Muverix/Get-Microsoft-Rewards
// @version      1.4.2
// @description  微软 Rewards 页面内助手：本地搜索、活动提交、每日签到、阅读、月度/周度打卡进度查看，全部在页面里一键完成。
// @author       Muverix
// @license      MIT
// @icon         https://rewards.bing.com/rewardscdn/images/rewards.png
// @homepage     https://scriptcat.org/zh-CN/script-show-page/7354
// @supportURL   https://github.com/Muverix/Get-Microsoft-Rewards/issues
// @match        https://*.bing.com/*
// @match        https://*.microsoft.com/*
// @match        https://login.live.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_notification
// @grant        GM_cookie
// @grant        GM_registerMenuCommand
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
// ==/UserScript==

/* =========================================================================
 * 📜 版权声明与免责条款 (License & Disclaimer)
 * -------------------------------------------------------------------------
 * 1. 本脚本基于 QingJ 的开源项目《Get Microsoft Rewards》二次开发。
 * 2. 借助AI，参考其他相关模块进行优化。
 * 3. 本脚本遵循 MIT 开源许可协议，仅供个人学习研究与自动化测试使用。
 * 4. 作者不对使用本脚本可能产生的任何风险（如账号积分变动或风控等）承担任何法律责任，请合理使用。
 * ========================================================================= */

(function () {
    'use strict';
    const APP_VERSION =
        (typeof GM_info !== 'undefined' && GM_info?.script?.version) ||
        (document.currentScript?.textContent?.match(/@version\s+([\w.\-]+)/i) || [])[1] ||
        '0.0.0';
    // 登录页只抓授权码；此分支必须排在站点白名单之前
    if (/^(login\.(live|microsoftonline)\.com|account\.live\.com)$/i.test(location.hostname)) {
        initOAuthCapturePage();
        return;
    }

    const HOST_SUPPORTED = ['rewards.bing.com', 'www.bing.com', 'cn.bing.com'];
    if (!HOST_SUPPORTED.includes(window.location.hostname)) return;

    function initOAuthCapturePage() {
        const href = location.href;
        const esc = (s) => String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        let code = '';
        const m = href.match(/[?&#]code=([^&#\s"']+)/i);
        if (m) {
            try { code = decodeURIComponent(m[1]); } catch (e) { code = m[1]; }
        }
        const errM = href.match(/[?&#]error=([^&#\s&]+)/i);
        const errDesc = href.match(/[?&#]error_description=([^&#]+)/i);

        if (!code && !errM) return;

        try {
            if (code) {
                GM_setValue('auth_code', code);
                GM_setValue('auth_code_time', String(Date.now()));
                GM_setValue('auth_pending', '');
                console.log('[Rewards] 已自动捕获授权码，长度:', code.length);
            }
        } catch (e) { }

        const box = document.createElement('div');
        box.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:min(360px,92vw);box-sizing:border-box;background:#fff;color:#222;border:1px solid #e0e0e0;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.15);padding:20px;font:14px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;z-index:2147483647;text-align:center;';

        if (code) {
            box.innerHTML = `
                <div style="font-size:34px;line-height:1">✅</div>
                <div style="font-weight:700;font-size:16px;margin:8px 0 6px">授权码已自动获取</div>
                <div style="color:#666;font-size:13px">现在可以关闭本页，回到 Bing 标签页。<br>脚本会自动填充授权码并完成兑换。</div>
                <div style="margin:12px 0;padding:8px;background:#fafafa;border:1px solid #eee;border-radius:6px;font:11px/1.5 monospace;color:#888;word-break:break-all">${esc(code.slice(0, 24))}…</div>
                <div style="display:flex;gap:8px;margin-top:12px">
                    <button id="mr-cap-copy" style="flex:1;min-height:42px;border:1px solid #d0d0d0;background:#fff;color:#333;border-radius:6px;font-size:14px">📋 复制授权码</button>
                    <button id="mr-cap-close" style="flex:1;min-height:42px;border:none;background:#0078d4;color:#fff;border-radius:6px;font-size:14px">关闭本页</button>
                </div>
            `;
        } else {
            const e1 = errM ? errM[1].slice(0, 80) : '未知错误';
            let e2 = '';
            try { e2 = errDesc ? decodeURIComponent(errDesc[1].replace(/\+/g, ' ')) : ''; } catch (e) { e2 = errDesc ? errDesc[1] : ''; }
            e2 = e2.slice(0, 200);
            box.innerHTML = `
                <div style="font-size:34px;line-height:1">⚠️</div>
                <div style="font-weight:700;font-size:16px;margin:8px 0 6px">授权被取消或失败</div>
                <div style="color:#666;font-size:13px;word-break:break-all">${esc(e1)}${e2 ? '<br>' + esc(e2) : ''}</div>
                <div style="color:#666;font-size:13px;margin-top:8px">关闭本页，回到 Bing 后重新点击「获取授权码」。</div>
                <button id="mr-cap-close" style="width:100%;min-height:42px;margin-top:12px;border:none;background:#0078d4;color:#fff;border-radius:6px;font-size:14px">关闭本页</button>
            `;
        }

        const mount = () => { if (document.body) document.body.appendChild(box); };
        if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);

        const closeBtn = box.querySelector('#mr-cap-close');
        if (closeBtn) closeBtn.onclick = () => { window.close(); };
        const copyBtn = box.querySelector('#mr-cap-copy');
        if (copyBtn) copyBtn.onclick = async () => {
            try {
                await navigator.clipboard.writeText(code);
                copyBtn.textContent = '✅ 已复制';
            } catch (e) {
                copyBtn.textContent = '请长按上方授权码复制';
            }
        };
    }

    // ========== 环境识别：脚本跑在手机上还是电脑上 ==========
    const isMobileEnv = () => {
        try {
            const ua = navigator.userAgent || '';
            if (/Android|iPhone|iPod|iPad|HarmonyOS|Mobile|Windows Phone|BlackBerry|Opera Mini|IEMobile/i.test(ua)) return true;
            if (/Macintosh/i.test(ua) && (navigator.maxTouchPoints || 0) > 1) return true; // iPadOS 桌面版 UA
            if (/Windows|Macintosh|Linux/i.test(ua) === false && matchMedia('(pointer: coarse)').matches) return true;
        } catch { /* ignore */ }
        return false;
    };
    const ENV_MOBILE = isMobileEnv();

    // ========== 搜索站点：跟随脚本当前所在的 Bing 域名 ==========
    const currentSearchHost = () => {
        const h = (location.hostname || '').toLowerCase();
        if (h === 'cn.bing.com' || h === 'www.bing.com') return h;
        return 'www.bing.com';
    };

    // ========== 配置 ==========
    const CONFIG = {
        pc: { minDelay: 18000, maxDelay: 35000 },
        mobile: { minDelay: 25000, maxDelay: 45000 },
        ua: {
            pc: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36 Edg/157.0.0.0',
            mobile: 'Mozilla/5.0 (Linux; Android 16; MEIZU 20 Build/BQ2A.251110.001-BP2A.250605.031.A3; ) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/150.0.7871.181 Mobile Safari/537.36 BingSapphire/34.3.441014006',
            rewardsApp: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36 Edg/153.0.0.0 MSRewards/Desktop/1.3.0'
        },
        mobileApi: {appId: 'SAAndroid/34.3.441014006'},
        read: { minDelay: 15000, maxDelay: 30000 },
        hotApis: [
            { url: 'https://hot.baiwumm.com/api/', sources: ['weibo', 'douyin', 'baidu', 'zhihu', 'toutiao'] },
            { url: 'https://hotapi.nntool.cc/', sources: ['weibo', 'douyin', 'baidu', 'toutiao', 'zhihu'] },
            { url: 'https://cnxiaobai.com/DailyHotApi/', sources: ['weibo', 'douyin', 'baidu', 'toutiao'] }
        ],
        keywords: ["天气预报", "今日新闻", "体育赛事", "股票行情", "电影推荐", "科技资讯", "美食食谱", "旅游攻略"],
        pause: {
            enabled: true,
            interval: 15,
            duration: () => (2 + Math.random() * 3) * 60 * 1000
        }
    };

    // ========== dapi APP 通道：统一常量与请求头 ==========
    const DAPI_ME_URL = 'https://prod.rewardsplatform.microsoft.com/dapi/me?channel=SAAndroid&options=613';
    const DAPI_ACTIVITY_URL = 'https://prod.rewardsplatform.microsoft.com/dapi/me/activities';
    const READ_OFFER_ID = 'ENUS_readarticle3_30points';
    const currentRegion = () => String(
        state.country || dashboard?.userStatus?.country || dashboard?.country || 'cn'
    ).toLowerCase();
    const dapiHeaders = (token, region, withContentType = true) => {
        const h = {
            'user-agent': CONFIG.ua.mobile,
            'authorization': `Bearer ${token}`,
            'x-rewards-appid': CONFIG.mobileApi.appId,
            'x-rewards-ismobile': 'true',
            'x-rewards-country': region,
            'x-rewards-language': 'zh',
            'x-rewards-partnerid': 'startapp',
            'x-rewards-flights': 'rwgobig'
        };
        if (withContentType) h['content-type'] = 'application/json; charset=UTF-8';
        return h;
    };

    const dapiMeCache = { at: 0, region: '', data: null };
    async function getDapiMe(token, region, useCache = false) {
        if (useCache && dapiMeCache.data && dapiMeCache.region === region && Date.now() - dapiMeCache.at < 30000) {
            return dapiMeCache.data;
        }
        const res = await gmRequest({
            method: 'GET',
            url: DAPI_ME_URL + `&_=${Date.now()}`,
            headers: dapiHeaders(token, region)
        });
        const data = typeof res === 'string' ? JSON.parse(res) : res;
        dapiMeCache.data = data;
        dapiMeCache.region = region;
        dapiMeCache.at = Date.now();
        return data;
    }

    const savePromoScore = () => {
        try {
            GM_setValue('mr_promo_score', JSON.stringify({ date: getTodayYmd(), done: state.promosDone, total: state.promosTotal }));
        } catch { }
    };

    async function retryWithFreshToken(requestFn) {
        state.accessToken = null;
        state.accessTokenExpiresAt = 0;
        const token = await getAccessToken({ forceRefresh: true });
        if (!token) return null;
        return { res: await requestFn(token) };
    }

    const SYNC_STALE_MS = 3 * 60 * 1000;

    // ========== 状态 ==========
    let state = {
        level: 1, points: 0,
        readRunning: false,
        pcCur: 0, pcMax: 0,
        promosTotal: 0, promosDone: 0,
        readCur: 0, readMax: 0,
        running: false,
        allRunning: false,
        busyCount: 0,
        accessToken: null,
        accessTokenExpiresAt: 0,
        updatingPromise: null,
        searchCount: 0,           // 当前搜索计数（用于暂停判断）
        manualPaused: false,      // 手动暂停
        pausePromise: null,
        pauseResolver: null,
        country: '',
        quests: [],
        questDetailIdx: -1,   // 其他任务：当前点击展开的任务下标（-1 = 未展开）
        claimRunning: false,
        punchcardRunning: false,
        needLogin: false,     // 抓到登录页 → 提示用户去登录 rewards.bing.com
        loginReason: '',      // 触发提醒的来源（dash / earn / quest），仅用于提示文案
        syncStale: false,
        syncReason: '',       // 未同步的原因，鼠标悬停时显示
        syncAt: 0,            // 上次成功同步的时间戳
        syncRetryAt: 0,       // 上次点徽章手动同步的时间，用于节流
        syncBusy: false,      // 手动同步进行中 → 徽章显示「⟳ 同步中」
        syncStartedAt: Date.now(), // 脚本启动时间，syncAt 为 0 时用它兜底计时
        dataDate: '',             // 最近一次全量同步对应的日期，跨天自动重拉
        lastProgressAt: 0,        // 上次刷新网页侧进度（活动 / 可领取积分）的时间
        lastQuestAt: 0            // 上次刷新其他任务（打卡详情）的时间
    };
    let dashboard = null;

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
        if (data.date === getDateHyphen()) {
            state.searchCount = data.searchCount || 0;
            return data;
        } else {
            resetProgress(); // 跨天重置本地和内存中的计数
        }
    } catch (e) { }
    return null;
}

    async function withAccessTokenRequest(requestFn) {
        let token = await getAccessToken();
        if (!token) {
            console.warn('[Rewards] 初始 Token 为空，尝试强制刷新...');
            token = await getAccessToken({ forceRefresh: true });
        }

        if (!token) {
            logToken('⚠️ 未获取到活动Token，请确认登录状态或刷新页面重试');
            return null;
        }

        try {
            const res = await requestFn(token);

            if (typeof res === 'string' && (res.includes('invalid_token') || res.includes('Unauthorized') || res.includes('"code":401'))) {
                console.warn('[Rewards] 响应中检测到 Token 失效，重新获取 Token 中...');
                const retry = await retryWithFreshToken(requestFn);
                if (retry) return retry.res;
            }
            return res;
        } catch (e) {
            const is401 = (e && e.status === 401) ||
                          (e && e.responseStatus === 401) ||
                          (e && e.message && (e.message.includes('401') || e.message.includes('Unauthorized')));

            if (is401) {
                console.warn('[Rewards] 捕获到网络层 401 异常，重新获取 Token 中...');
                const retry = await retryWithFreshToken(requestFn);
                if (retry) return retry.res;
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
    const generateDapiId = () => {
    const raw1 = uuid().replace(/-/g, '');
    const raw2 = uuid().replace(/-/g, '');
    return (raw1 + raw2).slice(0, 56);
    };

    async function gmRequest(options) {
        const retries = options.retries ?? 2;
        const retryDelay = options.retryDelay ?? 1000;
        const { retries: _retries, retryDelay: _retryDelay, ...reqOptions } = options;
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
                        ...reqOptions,
                        onload: xhr => {
                            if (xhr.status >= 200 && xhr.status < 300) {
                                resolve(options.returnUrl ? xhr.finalUrl : xhr.responseText);
                            } else if (xhr.status >= 300 && xhr.status < 400) {
                                const loc = (String(xhr.responseHeaders || '').match(/^\s*location:\s*(.*?)\s*$/im) || [])[1] || '';
                                const err = new Error(`HTTP ${xhr.status}${loc ? ' → ' + loc : '（重定向）'}`);
                                err.status = xhr.status;
                                err.location = loc;
                                err.responseText = xhr.responseText;
                                err.finalUrl = xhr.finalUrl;
                                reject(err);
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
                await sleep(delay + randomRange(300, 1200));
            }
        }
    }

    async function getHotQuery() {
        const apis = [...CONFIG.hotApis].sort(() => Math.random() - 0.5);

        for (const api of apis) {
            try {
                const src = randomPick(api.sources);
                const res = await gmRequest({ method: 'GET', url: api.url + src, timeout: 8000 });
                const data = JSON.parse(res);
                if (data.code === 200 && data.data?.length) {
                    const title = randomPick(data.data).title || '';
                    const len = randomRange(8, 25);
                    return title.substring(0, len);
                }
            } catch { /* 尝试下一个API */ }
        }
        return `${randomPick(CONFIG.keywords)} ${Math.random().toString(36).slice(2, 6)}`;
    }

    function getCookies(url) {
        return new Promise(resolve => {
            const docCookie = () => {
                try {
                    const u = new URL(url, location.href);
                    const strip = h => h.replace(/^www\./, '');
                    if (strip(u.hostname) !== strip(location.hostname)) return '';
                    return document.cookie || '';
                } catch { return ''; }
            };
            let done = false;
            let cookieTimer = null;
            const finish = (val) => {
                if (done) return;
                done = true;
                if (cookieTimer) clearTimeout(cookieTimer);
                resolve(val || '');
            };

            if (typeof GM_cookie === 'undefined' || !GM_cookie || typeof GM_cookie.list !== 'function') {
                console.warn('[Rewards] GM_cookie 不可用，改用 document.cookie（仅同源有效）');
                return finish(docCookie());
            }

            try {
                cookieTimer = setTimeout(() => finish(docCookie()), 3000);
                GM_cookie.list({ url }, cookies => {
                    if (!cookies || !cookies.length) {
                        console.warn('[Rewards] Cookie为空:', url);
                        return finish(docCookie());
                    }
                    finish(cookies.map(c => `${c.name}=${c.value}`).join('; '));
                });
            } catch (e) {
                console.error('[Rewards] Cookie获取失败', e);
                finish(docCookie());
            }
        });
    }

    // ========== 样式 (极简版) ==========
    GM_addStyle(`
        #mr-panel {
            position: fixed;
            bottom: calc(20px + env(safe-area-inset-bottom, 0px));
            right: calc(20px + env(safe-area-inset-right, 0px));
            z-index: 2147483647;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: #fff;
            border: 1px solid #e0e0e0;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            border-radius: 8px;
            --mr-active-border: rgba(135, 100, 184, .55);
        }
        #mr-panel.dragging { transition: none !important; cursor: grabbing; }

        #mr-panel.collapsed {
            width: 44px;
            height: 44px;
            border-radius: 50%;
            cursor: grab;
            touch-action: none;
            user-select: none;
            display: flex;
            justify-content: center;
            align-items: center;
            background: #fff;
            color: #0078d4;
            box-shadow: 0 4px 16px rgba(0,120,212,0.3);
            border: 1px solid #e0e0e0;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        #mr-panel.collapsed:hover { transform: scale(1.1); box-shadow: 0 6px 20px rgba(0,120,212,0.4); }
        #mr-panel.collapsed svg { width: 24px; height: 24px; fill: currentColor; }
        #mr-panel.collapsed #mr-container { display: none; }

        #mr-panel:not(.collapsed) {
            width: 300px;
            max-width: calc(100vw - 24px);
            max-height: calc(100vh - 40px);
        }
        #mr-panel:not(.collapsed) svg { display: none; }
        #mr-container {
            max-height: calc(100vh - 42px);
            overflow-y: auto;
            overscroll-behavior: contain;
            -webkit-overflow-scrolling: touch;
            border-radius: 8px;
        }

        #mr-header {
            padding: 12px 16px;
            border-bottom: 1px solid #eee;
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: #f8f9fa;
            border-radius: 8px 8px 0 0;
            cursor: grab;
            user-select: none;
            touch-action: none;
        }
        #mr-title { font-weight: 600; font-size: 14px; color: #333; }
        #mr-close { cursor: pointer; color: #999; font-size: 18px; line-height: 1; }
        #mr-close:hover { color: #333; }

        #mr-body { padding: 16px; }

        .mr-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 12px; color: #555; }
        .mr-val { font-weight: 600; color: #333; }

        #mr-login-tip {
            display: flex; align-items: center; justify-content: space-between; gap: 6px;
            margin-bottom: 10px; padding: 7px 9px;
            background: #fdecea; border: 1px solid #f5c2c0; border-radius: 4px;
            font-size: 11px; line-height: 15px; color: #a4262c;
            cursor: pointer; user-select: none;
        }
        #mr-login-tip:hover { background: #fbdedc; }
        #mr-login-tip:active { transform: scale(.99); }
        #mr-login-tip .mr-login-go { color: #d83b01; font-weight: 700; white-space: nowrap; }

        .mr-progress-bg { height: 4px; background: #eee; border-radius: 2px; margin-bottom: 12px; overflow: hidden; }
        .mr-bar { height: 100%; background: #0078d4; }

        .mr-quest-grid { display: flex; gap: 6px; margin-bottom: 12px; }
        .mr-quest-col {
            flex: 1; min-width: 0; cursor: pointer;
            padding: 2px 3px 3px; border-radius: 4px;
            border: 1px solid transparent;
            transition: border-color .15s ease, background .15s ease;
        }
        .mr-quest-label {
            font-size: 10px; line-height: 12px; color: #999; text-align: center;
            margin-bottom: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .mr-quest-label.can { color: #d13438; font-weight: 600; }
        .mr-quest-label.done { color: #107c41; }
        .mr-quest-track { height: 4px; background: #eee; border-radius: 2px; overflow: hidden; }
        .mr-quest-fill { height: 100%; background: #8764b8; border-radius: 2px; }
        .mr-quest-fill.done { background: #107c41; }
        .mr-quest-col.active {
            background: #f5f3fa;
            border-color: var(--mr-active-border);
        }
        .mr-quest-col.active .mr-quest-label { color: #8764b8; font-weight: 700; }
        .mr-quest-detail {
            font-size: 10px; line-height: 14px; color: #555;
            background: #f5f3fa; border-radius: 4px; padding: 4px 6px;
            border: 1px solid var(--mr-active-border);
            margin-top: -6px; margin-bottom: 12px; word-break: break-all;
        }
        .mr-row-right { display: inline-flex; align-items: center; gap: 6px; }
        .mr-go {
            font-size: 10px; line-height: 14px; padding: 0 5px;
            border: 1px solid #8764b8; color: #8764b8; border-radius: 3px;
            text-decoration: none; white-space: nowrap; cursor: pointer;
            user-select: none;
        }
        .mr-go:hover { background: #8764b8; color: #fff; }
        .mr-go:active { transform: scale(.96); }
        .mr-go-claim { border-color: #d83b01; color: #d83b01; }
        .mr-go-claim:hover { background: #d83b01; color: #fff; }
        .mr-quest-link { color: #8764b8; text-decoration: underline; cursor: pointer; margin-left: 4px; }

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
        .mr-btn:disabled { opacity: .45; cursor: not-allowed; }
        .mr-full { grid-column: span 2; background: #0078d4; color: #fff; border: none; }
        .mr-full:hover { background: #006abc; }

        #mr-auth { margin-bottom: 12px; padding: 10px; background: #fff8e1; border: 1px solid #ffe0b2; border-radius: 4px; }
        .mr-input { width: 100%; padding: 4px; border: 1px solid #ccc; font-size: 11px; margin: 4px 0; }

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
    // Bing 搜索页启用 Trusted Types，innerHTML 必须走 setHTML()
    let mrHtmlPolicy = null;
    try {
        const TT = typeof globalThis !== 'undefined' ? globalThis.trustedTypes : null;
        if (TT && typeof TT.createPolicy === 'function') {
            mrHtmlPolicy = TT.createPolicy('mr-panel-' + Math.random().toString(36).slice(2), { createHTML: s => s });
        }
    } catch { }
    const setHTML = (el, html) => {
        if (!el) return;
        try {
            if (mrHtmlPolicy) { el.innerHTML = mrHtmlPolicy.createHTML(html); return; }
        } catch { }
        el.innerHTML = html;
    };

    const panel = document.createElement('div');
    panel.id = 'mr-panel';
    panel.className = 'collapsed';
    const svgIcon = `<svg viewBox="0 0 24 24"><path d="M20 6h-3V4c0-1.1-.9-2-2-2H9c-1.1 0-2 .9-2 2v2H4c-1.1 0-2 .9-2 2v3h2v9c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-9h2V8c0-1.1-.9-2-2-2zm-9-2h2v2h-2V4zm0 16H6v-9h5v9zm6 0h-5v-9h5v9zm1.5-11H16V7h2v2zm-4.5 0h-2V7h2v2zm-4.5 0H7V7h2v2zm-3.5 0H4V7h1.5v2z"/></svg>`;

    setHTML(panel, `
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
                    <span style="color:#d83b01"><span id="mr-sync" style="display:inline-block;margin-right:6px;padding:0 5px;border-radius:3px;background:#f3f2f1;color:#605e5c;font-size:10px;line-height:14px;font-weight:700;cursor:pointer;white-space:nowrap;vertical-align:middle;user-select:none" title="点击强制同步全部：积分 / 搜索 / 阅读 / 日常活动 / 其他任务 / 可领取积分">⟳ 同步中</span><span id="mr-points">0</span> pts</span>
                </div>

                <!-- 未登录提醒（拿到登录页，或页面 200 但读不到账号数据时显示） -->
                <div id="mr-login-tip" style="display:none">
                    <span id="mr-login-msg">🔐 未登录 Microsoft Rewards，活动/打卡/可领取积分将取不到数据</span>
                    <span class="mr-login-go">去登录 →</span>
                </div>

                <!-- 可领取积分（检测到才显示）：「去领取」直达官网领取弹窗 -->
                <div class="mr-row" id="mr-claim" style="display:none">
                    <span>🎁 可领取积分</span>
                    <span class="mr-row-right">
                        <span id="mr-claim-go" class="mr-go mr-go-claim" role="button" title="打开 Rewards 领取弹窗（dashboard?modal=pointsclaim）">去领取 →</span>
                        <span id="mr-claim-amt" style="font-weight:600;color:#d83b01">0</span>
                    </span>
                </div>

                <!-- 进度 -->
                <div class="mr-row"><span>📅 每日签到</span><span id="mr-sign-status" style="font-weight:600">未签到</span></div>

                <div class="mr-row"><span>🎯 日常活动</span><span id="mr-promo">0/0</span></div>
                <div class="mr-progress-bg"><div class="mr-bar" id="mr-promo-bar" style="background:#107c41"></div></div>

                <div class="mr-row"><span>📖 阅读任务</span><span id="mr-read">0/0</span></div>
                <div class="mr-progress-bg"><div class="mr-bar" id="mr-read-bar" style="background:#ff8c00"></div></div>

                <div class="mr-row"><span>🔍 搜索任务</span><span id="mr-pc">0/0</span></div>
                <div class="mr-progress-bg"><div class="mr-bar" id="mr-pc-bar"></div></div>

                <div class="mr-row"><span>📋 其他任务</span><span class="mr-row-right"><span id="mr-punch-go" class="mr-go" role="button" title="前往 Rewards 活动页">前往完成</span><span id="mr-punch">-</span></span></div>
                <div class="mr-quest-grid" id="mr-punch-bar"></div>
                <div class="mr-quest-detail" id="mr-quest-detail" style="display:none"></div>

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
                    <button id="btn-promo" class="mr-btn">🎯 活动</button>
                    <button id="btn-sign" class="mr-btn">✅ 签到</button>
                    <button id="btn-read" class="mr-btn">📖 阅读</button>
                    <button id="btn-all" class="mr-btn mr-full">🚀 一键全部执行</button>
                </div>

                <!-- 日志 -->
                <div id="mr-log"></div>
            </div>
        </div>
    `);
    document.body.appendChild(panel);

    const $ = id => document.querySelector(id);
    const nodes = {
        panel: $('#mr-panel'),
        close: $('#mr-close'),
        level: $('#mr-level'),
        points: $('#mr-points'),
        sync: $('#mr-sync'),
        pc: $('#mr-pc'),
        pcBar: $('#mr-pc-bar'),
        signStatus: $('#mr-sign-status'),
        read: $('#mr-read'),
        readBar: $('#mr-read-bar'),
        punch: $('#mr-punch'),
        punchBar: $('#mr-punch-bar'),
        punchGo: $('#mr-punch-go'),
        questDetail: $('#mr-quest-detail'),
        promo: $('#mr-promo'),
        promoBar: $('#mr-promo-bar'),
        claim: $('#mr-claim'),
        claimAmt: $('#mr-claim-amt'),
        claimGo: $('#mr-claim-go'),
        loginTip: $('#mr-login-tip'),
        loginMsg: $('#mr-login-msg'),
        btnSearch: $('#btn-search'),
        btnPromo: $('#btn-promo'),
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

    // ===== 悬浮球可拖动 =====
    const POS_KEY = 'mr_panel_pos';
    const viewW = () => window.innerWidth || document.documentElement?.clientWidth || 1024;
    const viewH = () => window.innerHeight || document.documentElement?.clientHeight || 768;
    const readPanelPos = () => {
        try {
            const p = GM_getValue(POS_KEY, null);
            return (p && Number.isFinite(p.r) && Number.isFinite(p.b)) ? p : null;
        } catch { return null; }
    };
    let panelPos = readPanelPos();
    const panelSize = () => {
        const collapsed = panel.classList.contains('collapsed');
        return {
            w: panel.offsetWidth || (collapsed ? 44 : 300),
            h: panel.offsetHeight || (collapsed ? 44 : 200)
        };
    };
    const applyPanelPos = () => {
        if (!panelPos) return;
        const { w, h } = panelSize();
        const r = Math.max(0, Math.min(panelPos.r, Math.max(0, viewW() - w)));
        const b = Math.max(0, Math.min(panelPos.b, Math.max(0, viewH() - h)));
        panel.style.right = `${r}px`;
        panel.style.bottom = `${b}px`;
    };

    let drag = null, suppressClick = false;
    const onPointerDown = (e) => {
        if (e.button != null && e.button !== 0) return;      // 只认左键
        const t = e.target;
        const collapsed = panel.classList.contains('collapsed');
        const onHandle = collapsed || !!(t && t.closest && t.closest('#mr-header') && !t.closest('#mr-close'));
        if (!onHandle) return;
        const rect = typeof panel.getBoundingClientRect === 'function' ? panel.getBoundingClientRect() : null;
        const baseR = panelPos ? panelPos.r : (rect ? Math.max(0, viewW() - rect.right) : 20);
        const baseB = panelPos ? panelPos.b : (rect ? Math.max(0, viewH() - rect.bottom) : 20);
        drag = { x: e.clientX, y: e.clientY, baseR, baseB, moved: false };
    };
    const onPointerMove = (e) => {
        if (!drag) return;
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (!drag.moved && Math.hypot(dx, dy) < 5) return;   // 5px 阈值：轻点仍是点击
        if (!drag.moved) { drag.moved = true; panel.classList.add('dragging'); }
        if (e.preventDefault) e.preventDefault();
        const { w, h } = panelSize();
        panelPos = {
            r: Math.max(0, Math.min(drag.baseR - dx, Math.max(0, viewW() - w))),
            b: Math.max(0, Math.min(drag.baseB - dy, Math.max(0, viewH() - h)))
        };
        applyPanelPos();
    };
    const onPointerUp = () => {
        if (!drag) return;
        const moved = drag.moved;
        drag = null;
        panel.classList.remove('dragging');
        if (!moved) return;
        suppressClick = true;                                 // 拖完那一下 click 不能展开/误触按钮
        try { GM_setValue(POS_KEY, panelPos); } catch { }
        setTimeout(() => { suppressClick = false; }, 0);
    };
    panel.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
    document.addEventListener('pointercancel', onPointerUp);
    window.addEventListener('blur', onPointerUp);
    document.addEventListener('click', (e) => {
        if (!suppressClick) return;
        suppressClick = false;
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        else e.stopPropagation();
        if (e.preventDefault) e.preventDefault();
    }, true);
    window.addEventListener('resize', () => applyPanelPos());
    applyPanelPos();

    nodes.panel.onclick = (e) => {
        if (suppressClick) { suppressClick = false; return; }
        if (nodes.panel.classList.contains('collapsed')) {
            nodes.panel.classList.remove('collapsed');
            applyPanelPos();                                  // 尺寸变了，按新宽高重新贴边
        }
    };
    nodes.close.onclick = (e) => {
        e.stopPropagation();
        nodes.panel.classList.add('collapsed');
        applyPanelPos();
    };

    const LOG_MAX_LINES = 200;
    const hhmm = () => {
        const d = new Date();
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    };
    const log = (msg) => {
        const div = document.createElement('div');
        div.textContent = `[${hhmm()}] ${msg}`;
        nodes.logBox.appendChild(div);
        while (nodes.logBox.childNodes.length > LOG_MAX_LINES) {
            nodes.logBox.removeChild(nodes.logBox.firstChild);
        }
        nodes.logBox.scrollTop = nodes.logBox.scrollHeight;
    };

    const ensurePanel = () => {
        if (!document.body) return false;
        if (document.getElementById('mr-panel')) return false;
        document.body.appendChild(panel);
        applyPanelPos();
        return true;
    };
    setInterval(() => {
        if (ensurePanel()) {
            panel.classList.remove('collapsed');
            try { log('🔧 面板被页面移除，已重新挂载'); } catch { }
        }
    }, 5000);
    if (typeof GM_registerMenuCommand === 'function') {
        GM_registerMenuCommand('🎁 显示 Rewards 面板', () => {
            ensurePanel();
            panel.classList.remove('collapsed');
            applyPanelPos();
        });
        GM_registerMenuCommand('↺ 复位悬浮球位置', () => {
            try { GM_setValue(POS_KEY, null); } catch { }
            panelPos = null;
            panel.style.right = '';
            panel.style.bottom = '';
        });
    }

    if (nodes.sync) {
        nodes.sync.onclick = async () => {
            if (state.syncBusy) return;               // 正在同步，忽略连点
            const now = Date.now();
            if (now - (state.syncRetryAt || 0) < 5 * 1000) {
                log('⏳ 5 秒内只同步一次，请稍等');
                return;
            }
            state.syncRetryAt = now;
            state.syncBusy = true;
            render();                                  // 先变「⟳ 同步中」
            log('🔄 手动同步全部任务进度…');
            try {
                await syncAll();
            } catch { /* 各环节内部已兜底 */ }
            state.syncBusy = false;
            render();                                  // 按结果变绿 / 变红
        };
    }

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

    const AUTH_URL = 'https://login.live.com/oauth20_authorize.srf?client_id=0000000040170455&scope=service::prod.rewardsplatform.microsoft.com::MBI_SSL&response_type=code&redirect_uri=https://login.live.com/oauth20_desktop.srf';

    nodes.btnAuthLink.onclick = () => window.open(AUTH_URL, '_blank');

    let authRedeeming = false;
    const redeemAuthCode = async (code, { auto = false } = {}) => {
        GM_setValue('auth_code', code);
        GM_setValue('refresh_token', ''); // 清空旧 token，强制走 code 授权
        state.tokenPromise = null;
        log(auto ? '📥 已自动填入授权码，正在兑换...' : '✅ 授权码已保存，正在尝试获取 Token...');
        const token = await getAccessToken({ forceRefresh: true });
        if (token) {
            GM_setValue('auth_code', '');
            GM_setValue('auth_code_time', '');
            GM_setValue('auth_pending', '');
            log('🎉 授权成功！');
            if (nodes.boxAuth) nodes.boxAuth.style.display = 'none';
            if (nodes.inAuth) nodes.inAuth.value = '';
            if (typeof updateData === 'function') {
                await updateData();
            }
            return true;
        }
        log('❌ 授权码兑换失败，请重新获取');
        if (nodes.boxAuth) nodes.boxAuth.style.display = 'block';
        return false;
    };

    nodes.btnAuthSave.onclick = async () => {
        const val = nodes.inAuth.value.trim();
        if (!val) {
            log('❌ 请先粘贴授权网址或授权码');
            return;
        }
        let code = '';
        try {
            const urlObj = new URL(val);
            code = urlObj.searchParams.get('code') || urlObj.searchParams.get('Code') || '';
        } catch (e) { }
        if (!code) {
            const m = val.match(/[?&#]code=([^&#\s"']+)/i);
            if (m) {
                try { code = decodeURIComponent(m[1]); } catch (e) { code = m[1]; }
            }
        }
        if (!code && /^[A-Za-z0-9._\-]{20,}$/.test(val)) code = val;

        if (!code) {
            log('❌ 格式错误：未在URL中找到 code 参数，请复制完整的白屏网址');
            return;
        }
        nodes.boxAuth.style.display = 'none';
        nodes.inAuth.value = '';
        const ok = await redeemAuthCode(code);
        if (!ok) {
            nodes.inAuth.value = val;
            nodes.inAuth.focus();
        }
    };

    // ===== 授权码自动填充 =====
    let authAutoTried = false;
    async function tryAutoFillAuthCode() {
        if (authRedeeming || authAutoTried) return false;
        let code = '', ts = 0;
        try {
            code = GM_getValue('auth_code', '') || '';
            ts = Number(GM_getValue('auth_code_time', 0)) || 0;
        } catch (e) { }
        if (!code) return false;

        if (ts && Date.now() - ts > 10 * 60 * 1000) {
            log('⏰ 捕获的授权码已过期，请重新点击「获取授权码」');
            try {
                GM_setValue('auth_code', '');
                GM_setValue('auth_code_time', '');
            } catch (e) { }
            return false;
        }

        authAutoTried = true;
        authRedeeming = true;
        try {
            if (nodes.inAuth) nodes.inAuth.value = code;
            if (nodes.boxAuth) nodes.boxAuth.style.display = 'block';
            log(`📥 已自动捕获授权码（${code.slice(0, 12)}…），正在兑换...`);
            const ok = await redeemAuthCode(code, { auto: true });
            if (!ok && nodes.inAuth) nodes.inAuth.value = code;
            return ok;
        } finally {
            authRedeeming = false;
        }
    }

    setTimeout(() => { tryAutoFillAuthCode(); }, 1000);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            tryAutoFillAuthCode();
            if (state.needLogin) try { recoverFromLogin(); } catch { }
        }
    });
    window.addEventListener('focus', () => {
        tryAutoFillAuthCode();
        if (state.needLogin) try { recoverFromLogin(); } catch { }
    });
    updateAllButton();

    async function checkAuth() {
        try {
            let cookie = '';
            if (typeof getCookies === 'function') {
                cookie = await getCookies('https://login.live.com');
            }

            const authUrl = AUTH_URL; // 与「获取授权码」按钮共用同一份地址，避免两处改一处漏

            const res = await new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: authUrl,
                    timeout: 15000,
                    headers: {
                        'Cookie': cookie,
                        'User-Agent': CONFIG.ua.pc
                    },
                    onload: r => resolve(r),
                    onerror: e => reject(e),
                    ontimeout: () => reject(new Error('Timeout'))
                });
            });

            const finalUrl = res.finalUrl || '';
            let codeMatch = finalUrl.match(/[?&]code=([^&]+)/);
            if (codeMatch) return decodeURIComponent(codeMatch[1]);

            const body = res.responseText || '';
            codeMatch = body.match(/[?&]code=([^&"'\s]+)/);
            if (codeMatch) return decodeURIComponent(codeMatch[1]);

            return null;
        } catch (e) {
            console.error('[Rewards] checkAuth 异常:', e);
            return null;
        }
    }

    // ========== 核心逻辑 ==========

    async function updateData() {
        if (state.updatingPromise) return state.updatingPromise;
        state.updatingPromise = (async () => {
        try {
            let dashData = null;
            let meData = null;
            try {
                const token = await getAccessToken();
                if (token) {
                    const parsed = await getDapiMe(token, currentRegion());
                    meData = parsed;
                    dashData = parsed.response?.dashboard || parsed.response || parsed;
                }
            } catch (e) {
                console.error('[Rewards] DAPI 请求错误:', {
                    status: e?.status,
                    message: e?.message,
                    responseText: e?.responseText,
                    finalUrl: e?.finalUrl
                });
            }

            if (!dashData || (!dashData.userProfile && !dashData.userStatus && dashData.balance == null)) {
                warnDataFail();
                return;
            }

            dashboard = dashData;

            const profile = dashData.userProfile || dashData.profile || {};
            const balance = dashData.balance;
            const userStatus = dashData.userStatus || dashData.status || {};

            state.country = String(userStatus.country || profile.country || dashData.country || state.country || 'cn').toLowerCase();

            if (typeof balance === 'number') {
                state.points = balance;
            } else if (balance && typeof balance === 'object') {
                state.points = balance.availablePoints ?? balance.points ?? 0;
            } else {
                state.points = profile.availablePoints ?? profile.points ?? dashData.availablePoints ?? 0;
            }

            const rawLevelCandidate = 
                profile?.attributes?.level ||
                userStatus?.levelInfo?.activeLevel ||
                userStatus?.level ||
                (typeof balance === 'object' && balance?.levelInfo?.activeLevel) ||
                (typeof balance === 'object' && balance?.level) ||
                profile?.levelInfo?.activeLevel ||
                profile?.level ||
                dashData?.levelInfo?.activeLevel ||
                dashData?.level ||
                '';

            const rawLevelStr = String(rawLevelCandidate);

            if (/Gold|金牌|Level3|newLevel3/i.test(rawLevelStr) || rawLevelStr === '3') {
                state.levelName = '🏅 金牌';
                state.level = 3;
            } else if (/Silver|银牌|Level2|newLevel2/i.test(rawLevelStr) || rawLevelStr === '2') {
                state.levelName = '🥈 银牌';
                state.level = 2;
            } else if (/Member|Bronze|会员|铜牌|Level1|newLevel1/i.test(rawLevelStr) || rawLevelStr === '1') {
                state.levelName = '🥉 会员';
                state.level = 1;
            } else {
                state.level = parseInt(rawLevelStr.replace(/\D/g, '')) || 1;
                state.levelName = rawLevelStr ? rawLevelStr : `Lv.${state.level}`;
            }
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

            const lastSignDate = GM_getValue("Config.lastSignDate", "");
            const isLocalSigned = lastSignDate === today;

            let isRemoteSigned = false;

            const looseTrueVal = (v) => {
                if (typeof v === 'boolean') return v === true;
                if (typeof v === 'number') return v !== 0;
                if (typeof v === 'string') {
                    const s = v.trim().toLowerCase();
                    return s === 'true' || s === '1' || s === 'yes' || s === 'claimed';
                }
                return false;
            };

            const checkInPromos = allP.filter(p => {
                if (!p || typeof p !== 'object') return false;
                const str = JSON.stringify(p).toLowerCase();
                if (str.includes('fosbury')) return false;         
                return (
                    str.includes('checkin') ||
                    str.includes('check-in') ||
                    str.includes('signin') ||
                    str.includes('sign-in') ||
                    str.includes('dailycheckin') ||
                    str.includes('daily signup') ||
                    str.includes('signup') ||
                    str.includes('签到') ||
                    str.includes('打卡')
                );
            });

            for (const checkInPromo of checkInPromos) {
                if (isRemoteSigned) break;

                const attrs = checkInPromo?.attributes || {};

                const cur = Number(
                    checkInPromo.pointProgress ??
                    checkInPromo.progress ??
                    attrs.progress ??
                    checkInPromo.current ??
                    0
                );

                const max = Number(
                    checkInPromo.pointProgressMax ??
                    checkInPromo.pointMax ??
                    checkInPromo.max ??
                    attrs.max ??
                    attrs.maxPoints ??
                    0
                );

                const complete =
                    looseTrueVal(checkInPromo.complete) ||
                    looseTrueVal(checkInPromo.completed) ||
                    looseTrueVal(checkInPromo.isCompleted) ||
                    looseTrueVal(attrs.complete) ||
                    looseTrueVal(attrs.completed) ||
                    checkInPromo.state === 'CLAIMED' ||
                    attrs.state === 'CLAIMED' ||
                    checkInPromo.status === 'CLAIMED' ||
                    attrs.status === 'CLAIMED';

                if (complete || (max > 0 && cur >= max)) {
                    isRemoteSigned = true;
                }
            }

            if (!isRemoteSigned) {
                try {
                    const claimed =
                        looseTrueVal(dashData?.claimedToday) ||
                        looseTrueVal(dashData?.userStatus?.claimedToday) ||
                        looseTrueVal(dashData?.status?.claimedToday) ||
                        looseTrueVal(dashData?.userStatus?.claimed) ||
                        looseTrueVal(dashData?.claimed);
                
                    if (claimed) {
                        isRemoteSigned = true;
                    }
                } catch (e) {}
            }

            state.checkedIn = isRemoteSigned || isLocalSigned;

            if (!state.checkedIn) {
                try {
                    const dapiToken = await getAccessToken();
                    if (dapiToken) {
                        const dapiPromos = await getDapiPromotions(dapiToken, currentRegion());
                        if (Array.isArray(dapiPromos)) {
                            const oidOf = p => ((p?.attributes?.offerid || p?.offerId || p?.id || '') + '').toLowerCase();
                            const signCard = dapiPromos.find(p => oidOf(p) === 'gamification_sapphire_dailycheckin')
                                || dapiPromos.find(p => oidOf(p).includes('sapphire') && (oidOf(p).includes('checkin') || oidOf(p).includes('signin')));
                            if (signCard) {
                                const lu = signCard.attributes?.last_updated || signCard.last_updated || '';
                                if (lu) {
                                    const t = new Date(lu);
                                    const luDate = isNaN(t.getTime())
                                        ? String(lu).slice(0, 10)
                                        : `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
                                    if (luDate === getDateHyphen()) {
                                        isRemoteSigned = true;
                                        state.checkedIn = true;
                                    }
                                }
                            }
                        }
                    }
                } catch (e) {
                }
            }

            const readDapi = (meData?.response?.promotions || []).find(x => x?.attributes?.offerid === READ_OFFER_ID);
            const readPromo = allP.find(p => {
                if (!p || typeof p !== 'object') return false;
                const offerId = p.attributes?.offerid || p.offerid || '';
                return offerId === READ_OFFER_ID || offerId.toLowerCase().includes('readarticle');
            });

            if (readDapi && readDapi.attributes) {
                state.readCur = parseInt(readDapi.attributes.progress) || 0;
                state.readMax = parseInt(readDapi.attributes.max) || 30;
            } else if (readPromo && readPromo.attributes) {
                state.readCur = parseInt(readPromo.attributes.progress) || 0;
                state.readMax = parseInt(readPromo.attributes.max) || 30;
            } else {
                if (state.readCur === undefined) state.readCur = 0;
                if (state.readMax === undefined) state.readMax = 30;
            }

            markSyncOk();
            render();

            checkClaimablePoints();
        } catch (e) {
            console.error('updateData error:', e);
            log(`⚠️ 获取数据出错: ${e.message}`);
            markSyncStale('获取数据出错');
        } finally {
            state.updatingPromise = null;
        }
    })();
    return state.updatingPromise;
}
    const openUrl = (url) => {
        try { window.open(url, '_blank'); } catch (e) { location.href = url; }
    };

    const CLAIM_URL = 'https://rewards.bing.com/dashboard?modal=pointsclaim';
    if (nodes.claimGo) {
        nodes.claimGo.onclick = (e) => {
            if (e) e.stopPropagation();
            openUrl(CLAIM_URL);
        };
    }

    if (nodes.loginTip) {
        nodes.loginTip.onclick = (e) => {
            e.stopPropagation();
            openUrl('https://rewards.bing.com/');
        };
    }
    const escapeHtmlText = (s) => String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

    function syncQuestDetail() {
        const list = state.quests || [];
        const idx = state.questDetailIdx;
        const box = nodes.questDetail;
        if (box) {
            if (idx >= 0 && idx < list.length && list[idx]) {
                const r = list[idx];
                const t = r.type || questTypeOf(r.title, r.id).label;
                const label = escapeHtmlText(r.title || r.id || '');
                setHTML(box, `[${t}] ${label} (${r.done || 0}/${r.total || 0})`
                    + `<span class="mr-quest-link" id="mr-quest-go">前往完成 →</span>`);
                box.style.display = 'block';
                const link = box.querySelector('#mr-quest-go');
                if (link) {
                    link.onclick = (ev) => {
                        ev.stopPropagation();
                        const id = r.id;
                        openUrl(id ? REWARDS.quest + encodeURIComponent(id) : REWARDS.earn);
                    };
                }
            } else {
                box.textContent = '';
                box.style.display = 'none';
            }
        }
        if (nodes.punchBar) {
            [...nodes.punchBar.children].forEach((c, i) => c.classList.toggle('active', i === idx));
        }
        if (nodes.punchGo) {
            nodes.punchGo.title = '打开 Rewards 活动页（rewards.bing.com/earn）';
            nodes.punchGo.style.display = (state.quests || []).length ? '' : 'none';
        }
    }

    if (nodes.punchGo) {
        nodes.punchGo.onclick = (e) => {
            e.stopPropagation();
            openUrl(REWARDS.earn);
        };
    }

    function render() {
        if (!nodes.level) return;

        if (nodes.loginTip) {
            const show = !!state.needLogin;
            nodes.loginTip.style.display = show ? '' : 'none';
            if (show && nodes.loginMsg) {
                nodes.loginMsg.textContent = state.loginReason === 'blocked'
                    ? '⚠️ 读取 Rewards 数据失败，可能未登录或登录已失效'
                    : state.loginReason === 'session'
                        ? '🔐 读不到 Rewards 账号数据（点这里打开 rewards 登录一次）'
                        : '🔐 未登录 Microsoft Rewards，活动 / 打卡 / 可领取积分取不到数据';
            }
        }

        nodes.level.textContent = state.levelName || `Lv.${state.level}`;
        nodes.points.textContent = (state.points || 0).toLocaleString();
        if (nodes.sync) {
            const lastOk = state.syncAt || state.syncStartedAt || 0;
            const overdue = lastOk > 0 && Date.now() - lastOk > SYNC_STALE_MS;
            const bad = !!state.syncStale || overdue || state.needLogin;
            const neverOk = !state.syncAt;   // 脚本刚起来还没成功过

            let text, fg, bg, why;
            if (state.syncBusy || (neverOk && !bad)) {
                text = '⟳ 同步中';
                fg = '#605e5c'; bg = '#f3f2f1';
                why = '正在同步…';
            } else if (bad) {
                text = '⚠ 未同步';
                fg = '#a4262c'; bg = '#fde7e9';
                why = state.needLogin
                    ? '未登录 Microsoft Rewards，或登录已失效'
                    : (state.syncStale
                        ? (state.syncReason || '数据未同步')
                        : `已经 ${Math.floor((Date.now() - lastOk) / 60000)} 分钟没有成功同步`);
            } else {
                text = '✓ 已同步';
                fg = '#0b6a34'; bg = '#dff6dd';
                why = '数据已同步';
            }

            nodes.sync.textContent = text;
            nodes.sync.style.color = fg;
            nodes.sync.style.background = bg;
            const at = state.syncAt
                ? new Date(state.syncAt).toLocaleTimeString().slice(0, 5)
                : '';
            const tail = at ? `上次成功同步 ${at}。` : '';
            const hint = '点击强制同步全部：积分 / 搜索 / 阅读 / 日常活动 / 其他任务 / 可领取积分';
            nodes.sync.title = bad || state.syncBusy || neverOk
                ? `${why}。${tail}${hint}`
                : `${why}（${at}）。${hint}`;
        }
        const pcCur = state.searchCur ?? state.pcCur ?? 0;
        const pcMax = state.searchMax ?? state.pcMax ?? 60;
        if (nodes.pc) nodes.pc.textContent = `${pcCur}/${pcMax}`;
        if (nodes.pcBar) nodes.pcBar.style.width = pcMax ? `${(pcCur / pcMax) * 100}%` : '0%';

        if (nodes.signStatus) {
            nodes.signStatus.textContent = state.checkedIn ? '已签到' : '未签到';
            nodes.signStatus.style.color = state.checkedIn ? '#107c41' : '#d83b01';
        }

        const readCur = state.readCur ?? 0;
        const readMax = state.readMax ?? 30;
        if (nodes.read) nodes.read.textContent = `${readCur}/${readMax}`;
        if (nodes.readBar) nodes.readBar.style.width = readMax ? `${(readCur / readMax) * 100}%` : '0%';

        if (nodes.punch) {
            const list = state.quests || [];
            const isDone = (r) => r.complete || (r.total > 0 && (r.done || 0) >= r.total);
            if (!list.length) {
                nodes.punch.textContent = '-';
                nodes.punch.title = '';
            } else {
                const todo = list.filter(r => !isDone(r) && r.canDo === true).length; // 今天待办
                const settled = list.length - todo;                                  // 已完成 + 今天做不了
                nodes.punch.textContent = `${settled}/${list.length}`;
                nodes.punch.title = `今天待办 ${todo} 个（红色）· 不用管 ${settled} 个（已完成 + 今天做不了）· 共 ${list.length} 个`;
            }
        }
        if (nodes.punchBar) {
            const list = state.quests || [];
            const sig = JSON.stringify(list.map(r => [r.id, r.title, r.type, r.done, r.total, r.complete, r.canDo]));
            if (nodes.punchBar._mrSig !== sig) {
                nodes.punchBar._mrSig = sig;
                nodes.punchBar.textContent = '';
                const shortOf = (t) => (t === '每周' ? '周' : t === '月度' ? '月' : '限');
                list.forEach((r, i) => {
                    const done = r.done || 0;
                    const total = r.total || 0;
                    const complete = r.complete || (total > 0 && done >= total);
                    const t = r.type || questTypeOf(r.title, r.id).label;
                    const label = r.title || r.id || '';

                    const col = document.createElement('div');
                    col.className = 'mr-quest-col';
                    col.onclick = () => {
                        state.questDetailIdx = state.questDetailIdx === i ? -1 : i;
                        syncQuestDetail();
                    };

                    const lab = document.createElement('div');
                    lab.className = 'mr-quest-label' + (complete ? ' done' : r.canDo === true ? ' can' : '');
                    lab.textContent = `${shortOf(t)} ${done}/${total}`;
                    lab.title = `[${t}] ${label} (${done}/${total})${r.canDo === true ? ' - 今天可完成' : ''}`;

                    const track = document.createElement('div');
                    track.className = 'mr-quest-track';
                    const fill = document.createElement('div');
                    fill.className = 'mr-quest-fill' + (complete ? ' done' : '');
                    fill.style.width = total ? `${Math.min(100, (done / total) * 100)}%` : '0%';
                    track.appendChild(fill);

                    col.appendChild(lab);
                    col.appendChild(track);
                    nodes.punchBar.appendChild(col);
                });
            }
            syncQuestDetail();
        }

        if (nodes.promo) {
            nodes.promo.textContent = (state.needLogin && !state.promosTotal)
                ? '-'
                : `${state.promosDone || 0}/${state.promosTotal || 0}`;
        }
        if (nodes.promoBar) {
            const done = state.promosDone || 0;
            const total = state.promosTotal || 0;
            nodes.promoBar.style.width = total ? `${Math.min(100, (done / total) * 100)}%` : '0%';
        }

        if (nodes.claim) {
            const amt = state.claimablePoints || 0;
            nodes.claim.style.display = amt > 0 ? 'flex' : 'none';
            if (nodes.claimAmt) nodes.claimAmt.textContent = amt.toLocaleString();
        }

    }

    let tokenWarnAt = 0;
    const logToken = (msg) => {
        const now = Date.now();
        if (now - tokenWarnAt < 10 * 60 * 1000) return;
        tokenWarnAt = now;
        log(msg);
    };
    async function getAccessToken(opts = {}) {
        const forceRefresh = !!opts.forceRefresh;
        const now = Date.now();

        if (!forceRefresh && state.accessToken && state.accessTokenExpiresAt && now < (state.accessTokenExpiresAt - 60000)) {
            return state.accessToken;
        }
        if (!forceRefresh && state.tokenFailAt && now - state.tokenFailAt < 5 * 60 * 1000) {
            return null;
        }

        if (state.tokenPromise) {
            return state.tokenPromise;
        }

        const pending = (async () => {
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
                    logToken('🔑 正在获取微软活动 Token...');
                    
                    let code = await checkAuth();
                    
                    if (!code) {
                        const savedCode = GM_getValue('auth_code', '');
                        if (savedCode) {
                            code = savedCode;
                            GM_setValue('auth_code', ''); // 授权码是一次性的，取出后立即清空
                            try {
                                if (nodes.inAuth && !nodes.inAuth.value) nodes.inAuth.value = savedCode;
                                if (nodes.boxAuth) nodes.boxAuth.style.display = 'block';
                            } catch (e) { }
                            log('📥 已自动填入捕获的授权码，正在兑换...');
                        }
                    }

                    if (!code) {
                        logToken('⚠️ 静默授权失败，请点击面板中的「获取授权码」手动授权');
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
                    state.tokenFailAt = 0;
                    state.accessToken = data.access_token;
                    state.accessTokenExpiresAt =
                        Date.now() + (Number(data.expires_in) || 3600) * 1000;

                    if (data.refresh_token) {
                        GM_setValue('refresh_token', data.refresh_token);
                    }

                    if (!refreshToken) {
                        try {
                            GM_setValue('auth_code', '');
                            GM_setValue('auth_code_time', '');
                            GM_setValue('auth_pending', '');
                        } catch (e) { }
                        try {
                            if (nodes.inAuth) nodes.inAuth.value = '';
                            if (nodes.boxAuth) nodes.boxAuth.style.display = 'none';
                        } catch (e) { }
                    }
                    return data.access_token;
                } else {
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
            }
            state.tokenFailAt = Date.now();
            return null;
        })();

        state.tokenPromise = pending;
        pending.finally(() => {
            if (state.tokenPromise === pending) state.tokenPromise = null;
        }).catch(() => { });
        return pending;
    }

    const REWARDS = {
        dash: 'https://rewards.bing.com/dashboard',
        earn: 'https://rewards.bing.com/earn',
        quest: 'https://rewards.bing.com/earn/quest/',
        actionFallback: '70babbc81d2724f60d29a95c03b3d739cba77cea92',
        claimFallback: '00491296f1d668ad46b65342c95cb9d72a62c1fa9d',
        cacheKey: 'mr_action_cache',
        questKey: 'mr_quest_state'
    };

    const isSameRewardsHost = () => typeof location !== 'undefined' && location.hostname === 'rewards.bing.com';
    const crossHostHint = () => isSameRewardsHost()
        ? ''
        : '（交卷/领取必须在 rewards.bing.com 页面内发出，当前页面是 ' + (typeof location !== 'undefined' ? location.hostname : '?') + '，请打开 rewards.bing.com 后再点）';

    const getTodayYmd = () => {
        const d = new Date();
        return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    };
    const getTimezoneOffsetStr = () => String(new Date().getTimezoneOffset());

    function getRouterStateTree(segment) {
        const flag = 4096;
        const tree = ['', {
            children: ['(nav)', {
                children: [segment, { children: ['PAGE', {}, null, null, flag] }, null, null, flag]
            }, null, null, flag]
        }, null, null, flag + 16];
        return encodeURIComponent(JSON.stringify(tree));
    }

    async function siteFetch(url, options = {}) {
        const method = (options.method || 'GET').toUpperCase();
        const headers = options.headers || {};
        const body = options.body;
        const sameOrigin = typeof location !== 'undefined' && location.hostname === 'rewards.bing.com';
        if (sameOrigin && typeof fetch === 'function') {
            try {
                const resp = await fetch(url, { method, headers, body, credentials: 'include', redirect: 'follow' });
                const text = await resp.text();
                if (!resp.ok) {
                    const err = new Error(`HTTP ${resp.status}`);
                    err.status = resp.status;
                    err.responseText = text;
                    throw err;
                }
                return text;
            } catch (e) {
                if (e && e.status) throw e;
                return gmRequest({ method, url, headers, data: body, retries: options.retries ?? 1 });
            }
        }
        return gmRequest({ method, url, headers, data: body, retries: options.retries ?? 1 });
    }

    async function getRewardsHtml(url, ua) {
        if (ua) return gmRequest({ method: 'GET', url, headers: { 'user-agent': ua }, retries: 1 });
        return siteFetch(url);
    }

    function looksLikeLoginPage(html) {
        const s = String(html || '');
        if (!s) return true;
        return s.length < 4000 && /^\s*[\[{]/.test(s);
    }

    function detectLoginWall(html) {
        const s = String(html || '');
        if (!s) return false;
        if (/location\.(?:href|replace)\s*=\s*["'][^"']*login\.(?:live|microsoftonline|microsoft)\./i.test(s)) return true;
        if (/id="i0116"|name="loginfmt"|id="loginHeader"/i.test(s)) return true;
        if (s.length < 200000 && /<title>\s*(?:Sign in|登录|登入|サインイン|로그인)/i.test(s)) return true;
        return false;
    }

    const ACCOUNT_ANCHORS = {
        dash: ['"dailySetItems"', '"userStatus"', '"activityCards"', 'punchcard'],
        earn: ['"activityCards"', 'punchcard', '"dailySetItems"', '"userStatus"']
    };
    const lastSeen = { dash: { v: '', at: 0 }, earn: { v: '', at: 0 } };

    function hasAccountData(html, kind) {
        const s = String(html || '').replace(/\\"/g, '"');
        if (!s) return false;
        const anchors = ACCOUNT_ANCHORS[kind];
        if (!anchors) return true; // quest 详情页等不做判定，保持原行为
        return anchors.some(a => s.includes(a));
    }

    function anchorStat(html) {
        const s = String(html || '').replace(/\\"/g, '"');
        const n = (k) => s.split(k).length - 1;
        return `dailySetItems:${n('"dailySetItems"')} activityCards:${n('"activityCards"')} userStatus:${n('"userStatus"')}`;
    }

    // 抓 Rewards 页面 HTML，三层降级：站内 fetch → 带 UA/Cookie 的 GM 请求 → 读当前 DOM
    const pageCache = new Map();
    const PAGE_CACHE_TTL = 45 * 1000;
    const failCache = new Map();
    const FAIL_CACHE_TTL = 60 * 1000;
    const clearPageCache = () => { pageCache.clear(); failCache.clear(); };

    const inflightPages = new Map();
    async function fetchRewardsPage(url, ua, opts = {}) {
        if (opts.force) return fetchRewardsPageInner(url, ua, opts);
        const key = String(url || '').split('?')[0].replace(/\/+$/, '') + '|' + (ua || '');
        if (inflightPages.has(key)) return inflightPages.get(key);
        const p = fetchRewardsPageInner(url, ua, opts);
        inflightPages.set(key, p);
        try { return await p; } finally { inflightPages.delete(key); }
    }

    async function fetchRewardsPageInner(url, ua, opts = {}) {
        const target = String(url || '').split('?')[0].replace(/\/+$/, '');
        const isMain = target === REWARDS.dash || target === REWARDS.earn;
        const kind = target === REWARDS.dash ? 'dash' : (target === REWARDS.earn ? 'earn' : '');
        let loginWall = false;
        let noData = false;
        const cacheKey = target + '|' + (ua || '');
        if (!opts.force) {
            const hit = pageCache.get(cacheKey);
            if (hit && hit.html && Date.now() - hit.at < PAGE_CACHE_TTL) {
                return { html: hit.html, from: hit.from + '+cache' };
            }
            const neg = failCache.get(cacheKey);
            if (neg && Date.now() - neg.at < FAIL_CACHE_TTL) {
                if (isMain && neg.reason !== 'struct') markNeedLogin(target, neg.reason);
                return { html: '', from: 'none+cache', login: isMain && neg.reason !== 'struct' };
            }
        }
        const ok = (html, from) => {
            if (isMain) { lastSeen[kind] = { v: 'ok', at: Date.now() }; clearNeedLogin(kind); }
            failCache.delete(cacheKey);
            if (html) pageCache.set(cacheKey, { at: Date.now(), html, from });
            return { html, from };
        };
        const judge = (html) => {
            if (!html) return 'empty';
            if (detectLoginWall(html) || looksLikeLoginPage(html)) return 'login';
            if (!hasAccountData(html, kind)) return 'nodata';
            return 'ok';
        };
        const handle = (html, from) => {
            const v = judge(html);
            if (v === 'ok') return ok(html, from);
            if (v === 'login') loginWall = true;
            else if (v === 'nodata') noData = true;
            return null;
        };

        try {
            const r = handle(await getRewardsHtml(url, ua), 'fetch');
            if (r) return r;
        } catch (e) { /* 继续降级 */ }

        try {
            const cookie = await getCookies('https://rewards.bing.com').catch(() => '');
            const headers = {
                'user-agent': ua || CONFIG.ua.pc,
                referer: 'https://rewards.bing.com/'
            };
            if (cookie) headers.cookie = cookie;
            const html = await gmRequest({ method: 'GET', url, headers, retries: 1 }).catch(() => '');
            const r = handle(html, 'gm');
            if (r) return r;
        } catch (e) { /* 继续降级 */ }

        try {
            const cur = (location.origin + location.pathname).replace(/\/+$/, '');
            if (cur === target) {
                const r = handle(document.documentElement?.outerHTML || '', 'dom');
                if (r) return r;
            }
        } catch (e) { /* ignore */ }

        if (isMain && (loginWall || noData)) {
            const other = kind === 'dash' ? 'earn' : 'dash';
            const o = lastSeen[other];
            const otherOk = o && o.v === 'ok' && Date.now() - o.at < 120 * 1000;
            const structural = !loginWall && otherOk;
            lastSeen[kind] = { v: structural ? 'struct' : 'fail', at: Date.now() };
            if (structural) {
                warnStructure(kind);
                failCache.set(cacheKey, { at: Date.now(), reason: 'struct' });
            } else {
                markNeedLogin(target, loginWall ? '' : 'session');
                failCache.set(cacheKey, { at: Date.now(), reason: loginWall ? '' : 'session' });
            }
        }
        return { html: '', from: 'none', login: loginWall || noData };
    }

    let loginWarnAt = 0;
    const LOGIN_RANK = { blocked: 0, dash: 1, earn: 1, session: 2 };
    function markNeedLogin(target, reason) {
        const r = reason || (target === REWARDS.earn ? 'earn' : 'dash');
        if (state.needLogin) {
            if ((LOGIN_RANK[r] ?? 1) <= (LOGIN_RANK[state.loginReason] ?? 1)) return; // 不重复刷、不降级
            state.loginReason = r;
            render(); // 只换文案，不再刷日志
            return;
        }
        state.needLogin = true;
        state.loginReason = r;
        render();
        const now = Date.now();
        if (now - loginWarnAt < 10 * 60 * 1000) return;
        loginWarnAt = now;
        if (state.loginReason === 'session') {
            log('🔐 已登录 Bing，但读不到 rewards.bing.com 的账号数据（会话未建立，或站点改版）：活动 / 打卡 / 可领取积分取不到数据');
            log('💡 点面板上的「去登录 →」打开一次 https://rewards.bing.com 完成登录；回到本页后会自动重新拉取');
            return;
        }
        log('🔐 未登录 Microsoft Rewards（或登录已失效），活动 / 打卡 / 可领取积分取不到数据');
        log('💡 点面板上的「去登录 →」，或手动打开 https://rewards.bing.com 登录；回到本页后脚本会自动重新拉取');
    }
    function clearNeedLogin(kind) {
        if (!state.needLogin) return;
        const other = kind === 'dash' ? 'earn' : (kind === 'earn' ? 'dash' : '');
        if (other) {
            const o = lastSeen[other];
            if (o && o.v === 'fail' && Date.now() - o.at < 120 * 1000) return;
        }
        state.needLogin = false;
        state.loginReason = '';
        pageFailStreak = 0;
        render();
        log('✅ 登录状态已恢复，数据重新同步中');
    }

    // ===== 积分同步状态徽章 =====
    function markSyncOk() {
        state.syncStale = false;
        state.syncReason = '';
        state.syncAt = Date.now();
    }
    function markSyncStale(reason) {
        const changed = !state.syncStale || state.syncReason !== reason;
        state.syncStale = true;
        state.syncReason = reason || '数据未同步';
        if (changed) render();
    }

    let pageFailStreak = 0;
    function markDataBlocked() {
        if (state.needLogin) return;
        state.needLogin = true;
        state.loginReason = 'blocked';
        render();
        log('⚠️ 连续两次读取 Rewards 页面失败（未登录 / 登录失效 / 风控 / 网络）');
        log('💡 点面板上的「去登录 →」确认一下，登录成功并回到本页后会自动恢复');
    }

    const fetchWarnAt = {};
    function warnFetchFail(label, url) {
        if (state.needLogin) return;
        const key = label || url;
        const now = Date.now();
        if (fetchWarnAt[key] && now - fetchWarnAt[key] < 10 * 60 * 1000) return;
        fetchWarnAt[key] = now;
        log(`⚠️ ${label}数据获取失败（可能是登录态/风控/网络问题），已保留上次结果，稍后会自动重试`);
        log('💡 若一直为空：先在浏览器打开 https://rewards.bing.com 确认已登录，再点「🔍 导出 Rewards 诊断日志」反馈');
        console.warn('[Rewards] fetch fail:', label, url);
    }

    let dataFailWarnAt = 0;
    function warnDataFail() {
        markSyncStale('读不到 Rewards 数据');
        const now = Date.now();
        if (now - dataFailWarnAt < 10 * 60 * 1000) return;
        dataFailWarnAt = now;
        log('❌ 获取数据失败，请确认已登录 rewards.bing.com');
        log('💡 若一直失败：先打开 https://rewards.bing.com 登录，再回到本页（脚本会自动重拉）');
    }

    const parseWarnAt = {};
    function warnParseEmpty(label, detail) {
        const now = Date.now();
        if (parseWarnAt[label] && now - parseWarnAt[label] < 30 * 60 * 1000) return;
        parseWarnAt[label] = now;
        log(`🟡 ${label}：页面已取到但没解析出条目（可能是站点结构变化或今天确实没有任务）${detail ? `｜锚点 ${detail}` : ''}`);
    }

    let structWarnAt = 0;
    function warnStructure(kind) {
        const now = Date.now();
        if (now - structWarnAt < 30 * 60 * 1000) return;
        structWarnAt = now;
        log(`🟡 ${kind === 'dash' ? 'dashboard' : 'earn'} 页面里没有账号数据，但另一面正常：登录没问题，疑似站点结构变化`);
        log('💡 若活动/打卡数字明显偏少，点「🔍 导出 Rewards 诊断日志」反馈');
    }

    async function postServerAction({ url, actionId, dpl, referer, body, ua }) {
        const segment = url.includes('/quest/') || url.includes('/earn') ? 'earn' : 'dashboard';
        const headers = {
            'content-type': 'text/plain;charset=UTF-8',
            'next-action': actionId,
            'next-router-state-tree': getRouterStateTree(segment)
        };
        if (referer) headers.referer = referer;
        if (dpl) headers['x-deployment-id'] = dpl;
        const sameOrigin = typeof location !== 'undefined' && location.hostname === 'rewards.bing.com';
        if (!sameOrigin) {
            headers.origin = 'https://rewards.bing.com';
            headers.referer = referer || 'https://rewards.bing.com/';
            headers.accept = 'text/x-component';
            headers['sec-fetch-dest'] = 'empty';
            headers['sec-fetch-mode'] = 'cors';
            headers['sec-fetch-site'] = 'same-origin';
            headers['user-agent'] = ua || CONFIG.ua.pc;
        }
        return siteFetch(url, { method: 'POST', headers, body, retries: 0 });
    }

    function loadActionCache() {
        try {
            const raw = GM_getValue(REWARDS.cacheKey, '');
            const data = raw ? JSON.parse(raw) : null;
            return data && data.ids && data.ids.reportActivity ? data : null;
        } catch { return null; }
    }
    function saveActionCache(data) {
        try { GM_setValue(REWARDS.cacheKey, JSON.stringify(data)); } catch { }
    }
    function clearActionCache() {
        try { GM_setValue(REWARDS.cacheKey, ''); } catch { }
    }

    async function getRewardsAction(pages) {
        const required = ['reportActivity', 'reportClaimAllPoints'];
        let htmls = (pages || []).filter(Boolean);
        if (!htmls.length) {
            const [d, e] = await Promise.all([
                getRewardsHtml(REWARDS.dash).catch(() => ''),
                getRewardsHtml(REWARDS.earn).catch(() => '')
            ]);
            htmls = [d, e].filter(Boolean);
        }
        const combined = htmls.join('\n');
        const dpl = (combined.match(/[?&](?:amp;)?dpl=([A-Za-z0-9._-]+)/i) || [])[1] || '';
        const build = dpl || (combined.match(/\/_next\/static\/([A-Za-z0-9._-]+)\//) || [])[1] || '';
        const cached = loadActionCache();
        if (cached && (!build || build === cached.build)) {
            return { ids: cached.ids, dpl: cached.dpl || dpl };
        }

        const chunks = new Set();
        const chunkRe = /(?:\/_next\/)?(static\/(?:chunks|immutable|media)\/[\w\-./()]+?\.js)/g;
        let m;
        while ((m = chunkRe.exec(combined)) !== null) chunks.add('/_next/' + m[1]);
        const addDynamic = (text, set) => {
            const re = /\b(\d{2,6}):"([a-z0-9_-]{8,})"/g;
            let d;
            while ((d = re.exec(text)) !== null) {
                set.add(`/_next/static/chunks/${d[1]}-${d[2]}.js`);
                set.add(`/_next/static/chunks/${d[1]}.${d[2]}.js`);
            }
        };
        addDynamic(combined, chunks);
        const score = p => /(dashboard|earn|page|layout|nav)/i.test(p) ? 0 : 1;
        const queue = [...chunks].sort((a, b) => score(a) - score(b)).slice(0, 40);
        queue.push('/_next/static/chunks/4069k0g6u-2ge.js');

        const hex = '[a-f0-9]{40,64}';
        const nonNames = ['callServer', 'findSourceMapURL', 'encodeFormAction', 'default'];
        const ids = {};
        const scan = (js) => {
            const regexes = [
                new RegExp(`createServerReference\\s*\\)?\\s*\\(\\s*"(${hex})"([\\s\\S]{0,800}?)\\)`, 'g'),
                new RegExp(`registerServerReference\\s*\\)?\\s*\\([^,]+,\\s*"(${hex})"([\\s\\S]{0,800}?)\\)`, 'g')
            ];
            for (const re of regexes) {
                re.lastIndex = 0;
                let r;
                while ((r = re.exec(js)) !== null) {
                    const names = [...(r[2] || '').matchAll(/"([A-Za-z_$][\w$]*)"/g)]
                        .map(x => x[1])
                        .filter(n => !nonNames.includes(n) && n.length > 3);
                    const name = names[names.length - 1];
                    if (name && !ids[name]) ids[name] = r[1];
                }
            }
        };
        const visited = new Set();
        let fetched = 0;
        while (queue.length && fetched < 70) {
            const path = queue.shift();
            if (!path || visited.has(path)) continue;
            visited.add(path);
            fetched++;
            try {
                const js = await getRewardsHtml('https://rewards.bing.com' + path);
                if (!js || !js.includes('ServerReference')) continue;
                scan(js);
                if (!required.every(k => ids[k])) {
                    const more = new Set();
                    addDynamic(js, more);
                    for (const p of more) if (!visited.has(p) && !queue.includes(p)) queue.push(p);
                }
                if (required.every(k => ids[k])) break;
            } catch { /* 分包缺失（404）属正常情况 */ }
        }
        if (ids.reportActivity) {
            saveActionCache({ build, dpl, ids, at: Date.now() });
            log(`🧩 站点服务端标识已更新（build: ${build || '未知'}，识别 ${Object.keys(ids).length} 个动作）`);
            return { ids, dpl };
        }
        log('🟡 未能从站点分包中提取服务端标识，改用缓存 / 历史标识');
        if (cached) return { ids: cached.ids, dpl: cached.dpl || dpl };
        return { ids: {}, dpl };
    }

    function extractArrayAfterKey(html, key) {
        const marker = '"' + key + '":';
        const idx = html.indexOf(marker);
        if (idx === -1) return null;
        const start = html.indexOf('[', idx);
        if (start === -1) return null;
        let depth = 0, inStr = false, esc = false;
        for (let i = start; i < html.length; i++) {
            const c = html[i];
            if (inStr) {
                if (esc) esc = false;
                else if (c === '\\') esc = true;
                else if (c === '"') inStr = false;
            } else if (c === '"') inStr = true;
            else if (c === '[') depth++;
            else if (c === ']') {
                depth--;
                if (depth === 0) return html.slice(start, i + 1);
            }
        }
        return null;
    }

    function normalizeDate(d) {
        if (d == null) return null;
        let m = String(d).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (m) return Number(m[3] + String(m[1]).padStart(2, '0') + String(m[2]).padStart(2, '0'));
        m = String(d).match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
        if (m) return Number(m[1] + String(m[2]).padStart(2, '0') + String(m[3]).padStart(2, '0'));
        const t = Date.parse(d);
        if (!isNaN(t)) {
            const dt = new Date(t);
            return Number(`${dt.getFullYear()}${String(dt.getMonth() + 1).padStart(2, '0')}${String(dt.getDate()).padStart(2, '0')}`);
        }
        return null;
    }

    const isTrueVal = (v) => v === true || String(v).toLowerCase() === 'true';
    const isFalseVal = (v) => v === false || String(v).toLowerCase() === 'false';

    function isLockedCard(card) {
        if (!card) return false;
        if (isFalseVal(card.isLocked) && isTrueVal(card.isUnlocked)) return false;
        if (isTrueVal(card.isLocked) || isFalseVal(card.isUnlocked)) return true;
        const crit = typeof card.unlockCriteria === 'string' ? card.unlockCriteria : '';
        return /app|install|mobile/i.test(crit) ||
            /Moreactivities_RewardsApp/i.test(card.offerId || card.name || '');
    }

    function requiredLevelOf(id) {
        const m = String(id || '').match(/locked_level(\d+)/i);
        return m ? parseInt(m[1], 10) : 0;
    }
    function lacksLevel(id) {
        const need = requiredLevelOf(id);
        return need > 0 && need > (state.level || 1);
    }

    function isSearchLikeCard(card) {
        if (!card) return '';
        const id = String(card.offerId || card.offerid || '');
        const name = String(card.name || '');
        if (/punchcard/i.test(id)) return '';
        const dest = [card.destination, card.destinationUrl, card.url, card.link, card.targetUrl]
            .filter(v => typeof v === 'string').join(' ');
        if (/REWARDSQUIZ_DailySet_UrlOffer/i.test(dest)) return '';
        if (/exploreonbing|searchonbing|bingsearch|explore_bing|searchandearn|searchtask/i.test(`${id} ${name}`)) return 'name';
        const kinds = [card.promotionType, card.promotionSubtype, card.subtype, card.type, card.activityType,
            card.attributes?.type, card.attributes?.promotionType]
            .filter(v => typeof v === 'string');
        if (kinds.some(v => /^(search|searchonbing|exploreonbing|bingsearch|searchandearn|searchtask)$/i.test(v.trim()))) return 'type';
        if (kinds.some(v => /(^|,)\s*urlreward\s*(,|$)/i.test(v.trim()))) return '';
        const title = [card.title, card.name].filter(v => typeof v === 'string').join(' ');
        if (/explore\s+on\s+bing|search\s+(on|with)\s+bing|在\s*(必应|bing)[^\n]{0,8}搜索|用\s*(必应|bing)[^\n]{0,8}搜索/i.test(title)) return 'title';
        return '';
    }

    function isOriginOnlyCard(card) {
        if (!card) return '';
        const id = String(card.offerId || card.offerid || '');
        if (/punchcard/i.test(id)) return '';
        if (/REWARDSQUIZ_DailySet_UrlOffer/i.test(String(card.destination || card.url || ''))) return '';
        if (/locked_level\d+/i.test(id)) return 'id';
        const crit = typeof card.unlockCriteria === 'string' ? card.unlockCriteria.trim() : '';
        if (/^newlevel/i.test(crit)) return 'crit';
        const lockedFeature = card.exclusiveLockedFeatureStatus;
        if (typeof lockedFeature === 'string' && lockedFeature && lockedFeature !== '$undefined' && /unlock/i.test(lockedFeature)) return 'locked';
        const kinds = [card.promotionType, card.promotionSubtype, card.subtype, card.activityType, card.attributes?.type]
            .filter(v => typeof v === 'string');
        if (kinds.some(v => /^contentaccess$/i.test(v.trim()))) return 'type';
        return '';
    }

    function extractCardsByOfferId(html) {
        const clean = String(html || '').replace(/\\"/g, '"');
        const out = [];
        const seen = new Set();
        let idx = 0;
        while ((idx = clean.indexOf('"offerId":"', idx)) !== -1) {
            const idStart = idx + 11;
            const idEnd = clean.indexOf('"', idStart);
            if (idEnd < 0) break;
            const id = clean.slice(idStart, idEnd);
            idx = idEnd;
            if (!id || seen.has(id)) continue;
            let depth = 0, start = -1;
            const backFloor = Math.max(0, idx - 32768);
            for (let i = idx; i >= backFloor; i--) {
                const c = clean[i];
                if (c === '}') depth++;
                else if (c === '{') {
                    if (depth === 0) { start = i; break; }
                    depth--;
                }
            }
            if (start < 0) continue;
            let d = 0, end = -1, inStr = false, esc = false;
            for (let i = start; i < clean.length; i++) {
                const c = clean[i];
                if (inStr) {
                    if (esc) esc = false;
                    else if (c === '\\') esc = true;
                    else if (c === '"') inStr = false;
                } else if (c === '"') inStr = true;
                else if (c === '{') d++;
                else if (c === '}') { d--; if (d === 0) { end = i; break; } }
            }
            if (end < 0) continue;
            try {
                const obj = JSON.parse(clean.slice(start, end + 1));
                if (obj && obj.offerId === id) { seen.add(id); out.push(obj); }
            } catch { }
        }
        return out;
    }

    function parseDashDailySet(html) {
        const clean = String(html || '').replace(/\\"/g, '"');
        let items = [];
        const raw = extractArrayAfterKey(clean, 'dailySetItems');
        if (raw) {
            try { items = JSON.parse(raw.replace(/\\"/g, '"')); } catch { items = []; }
        }
        if (!Array.isArray(items) || !items.length) {
            const legacy = clean.match(/"dailySetItems":(\[.*?\]),"discovery"/);
            if (legacy) {
                try { items = JSON.parse(legacy[1].replace(/\\"/g, '"')); } catch { items = []; }
            }
        }
        return Array.isArray(items) ? items : [];
    }

    function parseEarnCards(html) {
        const clean = String(html || '').replace(/\\"/g, '"');
        const raw = extractArrayAfterKey(clean, 'activityCards');
        if (!raw) return [];
        try {
            const arr = JSON.parse(raw.replace(/\\"/g, '"'));
            return Array.isArray(arr) ? arr : [];
        } catch { return []; }
    }

    function parseBalance(html) {
        const clean = String(html || '').replace(/\\"/g, '"');
        const m = clean.match(/"balance":(\d+)/) || clean.match(/"availablePoints":(\d+)/);
        return m ? parseInt(m[1], 10) : 0;
    }

    function collectPromoTasks(dashHtml, earnHtml) {
        const todayNum = Number(getTodayYmd());
        const tasks = [];
        const seen = new Set();
        const stat = { dashDone: 0, dashTotal: 0, earnDone: 0, earnTotal: 0, locked: 0, lockedPoints: 0, levelLocked: 0, levelLockedPoints: 0, noHash: 0, skippedQuest: 0, searchSkipped: 0, searchSkippedPoints: 0, originOnly: 0, earnParseFailed: false };
        const crossHost = !isSameRewardsHost();
        const dayEn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()];
        const skipCompleted = (id) => {
            if (id.includes('Evergreen') && !id.includes(dayEn)) return true;
            const dateMatch = id.match(/(20\d{6})/);
            if (dateMatch && dateMatch[1] !== String(todayNum)) return true;
            if (/(w[1-5]|week|month)/i.test(id)) return true;
            if (/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\d{2}/i.test(id)) return true;
            return false;
        };

        for (const item of parseDashDailySet(dashHtml)) {
            const points = Number(item.points) || 0;
            const id = item.offerId;
            if (!points || !id || seen.has(id)) continue;
            if (isSearchLikeCard(item)) {
                seen.add(id);
                stat.searchSkipped++;
                stat.searchSkippedPoints += points;
                continue;
            }
            if (lacksLevel(id)) {
                stat.levelLocked++;
                stat.levelLockedPoints += points;
                seen.add(id);
                continue;
            }
            if (isLockedCard(item)) {
                stat.locked++;
                stat.lockedPoints += points;
                seen.add(id);
                continue;
            }
            const itemDate = normalizeDate(item.date);
            if (itemDate !== null && itemDate !== todayNum) continue;
            seen.add(id);
            stat.dashTotal += points;
            if (isTrueVal(item.isCompleted)) {
                stat.dashDone += points;
                continue;
            }
            if (crossHost && isOriginOnlyCard(item)) {
                stat.originOnly++;
                continue;
            }
            tasks.push({ id, title: item.title || item.name || item.description || id, hash: item.hash || '', url: REWARDS.dash, points, type: 'dash' });
        }

        const cards = parseEarnCards(earnHtml);
        if (String(earnHtml || '').replace(/\\"/g, '"').includes('"activityCards":[') && !cards.length) {
            stat.earnParseFailed = true;
        }
        for (const card of cards) {
            const points = Number(card.points) || 0;
            const id = card.offerId || card.name || '';
            if (!points || !id || seen.has(id)) continue;
            if (/punchcard/i.test(id)) {
                seen.add(id);
                stat.skippedQuest++;
                continue;
            }
            if (isSearchLikeCard(card)) {
                seen.add(id);
                stat.searchSkipped++;
                stat.searchSkippedPoints += points;
                continue;
            }
            if (lacksLevel(id)) {
                stat.levelLocked++;
                stat.levelLockedPoints += points;
                seen.add(id);
                continue;
            }
            if (isLockedCard(card)) {
                stat.locked++;
                stat.lockedPoints += points;
                seen.add(id);
                continue;
            }
            if (isTrueVal(card.isCompleted) && skipCompleted(id)) continue;
            seen.add(id);
            stat.earnTotal += points;
            if (isTrueVal(card.isCompleted)) {
                stat.earnDone += points;
                continue;
            }
            if (crossHost && isOriginOnlyCard(card)) {
                stat.originOnly++;
                continue;
            }
            tasks.push({ id, title: card.title || card.name || card.description || id, hash: card.hash || '', url: REWARDS.earn, points, type: 'earn' });
        }

        const addGeneric = (html, type, url) => {
            if (!html) return;
            for (const card of extractCardsByOfferId(html)) {
                const id = card.offerId;
                const points = Number(card.points) || 0;
                if (!points || !id || seen.has(id)) continue;
                if (/^Discovery_/i.test(id)) continue;
                if (/punchcard/i.test(id)) continue;
                if (isSearchLikeCard(card)) {
                    seen.add(id);
                    stat.searchSkipped++;
                    stat.searchSkippedPoints += points;
                    continue;
                }
                if (!card.hash || card.hash === '$undefined') {
                    stat.noHash++;
                    continue;
                }
                if (lacksLevel(id)) {
                    stat.levelLocked++;
                    stat.levelLockedPoints += points;
                    seen.add(id);
                    continue;
                }
                if (isLockedCard(card)) {
                    stat.locked++;
                    stat.lockedPoints += points;
                    seen.add(id);
                    continue;
                }
                const d = normalizeDate(card.date);
                if (d !== null && d !== todayNum) continue;
                if (type === 'earn' && isTrueVal(card.isCompleted) && skipCompleted(id)) continue;
                seen.add(id);
                if (type === 'dash') stat.dashTotal += points;
                else stat.earnTotal += points;
                if (isTrueVal(card.isCompleted)) {
                    if (type === 'dash') stat.dashDone += points;
                    else stat.earnDone += points;
                    continue;
                }
                if (crossHost && isOriginOnlyCard(card)) {
                    stat.originOnly++;
                    continue;
                }
                tasks.push({ id, title: card.title || card.name || card.description || id, hash: card.hash || '', url, points, type });
            }
        };
        addGeneric(dashHtml, 'dash', REWARDS.dash);
        addGeneric(earnHtml, 'earn', REWARDS.earn);
        return { tasks, stat };
    }

    function parseQuestIds(html) {
        const clean = String(html || '').replace(/\\"/g, '"');
        const ids = [];
        let m;
        const reOffer = /"offerId":"([^"]*punchcard[^"]*)"/g;
        while ((m = reOffer.exec(clean)) !== null) {
            if (!ids.includes(m[1])) ids.push(m[1]);
        }
        const reLink = /\\?\/earn\\?\/quest\\?\/([A-Za-z0-9_.%-]+)/g;
        while ((m = reLink.exec(clean)) !== null) {
            let id = m[1];
            try { id = decodeURIComponent(id); } catch { }
            if (!ids.includes(id)) ids.push(id);
        }
        return ids;
    }

    function parseQuestSubtasks(html) {
        const clean = String(html || '').replace(/\\"/g, '"');
        const re = /"hash":"([^"]+)"[^{}]*?"isCompleted":"?(true|false)"?\s*,\s*"isLocked":"?(true|false)"?(?:\s*,\s*"isDisabled":"?(true|false)"?)?[^{}]*?"offerId":"([A-Za-z_]*pcchild\d+_urlreward[^"]*punchcard)"/g;
        const list = [];
        const seen = new Set();
        let m;
        while ((m = re.exec(clean)) !== null) {
            const offerId = m[5];
            if (seen.has(offerId)) continue;
            seen.add(offerId);
            list.push({
                hash: m[1],
                isCompleted: m[2] === 'true',
                isLocked: m[3] === 'true',
                isDisabled: m[4] === 'true',
                offerId
            });
        }
        return list;
    }

    function parseQuestProgress(html) {
        const clean = String(html || '').replace(/\\"/g, '"');
        const m = clean.match(/(\d+)\s*\/\s*(\d+)\s*个任务/);
        const day = clean.match(/\((\d+)\s*\/\s*(\d+)\s*天已完成\)/);
        return {
            done: m ? parseInt(m[1], 10) : 0,
            total: m ? parseInt(m[2], 10) : 0,
            days: day ? `${day[1]}/${day[2]}` : ''
        };
    }

    function parseQuestTitle(html) {
        const clean = String(html || '');
        const unescaped = clean.replace(/\\"/g, '"');

        const isInternal = (s) => {
            if (!s) return true;
            const t = s.trim();
            return /^\{|^\[|^http|^\/|^Next\.|MetadataOutlet|^rewards$/i.test(t);
        };

        const titleTag = clean.match(/<title[^>]*>([^<]{2,80})<\/title>/i);
        if (titleTag) {
            const t = titleTag[1].trim();
            const stripped = t.replace(/\s*[-|–—]\s*Microsoft\s*Rewards\s*$/i, '').replace(/\s*[-|–—]\s*必应\s*Rewards\s*$/i, '').trim();
            if (stripped && !isInternal(stripped)) return stripped;
        }

        const fieldRe = /"title":"([^"]{2,80})"|"name":"([^"]{2,80})"|"displayName":"([^"]{2,80})"/gi;
        let m;
        while ((m = fieldRe.exec(unescaped)) !== null) {
            const t = (m[1] || m[2] || m[3] || '').trim();
            if (!isInternal(t)) return t;
        }
        return '';
    }

    const shortQuestName = (id) => {
        const s = String(id || '').replace(/_?punchcard$/i, '');
        return s.length > 28 ? '…' + s.slice(-27) : s;
    };

    const questTypeOf = (title, id) => {
        const s = `${title || ''} ${id || ''}`.toLowerCase();
        if (/每周|weekly|weeklyset|weekly_set/.test(s)) return { tag: '🗓', label: '每周' };
        if (/一月|二月|三月|四月|五月|六月|七月|八月|九月|十月|十一月|十二月|january|february|march|april|may|june|july|august|september|october|november|december|monthly|monthlyset|monthly_set/.test(s)) return { tag: '📅', label: '月度' };
        return { tag: '⏰', label: '限时' };
    };

    function loadQuestState() {
        try {
            const raw = JSON.parse(GM_getValue(REWARDS.questKey, '') || 'null');
            if (raw && raw.date === getTodayYmd() && Array.isArray(raw.list)) return raw.list;
        } catch { }
        return [];
    }
    function saveQuestState(list) {
        state.quests = Array.isArray(list) ? list : [];
        try {
            GM_setValue(REWARDS.questKey, JSON.stringify({ date: getTodayYmd(), list: state.quests }));
        } catch { }
    }

    async function dapiActivity(token, { type, attributes = {}, region }) {
        const res = await gmRequest({
            method: 'POST',
            url: DAPI_ACTIVITY_URL,
            headers: dapiHeaders(token, region),
            data: JSON.stringify({
                amount: 1,
                country: region,
                id: generateDapiId(),
                type,
                channel: 'SAAndroid',
                attributes
            })
        });
        return typeof res === 'string' ? JSON.parse(res) : res;
    }

    async function getDapiPromotions(token, region, force = false) {
        const data = await getDapiMe(token, region, !force);
        return data?.response?.promotions || null;
    }

    async function runAppDailySet(token, region) {
        try {
            const promos = await getDapiPromotions(token, region);
            if (!promos) {
                log('🟡 未取到 APP 活动列表，跳过 APP 每日打卡');
                return;
            }
            const isItem = p => /^Gamification_DailySet_/.test(p.attributes?.offerid || '');
            const isToday = p => {
                const m = (p.attributes?.offerid || '').match(/(20\d{6})/);
                return !m || m[1] === getTodayYmd();
            };
            const isDone = p => {
                const prog = parseInt(p.attributes?.progress, 10) || 0;
                const max = parseInt(p.attributes?.max, 10) || 0;
                return max > 0 && prog >= max;
            };
            const items = promos.filter(p => isItem(p) && isToday(p));
            if (!items.length) {
                log('📅 APP 通道未下发「每日打卡」项');
                return;
            }
            const brief = items
                .map(p => `${p.attributes?.title || p.attributes?.offerid || '?'} ${p.attributes?.progress ?? '?'}/${p.attributes?.max ?? '?'}`)
                .join('，');
            log(`📅 APP 每日打卡：${brief}`);
            const pending = items.filter(p => !isDone(p));
            if (!pending.length) {
                log('✅ APP 每日打卡已全部完成');
                return;
            }
            const pointsOf = list => list.filter(isDone).reduce((s, p) => s + (parseInt(p.attributes?.max, 10) || 0), 0);
            const before = pointsOf(items);
            for (let i = 0; i < pending.length; i++) {
                await waitWhilePaused();
                const attr = pending[i].attributes || {};
                log(`📅 正在完成 APP 打卡 ${i + 1}/${pending.length}：${attr.title || attr.offerid}`);
                try {
                    const r = await dapiActivity(token, { type: 101, attributes: { offerid: attr.offerid || '' }, region });
                    if (r && r.code === 0 && r.response?.activity) {
                        log(`📅 已记账 +${Number(r.response.activity.p) || 0} 分`);
                    }
                } catch (e) {
                    log(`⚠️ APP 打卡上报失败：${e.message}`);
                }
                if (i < pending.length - 1) {
                    const gap = randomRange(4000, 10000);
                    log(`☕ 随机等待 ${(gap / 1000).toFixed(1)} 秒（下一项打卡）...`);
                    await sleep(gap);
                }
            }
            await sleep(randomRange(3000, 6000));
            const after = await getDapiPromotions(token, region, true);
            if (after) {
                const gained = Math.max(0, pointsOf(after.filter(p => isItem(p) && isToday(p))) - before);
                log(gained > 0
                    ? `📅 APP 每日打卡完成，本次到账 ${gained} 分`
                    : '📅 APP 打卡已上报，服务端暂未确认到账（可能已完成过）');
            }
        } catch (e) {
            log('🟡 APP 每日打卡出错：' + e.message);
        }
    }

    const runSign = async () => {
        nodes.btnSign.disabled = true;
        markBusy(1);
        await waitWhilePaused();
        log('⏳ 正在尝试 App 移动端签到...');

        const region = currentRegion();

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
            const res = await withAccessTokenRequest(token => dapiActivity(token, {
                type: 103,
                attributes: { offerid: offerId },
                region
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

    const runRead = async () => {
    nodes.btnRead.textContent = '⏹ 停止阅读';
    state.readRunning = true;
    markBusy(1);
    await waitWhilePaused();
    log('⏳ 开始阅读任务...');

    const region = currentRegion();

    try {
        const info = await withAccessTokenRequest(token => getDapiMe(token, region));

        if (info) {
            const d = typeof info === 'string' ? JSON.parse(info) : info;
            const p = d.response?.promotions?.find(x => x.attributes?.offerid === READ_OFFER_ID);

            if (p && p.attributes) {
                let cur = parseInt(p.attributes.progress) || 0;
                let max = parseInt(p.attributes.max) || 30;
                
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
                    let readFailStreak = 0;
                    while (cur < max) {
                        if (!state.readRunning) break;

                        await waitWhilePaused();
                        currentArticleIdx++;
                        log(`📖 正在阅读第 ${currentArticleIdx}/${totalArticles} 篇文章 (进度: ${cur}/${max})...`);

                        const res = await withAccessTokenRequest(token => dapiActivity(token, {
                            type: 101,
                            attributes: { offerid: READ_OFFER_ID },
                            region
                        })).catch(() => null);

                        let gained = 0;
                        let duplicate = false;
                        if (res) {
                            let d = res;
                            if (typeof d === 'string') {
                                try { d = JSON.parse(d); } catch { d = null; }
                            }
                            if (d && (d.code == null || Number(d.code) === 0)) {
                                const act = d.response?.activity;
                                gained = Number(act?.p ?? act?.points ?? 0) || 0;
                                duplicate = !!d.response?.isDuplicate && gained === 0;
                            }
                        }

                        if (gained > 0) {
                            cur = Math.min(max, cur + step);
                            state.points = (state.points || 0) + gained;
                            state.readCur = cur;
                            render();
                            readFailStreak = 0;
                            log(`🎉 第 ${currentArticleIdx}/${totalArticles} 篇阅读成功 (+${gained}积分) | 进度: ${state.readCur}/${max} | 当前总积分: ${state.points}`);
                        } else if (duplicate) {
                            cur = Math.min(max, cur + step);
                            state.readCur = cur;
                            render();
                            readFailStreak = 0;
                            log(`ℹ️ 第 ${currentArticleIdx}/${totalArticles} 篇已在此前完成（+0 分），继续下一篇`);
                        } else {
                            readFailStreak++;
                            log(`⚠️ 第 ${currentArticleIdx}/${totalArticles} 篇上报未生效（连续 ${readFailStreak} 次）`);
                            if (readFailStreak >= 3) {
                                log('🛑 连续 3 篇阅读未生效，已停止：请确认登录状态或稍后再试');
                                break;
                            }
                        }

                        if (cur < max) {
                            const readDelay = typeof randomRange === 'function' 
                                ? randomRange(CONFIG.read.minDelay, CONFIG.read.maxDelay) 
                                : 10000;
                            log(`☕ 随机等待 ${(readDelay / 1000).toFixed(1)} 秒...`);
                            await sleep(readDelay);
                        }
                    }

                    if (cur >= max) {
                        log(`✅ 阅读任务执行完毕 (最终进度: ${state.readCur}/${max})`);
                    } else {
                        log(`⏹️ 阅读任务已停止 (当前进度: ${state.readCur}/${max})`);
                    }
                }
            } else {
                log(`⚠️ 未找到阅读任务卡片 (offerid: ${READ_OFFER_ID})`);
            }
        } else {
            log('❌ 获取阅读进度失败');
        }

        await updateData();
    } catch (e) {
        log('❌ 阅读出错: ' + e.message);
        console.error('[Rewards 阅读异常]:', e);
    } finally {
    state.readRunning = false;
    nodes.btnRead.textContent = '📖 阅读';
    markBusy(-1);
    }
};

nodes.btnRead.onclick = () => {
    if (state.readRunning) {
        state.readRunning = false;
        log('⏹️ 已请求停止阅读，当前这篇完成后退出');
        return;
    }
    runRead();
};

    const runPromo = async () => {
        nodes.btnPromo.disabled = true;
        markBusy(1);
        await waitWhilePaused();
        log('⏳ 开始执行活动任务...');
        clearPageCache();
        try {
            const region = currentRegion();
            const accessToken = await getAccessToken();

            let dashHtml = '', earnHtml = '';
            try {
                dashHtml = (await fetchRewardsPage(REWARDS.dash)).html;
            } catch (e) {
                log('⚠️ dashboard 页面获取失败：' + e.message);
            }
            if (dashHtml) await sleep(randomRange(800, 2000));
            try {
                earnHtml = (await fetchRewardsPage(REWARDS.earn)).html;
            } catch (e) {
                log('⚠️ earn 页面获取失败：' + e.message);
            }
            if (!dashHtml && !earnHtml) {
                log('❌ 活动页面全部获取失败，请确认已登录 rewards.bing.com 后重试（10 分钟后会自动重试）');
                markDataBlocked();
                return;
            }
            if (!dashHtml) log('🟡 dashboard 未取到，仅按 earn 页统计');
            if (!earnHtml) log('🟡 earn 未取到，仅按 dashboard 统计');

            const { tasks, stat } = collectPromoTasks(dashHtml, earnHtml);
            state.promosDone = stat.dashDone + stat.earnDone;
            state.promosTotal = stat.dashTotal + stat.earnTotal;
            render();
            if (stat.earnParseFailed) log('🟡 earn 页面活动结构异常，未能解析活动卡片');
            const skipped = [];
            if (stat.locked > 0) skipped.push(`${stat.locked} 个需 App 解锁`);
            if (stat.levelLocked > 0) skipped.push(`${stat.levelLocked} 个等级不足`);
            if (stat.skippedQuest > 0) skipped.push(`${stat.skippedQuest} 个打卡任务`);
            if (stat.noHash > 0) skipped.push(`${stat.noHash} 个无交卷标识`);
            if (stat.searchSkipped > 0) skipped.push(`${stat.searchSkipped} 个搜索类任务（需手动完成）`);
            log(`🎯 活动：待做 ${tasks.length} 个${skipped.length ? `，已跳过 ${skipped.join('、')}` : ''}`);

            let okCount = 0, failCount = 0, manualCount = 0, originCount = 0, appGained = 0, skipRest = 0;
            if (tasks.length) {
                let actionInfo = await getRewardsAction([dashHtml, earnHtml]);
                let channelDown = false;
                const sameHost = isSameRewardsHost();
                let originBlocked = false;
                for (let i = 0; i < tasks.length; i++) {
                    if (channelDown) { skipRest++; continue; }
                    await waitWhilePaused();
                    const task = tasks[i];
                    const taskLabel = `(${i + 1}/${tasks.length}) ${task.title || task.id}`;
                    let posted = false;
                    let taskGained = 0;
                    let lastWebErr = null;
                    for (let attempt = 1; attempt <= 2 && !posted && !originBlocked; attempt++) {
                        try {
                            const respText = await postServerAction({
                                url: task.url,
                                actionId: actionInfo.ids.reportActivity || REWARDS.actionFallback,
                                dpl: actionInfo.dpl,
                                referer: task.url,
                                body: JSON.stringify([task.hash, 11, {
                                    offerid: task.id,
                                    isPromotional: '$undefined',
                                    timezoneOffset: getTimezoneOffsetStr()
                                }])
                            });
                            const pm = String(respText || '').match(/"p":\s*(\d+)/);
                            const got = pm ? parseInt(pm[1], 10) : -1;
                            if (got > 0) {
                                posted = true;
                                taskGained = got;
                                appGained += got;
                            } else if (got === 0) {
                                const err = new Error('服务端返回 0 分（未记账）');
                                err.taskLevel = true;
                                lastWebErr = err;
                            } else if (/<!doctype\s+html|<html|login\.live\.com|id="i0116"/i.test(String(respText || '').slice(0, 500))) {
                                const err = new Error('交卷被重定向到登录页（未记账）');
                                err.taskLevel = true;
                                lastWebErr = err;
                            } else {
                                posted = true;
                            }
                        } catch (e) {
                            lastWebErr = e;
                            if (e.status === 404) {
                                clearActionCache();
                                actionInfo = await getRewardsAction([dashHtml, earnHtml]);
                                continue;
                            }
                            if (!sameHost && e.status >= 500) {
                                // 500 = 站点校验 Referer/Origin，跨站重试无意义
                                originBlocked = true;
                                const raw = String(e.responseText || '').replace(/\s+/g, ' ').trim();
                                const snippet = /^<(!doctype|html)/i.test(raw) ? '（返回网页而非 flight 数据）' : raw.slice(0, 120);
                                log(`🟡 网页交卷被拒（HTTP ${e.status}${snippet ? `｜${snippet}` : ''}）：当前页面无法为 rewards 域带 Referer，剩余活动改用 APP 通道`);
                                break;
                            }
                            if (attempt < 2) await sleep(randomRange(3000, 6000));
                        }
                    }
                    if (!posted && accessToken) {
                        try {
                            const r = await dapiActivity(accessToken, { type: 101, attributes: { offerid: task.id }, region });
                            const p = Number(r?.response?.activity?.p) || 0;
                            if (r && r.code === 0 && p > 0) {
                                posted = true;
                                taskGained = p;
                                appGained += p;
                            }
                        } catch { }
                    }
                    if (posted) {
                        okCount++;
                        if (task.type === 'dash') stat.dashDone += task.points;
                        else stat.earnDone += task.points;
                        state.promosDone = stat.dashDone + stat.earnDone;
                        render();
                        log(`✅ ${taskLabel} 完成${taskGained ? ` +${taskGained} 分` : `（${task.points} 分）`}`);
                    } else if (originBlocked) {
                        originCount++;
                    } else {
                        const e = lastWebErr;
                        const uncredited = !e || e.taskLevel;
                        if (uncredited) manualCount++; else failCount++;
                        log(uncredited
                            ? `🟡 ${taskLabel} 需手动完成（服务端未记账）`
                            : `❌ ${taskLabel} 失败${e ? `：${e.message}` : ''}`);
                        const channelLevel = !e || (!e.taskLevel && (!e.status || e.status >= 500));
                        if (channelLevel) {
                            channelDown = true;
                            log(`🟡 交卷通道不可用（${e ? e.message : '网络错误'}），本次跳过剩余活动${crossHostHint()}`);
                        }
                    }
                    if (!channelDown && i < tasks.length - 1) {
                        const gap = randomRange(5000, 12000);
                        log(`☕ 随机等待 ${(gap / 1000).toFixed(1)} 秒（下一项活动）...`);
                        await sleep(gap);
                    }
                }
            }

            const skipTotal = stat.locked + stat.levelLocked + stat.skippedQuest + stat.noHash + stat.searchSkipped + skipRest;
            const skipParts = [];
            if (stat.locked > 0) skipParts.push(`${stat.locked} 个需 App 解锁`);
            if (stat.levelLocked > 0) skipParts.push(`${stat.levelLocked} 个等级不足`);
            if (stat.skippedQuest > 0) skipParts.push(`${stat.skippedQuest} 个打卡任务`);
            if (stat.noHash > 0) skipParts.push(`${stat.noHash} 个无交卷标识`);
            if (stat.searchSkipped > 0) skipParts.push(`${stat.searchSkipped} 个搜索类任务`);
            if (skipRest > 0) skipParts.push(`${skipRest} 个因通道中断跳过`);
            const donePoints = stat.dashDone + stat.earnDone;
            const manualPart = manualCount ? `，需手动 ${manualCount} 个` : '';
            const originTotal = originCount + stat.originOnly;
            log(`🏁 活动全部完成：成功 ${okCount} 个${manualPart}，失败 ${failCount} 个，跳过 ${skipTotal} 个`
                + `${skipParts.length ? `（${skipParts.join('、')}）` : ''}`
                + `，到账积分 ${donePoints}/${stat.dashTotal + stat.earnTotal}${appGained ? `（本次 +${appGained}）` : ''}`);
            if (originTotal) {
                log(`🟡 ${originTotal} 个活动需在 rewards 页面手动完成：点「其他任务」右侧的「前往完成」过去做`);
            }

            const hasWebDailySet = /"dailySetItems":\[\{/.test(String(dashHtml).replace(/\\"/g, '"'));
            if (!hasWebDailySet && accessToken) await runAppDailySet(accessToken, region);

            await updateData();
            state.promosDone = stat.dashDone + stat.earnDone;
            state.promosTotal = stat.dashTotal + stat.earnTotal;
            savePromoScore();
            render();
            checkClaimablePoints(null, true);
        } catch (e) {
            console.error('[Rewards] 活动任务异常:', e);
            log('❌ 活动执行出错：' + e.message);
        } finally {
            nodes.btnPromo.disabled = false;
            markBusy(-1);
        }
    };

    const refreshPromoScore = async () => {
        try {
            const [dashRes, earnRes] = await Promise.all([
                fetchRewardsPage(REWARDS.dash).catch(() => ({ html: '', from: 'none' })),
                fetchRewardsPage(REWARDS.earn).catch(() => ({ html: '', from: 'none' }))
            ]);
            const dashHtml = dashRes.html, earnHtml = earnRes.html;
            if (!dashHtml && !earnHtml) {
                if (!state.needLogin) {
                    warnFetchFail('活动', REWARDS.earn);
                    pageFailStreak++;
                    if (pageFailStreak >= 2) markDataBlocked();
                }
                return { ok: false, dashHtml: '' };
            }
            pageFailStreak = 0;
            const { stat } = collectPromoTasks(dashHtml, earnHtml);
            const done = stat.dashDone + stat.earnDone;
            const total = stat.dashTotal + stat.earnTotal;
            if (!total) {
                warnParseEmpty('活动', anchorStat(dashHtml) + ' / ' + anchorStat(earnHtml));
                if (state.promosTotal > 0) {
                    if (dashHtml) await checkClaimablePoints(dashHtml, true);
                    return { ok: true, dashHtml };
                }
            }
            state.promosDone = done;
            state.promosTotal = total;
            savePromoScore();
            render();
            if (dashHtml) await checkClaimablePoints(dashHtml, true);
            return { ok: true, dashHtml };
        } catch { return { ok: false, dashHtml: '' }; }
    };

    let lastLoginRecoverAt = 0;
    async function recoverFromLogin() {
        const now = Date.now();
        if (now - lastLoginRecoverAt < 30 * 1000) return;
        lastLoginRecoverAt = now;
        if (state.needLogin) log('🔄 页面重新可见，正在确认登录状态…');
        try {
            await syncAll();
        } catch { }
    }

    function detectClaimableAmount(html) {
        const s = String(html || '');
        const altRe = /alt="(?:可领取|可領取|领取|領取|Claim|Redeem|Claim points|引き換え|受け取る|청구|수령|수집)[^"]*"[^>]*>[\s\S]{0,300}?(\d[\d,]*)/i;
        let m = s.match(altRe);
        if (m) return parseInt(m[1].replace(/,/g, ''), 10) || 0;
        m = s.match(/"pointClaim"\s*:\s*\{[^{}]{0,200}?"(?:points|amount|value|total|max)"\s*:\s*"?(\d+)/i);
        if (m) return parseInt(m[1], 10) || 0;
        m = s.match(/"(?:claimablePoints|claimPoints|pendingPoints)"\s*:\s*"?(\d+)/i);
        if (m) return parseInt(m[1], 10) || 0;
        return 0;
    }

    function claimableFromDashboard() {
        try {
            const pc = dashboard?.pointClaim;
            if (typeof pc === 'number') return pc;
            if (pc && typeof pc === 'object') {
                const v = Number(pc.points ?? pc.amount ?? pc.value ?? pc.total ?? 0);
                if (v > 0) return v;
            }
            const v2 = Number(dashboard?.claimablePoints ?? dashboard?.userStatus?.claimablePoints ?? 0);
            return v2 > 0 ? v2 : 0;
        } catch { return 0; }
    }

    async function checkClaimablePoints(html, force = false) {
        const now = Date.now();
        if (!force && state.claimCheckedAt && now - state.claimCheckedAt < 5 * 60 * 1000) return;
        state.claimCheckedAt = now;
        try {
            if (html == null) {
                const res = await fetchRewardsPage(REWARDS.dash);
                html = res.html;
                if (!html) { warnFetchFail('可领取积分', REWARDS.dash); return; }
            }
            if (!html) { warnFetchFail('可领取积分', REWARDS.dash); return; }
            let amount = detectClaimableAmount(html);
            if (!amount) amount = claimableFromDashboard();
            const prev = state.claimablePoints || 0;
            state.claimablePoints = amount;
            if (amount !== prev) render();
            if (amount > prev) {
                log(`🎁 发现 ${amount} 积分待领取，点「去领取」直达领取面板`);
                try {
                    if (typeof GM_notification === 'function' && GM_getValue('Config.claimNoticeDate', 0) !== getTodayYmd()) {
                        GM_setValue('Config.claimNoticeDate', getTodayYmd());
                        GM_notification({
                            title: 'Microsoft Rewards',
                            text: `有 ${amount} 积分待领取，点面板「去领取」直达领取页面`,
                            timeout: 8000
                        });
                    }
                } catch { }
            }
        } catch (e) {
            console.warn('[Rewards] 可领取积分检测失败:', e.message);
        }
    }

    let punchcardPromise = null;
    const readPunchcardProgress = async () => {
        if (punchcardPromise) return punchcardPromise;
        const run = async () => {
            state.punchcardRunning = true;
            try {
                const { html: earnHtml } = await fetchRewardsPage(REWARDS.earn).catch(() => ({ html: '' }));
                if (!earnHtml) {
                    warnFetchFail('其他任务', REWARDS.earn); // 内部已按 needLogin 去重
                    return; // 保留上次结果，不清空
                }
                const questIds = parseQuestIds(earnHtml);
                if (!questIds.length) {
                    warnParseEmpty('其他任务', anchorStat(earnHtml));
                    if ((state.quests || []).length) {
                        render();
                        return;
                    }
                    saveQuestState([]);
                    render();
                    return;
                }
                const prevList = state.quests || [];
                const results = [];
                for (let qi = 0; qi < questIds.length; qi++) {
                    if (qi > 0) await sleep(randomRange(800, 2000));
                    const questId = questIds[qi];
                    const questUrl = REWARDS.quest + encodeURIComponent(questId);
                    const { html } = await fetchRewardsPage(questUrl, CONFIG.ua.rewardsApp).catch(() => ({ html: '' }));
                    const prev = prevList.find(r => r && r.id === questId);
                    if (!html) {
                        results.push(prev || { id: questId, done: 0, total: 0 });
                        continue;
                    }
                    const subs = parseQuestSubtasks(html);
                    const prog = parseQuestProgress(html);
                    const title = parseQuestTitle(html) || prev?.title || shortQuestName(questId);
                    const type = questTypeOf(title, questId);
                    const total = prog.total || subs.length;
                    const done = prog.done || subs.filter(s => s.isCompleted).length;
                    if (!total && prev && prev.total > 0) {
                        results.push({ ...prev, title, type: type.label, tag: type.tag });
                        continue;
                    }
                    const canDo = subs.length
                        ? subs.some(s => !s.isCompleted && !s.isLocked && !s.isDisabled)
                        : null;
                    results.push({ id: questId, title, tag: type.tag, type: type.label, done, total, canDo, complete: total > 0 && done >= total, days: prog.days });
                }
                saveQuestState(results);
                render();
            } catch { } finally {
                state.punchcardRunning = false;
            }
        };
        punchcardPromise = run().finally(() => { punchcardPromise = null; });
        return punchcardPromise;
    };

    nodes.btnPromo.onclick = runPromo;

    // ===== 全量同步 =====
    let syncAllPromise = null;
    async function syncAll() {
        if (syncAllPromise) return syncAllPromise;
        syncAllPromise = (async () => {
            try { clearPageCache(); } catch { }
            const fail = [];
            let dashHtml = '';
            let promoOk = false;
            try {
                await updateData();
                if (state.syncStale) fail.push('积分/搜索/阅读');
            } catch { fail.push('积分/搜索/阅读'); }
            try {
                const r = await refreshPromoScore();
                if (r && r.ok) { dashHtml = r.dashHtml || ''; promoOk = true; }
                else fail.push('日常活动');
            } catch { fail.push('日常活动'); }
            try { await readPunchcardProgress(); } catch { /* 内部已兜底 */ }
            if (promoOk && !dashHtml) { try { await checkClaimablePoints(null, true); } catch { } }
            if (fail.length || state.needLogin) {
                markSyncStale(fail.length ? `${fail.join('、')}未同步` : '登录态异常，部分进度未同步');
            } else {
                markSyncOk();
            }
            state.dataDate = getTodayYmd();
            state.lastProgressAt = Date.now();
            state.lastQuestAt = Date.now();
            render();
        })().finally(() => { syncAllPromise = null; });
        return syncAllPromise;
    }

    // ===== 诊断：把页面结构、卡片资格、打卡子项、action 标识压成几十行输出到控制台 =====
    async function runDiagnostics() {
        const out = [];
        const add = (s) => out.push(s);
        add(`v${APP_VERSION} level=${state.level} country=${state.country} today=${getTodayYmd()}`);
        add(`host=${location.hostname} origin=${isSameRewardsHost() ? 'same' : 'cross'}`
            + (isSameRewardsHost() ? '' : '  << 网页交卷需同源 Referer；Edge 跨站会 500，请到 rewards.bing.com 页面点「活动」'));
        let dash = '', earn = '', loginHit = false;
        const fromOf = { dash: '-', earn: '-' };
        try {
            const r = await fetchRewardsPage(REWARDS.dash, '', { force: true });
            dash = r.html; fromOf.dash = r.from; if (r.login) loginHit = true;
        } catch (e) { add('dash ERR ' + e.message); }
        try {
            const r = await fetchRewardsPage(REWARDS.earn, '', { force: true });
            earn = r.html; fromOf.earn = r.from; if (r.login) loginHit = true;
        } catch (e) { add('earn ERR ' + e.message); }
        add(`fetch from: dash=${fromOf.dash} earn=${fromOf.earn} login=${loginHit ? 'YES' : 'no'}`
            + (loginHit ? '  << 抓到登录页：未登录 / 登录已失效，先登录 rewards.bing.com'
                : (fromOf.dash === 'none' || fromOf.earn === 'none' ? '  << 页面抓取失败，活动/打卡/可领取都会缺数据' : '')));
        const keys = ['dailySetItems', 'dailySetPromotions', 'morePromotions', 'activities', 'activityCards', 'pointClaim'];
        const cnt = (h, k) => (String(h || '').match(new RegExp('"' + k + '":', 'g')) || []).length;
        add('dash len=' + dash.length + ' ' + keys.map(k => k + '=' + cnt(dash, k)).join(' '));
        add('earn len=' + earn.length + ' ' + keys.map(k => k + '=' + cnt(earn, k)).join(' '));
        add('claim html=' + detectClaimableAmount(dash) + ' dapi=' + claimableFromDashboard());
        try {
            const info = await getRewardsAction([dash, earn]);
            add('actions=' + Object.keys(info.ids).join(',') + ' dpl=' + (info.dpl || '-'));
        } catch (e) { add('actions ERR ' + e.message); }
        const dumpCards = (h, tag) => {
            const cards = extractCardsByOfferId(h);
            add(tag + ' cards=' + cards.length);
            for (const c of cards) {
                if (!c.offerId) continue;
                const why = isSearchLikeCard(c);
                const origWhy = isOriginOnlyCard(c);
                const ptype = String(c.promotionType || c.attributes?.type || c.type || '-');
                const nm = String(c.name || '-').slice(0, 24);
                const hint = why ? ` why=${String(c.name || c.promotionType || c.attributes?.type || c.title || '').slice(0, 50)}` : '';
                add(`  ${tag} ${c.offerId} p=${c.points ?? '-'} type=${ptype} name=${nm} done=${c.isCompleted} lock=${c.isLocked} unl=${c.isUnlocked} lvl=${requiredLevelOf(c.offerId)} date=${c.date || '-'} hash=${c.hash ? 'y' : 'n'} srch=${why ? 'y(' + why + ')' : 'n'}${hint} orig=${origWhy ? 'y(' + origWhy + ')' : 'n'} crit=${typeof c.unlockCriteria === 'string' ? c.unlockCriteria.slice(0, 24) : '-'}`);
            }
        };
        dumpCards(dash, 'D');
        dumpCards(earn, 'E');
        const questIds = parseQuestIds(earn);
        add('quests=' + questIds.length + ' ' + questIds.join(' '));
        for (const id of questIds.slice(0, 4)) {
            const qt = REWARDS.quest + encodeURIComponent(id);
            try {
                const html = await getRewardsHtml(qt, CONFIG.ua.rewardsApp);
                const clean = String(html).replace(/\\"/g, '"');
                const p = parseQuestProgress(html);
                const subs = parseQuestSubtasks(clean);
                add(`  Q ${shortQuestName(id)} len=${html.length} prog=${p.done}/${p.total} days=${p.days || '-'} subs=${subs.length}`);
                for (const s of subs) add(`    S ${s.offerId} done=${s.isCompleted} lock=${s.isLocked} dis=${s.isDisabled} hash=${s.hash ? 'y' : 'n'}`);
                if (!subs.length) {
                    const i = clean.indexOf('个任务');
                    if (i > -1) add('    CTX ' + clean.slice(Math.max(0, i - 140), i + 30).replace(/\s+/g, ' '));
                }
            } catch (e) { add(`  Q ${shortQuestName(id)} ERR ${e.message}`); }
        }
        const ci = (dash + earn).indexOf('"pointClaim"');
        add('claimJson=' + (ci > -1 ? (dash + earn).slice(ci, ci + 60).replace(/\s+/g, ' ')
            : 'none（可领取积分来自 alt 文案 / 扁平字段，见上面的 claim html=）'));
        for (const line of out) console.log('[MR-DIAG] ' + line);
        log(`🔍 诊断完成：${out.length} 行已输出到控制台（F12 → Console → 搜 MR-DIAG）`);
    }
    if (typeof GM_registerMenuCommand === 'function') {
        GM_registerMenuCommand('🔍 导出 Rewards 诊断日志', () => { runDiagnostics(); });
    }

    // ========== 搜索 ==========
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

        if (!state.syncAt || Date.now() - state.syncAt > 30000) await updateData();

        const envDelay = ENV_MOBILE ? CONFIG.mobile : CONFIG.pc;

        const doSearch = async (query) => {
            const host = currentSearchHost();
            const cookie = await getCookies(`https://${host}`);
            await waitWhilePaused();

            const ua = ENV_MOBILE ? CONFIG.ua.mobile : CONFIG.ua.pc;
            const searchUrl = `https://${host}/search?q=${encodeURIComponent(query)}&form=QBLH`;

            try {
                const searchResult = await gmRequest({
                    url: searchUrl,
                    headers: {
                        'User-Agent': ua,
                        'Cookie': cookie,
                        'Referer': `https://${host}/?form=QBLH`
                    }
                });

                const body = String(searchResult || '');
                const looksResults = /id="b_results"|class="b_results"|id="sb_form_q"|class="b_algo"/.test(body);
                // 结果页出现登录域名不算重定向，只看结果容器
                const looksLogin = !looksResults &&
                    /login\.live\.com|account\.live\.com|id="i0116"|<title>\s*(?:Sign in|登录)/i.test(body);
                const igMatch = body.match(/,IG:"([^"]+)"/) || body.match(/"IG":"([^"]+)"/);
                if (looksLogin) throw new Error('结果页被重定向到登录页，请先登录 rewards.bing.com');
                if (!igMatch && !looksResults) throw new Error('未取到有效搜索结果页');
                const ig = igMatch ? igMatch[1] : crypto.randomUUID().replace(/-/g, '').toUpperCase();

                const reportHeaders = {
                    'User-Agent': ua,
                    'Cookie': cookie,
                    'Referer': searchUrl,
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
                };

                await sleep(randomRange(400, 1200));

                await gmRequest({
                    method: 'POST',
                    url: `https://${host}/rewardsapp/ncheader?ver=88888888&IID=SERP.5047&IG=${ig}&ajaxreq=1`,
                    headers: reportHeaders,
                    data: 'wb=1%3bi%3d1%3bv%3d1'
                }).catch(() => {});

                await sleep(randomRange(700, 1800));

                await gmRequest({
                    method: 'POST',
                    url: `https://${host}/rewardsapp/reportActivity?IG=${ig}&IID=SERP.5047&q=${encodeURIComponent(query)}&ajaxreq=1`,
                    headers: reportHeaders,
                    data: `url=${encodeURIComponent(searchUrl)}&V=web`
                });

                log(`✓ 搜索: "${query.substring(0, 12)}..."`);
                return true;
            } catch (e) {
                console.error('[Rewards] 搜索异常:', e);
                log(`✗ 搜索失败: ${e.message}`);
                return false;
            }
        };
        const preciseWait = async (ms, label) => {
            let endTime = Date.now() + ms;

            const secs = ms / 1000;
            const tail = label ? `（${label}）` : '';
            if (secs > 60) {
                log(`⏳ 等待中，预计需要 ${(secs / 60).toFixed(1)} 分钟${tail}...`);
            } else if (secs >= 1) {
                log(`⏳ 等待 ${secs.toFixed(1)} 秒${tail}...`);
            }

            while (Date.now() < endTime && state.running) {
                if (state.manualPaused) {
                    endTime += await waitWhilePaused();
                    continue;
                }
                const remaining = Math.max(0, endTime - Date.now());
                await sleep(Math.min(500, remaining));
            }
        };

        const checkPause = async () => {
            if (!CONFIG.pause.enabled) return;
            if (state.searchCur >= state.searchMax) return;

            state.searchCount++;
            saveProgress();

            if (state.searchCount % CONFIG.pause.interval === 0) {
                const pauseMs = CONFIG.pause.duration();
                const pauseMinutes = Math.round(pauseMs / 60000);
                log(`⏸️ 已完成 ${state.searchCount} 次搜索，触发防风控暂停 ${pauseMinutes} 分钟...`);
                await preciseWait(pauseMs);
                log(`▶️ 暂停结束，继续搜索...`);
            }
        };

        loadProgress();

        if (state.searchCur < state.searchMax) {
            log(`💻 开始执行通用搜索，当前进度: ${state.searchCur}/${state.searchMax}`);
            let searchIndex = 0;
            let recheckCount = 0;
            let failStreak = 0;

            while (state.searchCur < state.searchMax && state.running) {
                await waitWhilePaused();

                searchIndex++;
                const q = await getHotQuery();
                const ok = await doSearch(q);

                if (!ok) {
                    failStreak++;
                    log(`⚠️ 本次搜索未计入进度（连续失败 ${failStreak} 次）`);
                    if (failStreak >= 5) {
                        log('🛑 连续 5 次搜索未生效，已停止：请确认已登录 rewards.bing.com，或先手动搜一次过验证码');
                        break;
                    }
                    await preciseWait(randomRange(12000, 25000), '失败重试');
                    continue;
                }
                failStreak = 0;

                state.searchCur = Math.min(state.searchMax, state.searchCur + 3);
                render();
                await checkPause();
                if (!state.running) break;
                await preciseWait(randomRange(envDelay.minDelay, envDelay.maxDelay), '下一次搜索');

                if (searchIndex % 5 === 0) {
                    log(`🔄 已完成 ${searchIndex} 次搜索，同步一次数据...`);
                    await updateData();
                }

                if (state.searchCur >= state.searchMax) {
                    if (searchIndex % 5 !== 0) {
                        log(`🔄 搜索达到预估上限，最后同步一次数据...`);
                        await updateData();
                    }

                    if (state.searchCur < state.searchMax) {
                        recheckCount++;
                        if (recheckCount > 2) {
                            log(`🛑 已达到预估上限且连续 ${recheckCount} 次同步仍未完成，停止搜索 (${state.searchCur}/${state.searchMax})`);
                            break;
                        }
                        log(`🔁 预估已满但真实进度未满 (${state.searchCur}/${state.searchMax})，第 ${recheckCount} 次补搜...`);
                        continue;
                    }

                    log(`🎉 搜索积分已达今日上限 (${state.searchCur}/${state.searchMax})！`);
                    break;
                }
            }
            log(`💻 搜索结束，共执行 ${searchIndex} 次搜索 (最终进度: ${state.searchCur}/${state.searchMax})`);
        } else {
            log('💻 今日搜索任务已全部完成');
        }

        state.running = false;
        nodes.btnSearch.textContent = '🔍 搜索';
        updateAllButton();
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
            const gap = async (to) => {
                const ms = randomRange(5000, 12000);
                log(`☕ 随机等待 ${(ms / 1000).toFixed(1)} 秒（${to}）...`);
                await sleep(ms);
            };
            await runSign();
            await gap('进入阅读');
            await runRead();
            await gap('进入活动');
            await runPromo();
            await gap('进入搜索');
            await runSearch();
        } finally {
            state.allRunning = false;
            updateAllButton();
        }
    };
    (async () => {
        try {
            state.quests = loadQuestState();
            try {
                const ps = JSON.parse(GM_getValue('mr_promo_score', '') || 'null');
                if (ps && ps.date === getTodayYmd()) {
                    state.promosDone = ps.done || 0;
                    state.promosTotal = ps.total || 0;
                }
            } catch { }
            render();
            await syncAll();
        } catch { }
        const hour = new Date().getHours();

        if (hour >= 0 && hour < 8) {
            log('⚠️ 当前时间 00:00-08:00，Rewards 每日任务可能尚未刷新');
            log('💡 建议北京时间 08:00 后运行脚本，避免任务进度显示异常');
        }
        log(`🌟 脚本就绪 v${APP_VERSION}`);
    })();

    setInterval(() => {
        updateData().finally(() => {
            if (state.needLogin || state.syncBusy) return;
            const lastOk = state.syncAt || state.syncStartedAt || 0;
            if (lastOk && Date.now() - lastOk > SYNC_STALE_MS) render();
        });

        const now = Date.now();
        const today = getTodayYmd();
        // 跨天：先清内存旧值再全量重拉
        if (state.dataDate && state.dataDate !== today) {
            state.promosDone = 0;
            state.promosTotal = 0;
            state.quests = [];
            state.questDetailIdx = -1;
            state.claimablePoints = null;
            state.claimCheckedAt = 0;
            render();
            syncAll();
            return;
        }

        if (now - (state.lastProgressAt || 0) >= 5 * 60 * 1000) {
            state.lastProgressAt = now;
            refreshPromoScore().then(() => {
                if (state.claimablePoints == null) checkClaimablePoints(null, true);
            });
        }
        if (now - (state.lastQuestAt || 0) >= 10 * 60 * 1000) {
            state.lastQuestAt = now;
            readPunchcardProgress();
        }
    }, 60000);

})();
