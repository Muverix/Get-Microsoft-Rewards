// ==UserScript==
// @name         Get Microsoft Rewards (修复/增强版)
// @namespace    https://github.com/Muverix/Get-Microsoft-Rewards
// @version      1.4.1
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
    // 版本号统一从脚本管理器元数据 / @version 头部提取，避免多处硬编码不同步
    const APP_VERSION =
        (typeof GM_info !== 'undefined' && GM_info?.script?.version) ||
        (document.currentScript?.textContent?.match(/@version\s+([\w.\-]+)/i) || [])[1] ||
        '0.0.0';
    /* =========================================================================
     * 登录页「授权码自动捕获」
     * -------------------------------------------------------------------------
     * 在 login.live.com / login.microsoftonline.com 上不注入 Rewards 面板，
     * 只负责把跳转后网址里的 code 自动存进脚本存储，并给出提示页。
     * 回到 Bing / Rewards 标签页后，tryAutoFillAuthCode() 会自动回填并兑换，
     * 全程无需复制粘贴。
     * 注意：这段必须排在下面的站点白名单之前——login.microsoftonline.com /
     * account.live.com 不在白名单里，放后面的话这个分支永远走不到。
     * ========================================================================= */
    if (/^(login\.(live|microsoftonline)\.com|account\.live\.com)$/i.test(location.hostname)) {
        initOAuthCapturePage();
        return;
    }

    // 只保留真正能取到数据的域名：所有抓取/交卷都硬编码到 rewards.bing.com，
    // rewards.microsoft.com 上能建面板但拿不到账号数据，留着只会误导。
    const HOST_SUPPORTED = ['rewards.bing.com', 'www.bing.com', 'cn.bing.com'];
    if (!HOST_SUPPORTED.includes(window.location.hostname)) return;

    function initOAuthCapturePage() {
        const href = location.href;
        // 本函数在脚本最顶部执行，此时下方的 escapeHtmlText 还没初始化（const 的 TDZ），
        // 所以这里用局部转义。网址里的 code / error 一律按纯文本渲染，绝不当 HTML 插入，
        // 否则一条 ?error_description=<img onerror=...> 的链接就能在本页执行任意脚本。
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

        // 普通登录/授权中间页：不弹任何东西，交给微软自己的页面
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
    // 搜索请求的 UA / 站点要跟运行环境一致：手机用移动 UA，电脑用桌面 UA。
    // 判定顺序：UA 关键字 → iPadOS 13+ 伪装成 Mac 时看触点数 → 触屏且窄屏兜底。
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
    // 在国内用 cn.bing.com 一样能攒积分，所以在哪个域就搜哪个域，避免跨域 cookie/风控差异；
    // 若当前在 rewards.bing.com 等非搜索页，回落到 www.bing.com（会自动跳转到所在区域站点）。
    const currentSearchHost = () => {
        const h = (location.hostname || '').toLowerCase();
        if (h === 'cn.bing.com' || h === 'www.bing.com') return h;
        return 'www.bing.com';
    };

    // ========== 配置 ==========
    const CONFIG = {
        // 搜索间隔：一次搜索只值 3 分，等得久一点但稳。改成 18–35s / 25–45s 后
        // 一次跑满 45 次约 20 分钟，仍在可接受范围，但请求密度明显更像真人。
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
        // 防风控长暂停：每 15 次搜索随机停 2–5 分钟，兼顾请求节奏与总耗时
        pause: {
            enabled: true,
            interval: 15,
            duration: () => (2 + Math.random() * 3) * 60 * 1000
        }
    };

    // ========== dapi APP 通道：统一常量与请求头 ==========
    // 改一处漏一处就会出现区域/UA 不一致。这里集中收敛（都是运行时调用，函数声明会提升）。
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

    // dapi/me 短缓存：默认总是拉最新（积分/进度随时会变，签到完立刻刷新不能读旧值），
    // 只有「同一轮里的次要读取」（签到 last_updated 兜底、初始化补查阅读进度）才传
    // useCache=true 复用 30 秒内的响应。每次真实请求都会回写缓存。
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

    // 拿不到新 token 时返回 null，调用方保持原行为（返回原响应 / 抛原异常）。
    async function retryWithFreshToken(requestFn) {
        state.accessToken = null;
        state.accessTokenExpiresAt = 0;
        const token = await getAccessToken({ forceRefresh: true });
        if (!token) return null;
        return { res: await requestFn(token) };
    }

    // 积分新鲜度阈值：超过这个时间没有一次成功同步，就把「⚠ 未同步」亮出来。
    // 只靠「这一轮有没有报错」是不够的 —— updateData 有多条静默 return 的分支，
    // 以及登录失效后返回空数据却不抛错的情况，都会让积分一直停在旧值却不报警。
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
        // 搜索进度和暂停状态（只保留真正被读取的字段）
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
        // true = 这一轮没拿到新数据，积分可能是旧的 → 在积分旁亮一个「⚠ 未同步」
        syncStale: false,
        syncReason: '',       // 未同步的原因，鼠标悬停时显示
        syncAt: 0,            // 上次成功同步的时间戳
        syncRetryAt: 0,       // 上次点徽章手动同步的时间，用于节流
        syncBusy: false,      // 手动同步进行中 → 徽章显示「⟳ 同步中」
        syncStartedAt: Date.now()  // 脚本启动时间，syncAt 为 0 时用它兜底计时
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
        // 1. 获取 Token，若为空尝试强制刷新一次
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

            // 2. 检查返回结果字符串（适配 gmRequest 正常返回 401 错误 JSON 的情况）
            if (typeof res === 'string' && (res.includes('invalid_token') || res.includes('Unauthorized') || res.includes('"code":401'))) {
                console.warn('[Rewards] 响应中检测到 Token 失效，重新获取 Token 中...');
                const retry = await retryWithFreshToken(requestFn);
                if (retry) return retry.res;
            }
            return res;
        } catch (e) {
            // 3. 捕获网络层抛出的 401 异常
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

    // GM_xmlhttpRequest 封装
    async function gmRequest(options) {
        const retries = options.retries ?? 2;
        const retryDelay = options.retryDelay ?? 1000;
        // 自定义参数不能透传给 GM_xmlhttpRequest，否则部分管理器会提示未知参数
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
                                // 3xx 不再当成成功：以前把 Location 头当响应体 resolve 出去，
                                // 调用方会拿一个 URL 字符串去解析（活动/搜索都因此误判成功）
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
                // 指数退避 + 抖动：原抖动只有 0~250ms，多个并发请求会几乎同时重试，
                // 风控看来就是一串整齐的连发。改成 300~1200ms 随机，让重试节奏散开。
                const delay = retryDelay * Math.pow(2, attempt);
                attempt++;
                await sleep(delay + randomRange(300, 1200));
            }
        }
    }

    // 获取热搜词（支持多源自动切换）
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

    // Cookie 管理
    // 有些管理器（移动端 App、部分 iOS 扩展）不提供 GM_cookie，直接返回空串会让搜索和页面抓取
    // 全部失效却不说明原因。这里补一条兜底：同源页面时退回 document.cookie。
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
                // 个别实现不会回调，3 秒后按兜底处理，避免整个流程卡住
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
            /* 底部留出 iPhone 的 home 指示条 / 安卓手势区，否则球和面板会被系统栏压住 */
            bottom: calc(20px + env(safe-area-inset-bottom, 0px));
            right: calc(20px + env(safe-area-inset-right, 0px));
            z-index: 2147483647;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: #fff;
            border: 1px solid #e0e0e0;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            border-radius: 8px;
            /* 选中态共用的淡紫描边色：打卡列 + 它展开的详情区看起来是一组 */
            --mr-active-border: rgba(135, 100, 184, .55);
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

        /* 展开状态：小屏不超出可视宽度，内容超高时整块滚动，避免按钮被顶出屏幕 */
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
        }
        #mr-title { font-weight: 600; font-size: 14px; color: #333; }
        #mr-close { cursor: pointer; color: #999; font-size: 18px; line-height: 1; }
        #mr-close:hover { color: #333; }

        #mr-body { padding: 16px; }

        .mr-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 12px; color: #555; }
        .mr-val { font-weight: 600; color: #333; }

        /* 未登录 / 登录失效：醒目提示条，点击直接去登录 */
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

        /* 其他任务：每个任务一列，上方文字（周/月/限 + 进度），下方进度线条 */
        .mr-quest-grid { display: flex; gap: 6px; margin-bottom: 12px; }
        .mr-quest-col {
            flex: 1; min-width: 0; cursor: pointer;
            /* 所有列都留同样的内边距 + 透明边框占位，选中时只换颜色，布局不跳动 */
            padding: 2px 3px 3px; border-radius: 4px;
            border: 1px solid transparent;
            transition: border-color .15s ease, background .15s ease;
        }
        .mr-quest-label {
            font-size: 10px; line-height: 12px; color: #999; text-align: center;
            margin-bottom: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        /* 今天还能推进的任务：文字红色高亮（待办提醒） */
        .mr-quest-label.can { color: #d13438; font-weight: 600; }
        /* 全部完成：绿色，表示当天已了结 */
        .mr-quest-label.done { color: #107c41; }
        .mr-quest-track { height: 4px; background: #eee; border-radius: 2px; overflow: hidden; }
        .mr-quest-fill { height: 100%; background: #8764b8; border-radius: 2px; }
        .mr-quest-fill.done { background: #107c41; }
        /* 点击展开：选中列细描边 + 文字高亮，明确提示「刚点的是这一条」 */
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
        /* 行右侧：数值 + 「前往完成」跳转链接 */
        .mr-row-right { display: inline-flex; align-items: center; gap: 6px; }
        .mr-go {
            font-size: 10px; line-height: 14px; padding: 0 5px;
            border: 1px solid #8764b8; color: #8764b8; border-radius: 3px;
            text-decoration: none; white-space: nowrap; cursor: pointer;
            user-select: none;
        }
        .mr-go:hover { background: #8764b8; color: #fff; }
        .mr-go:active { transform: scale(.96); }
        /* 待领积分的「去领取」用橙红强调，和普通「前往完成」区分 */
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
    const panel = document.createElement('div');
    panel.id = 'mr-panel';
    panel.className = 'collapsed';
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
                    <span style="color:#d83b01"><span id="mr-sync" style="display:inline-block;margin-right:6px;padding:0 5px;border-radius:3px;background:#f3f2f1;color:#605e5c;font-size:10px;line-height:14px;font-weight:700;cursor:pointer;white-space:nowrap;vertical-align:middle;user-select:none" title="点击可立即强制同步一次">⟳ 同步中</span><span id="mr-points">0</span> pts</span>
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
    `;
    document.body.appendChild(panel);

    // 元素引用
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
    // 不用 toLocaleTimeString().slice(0,5)：12 小时制 locale 下会截成 "6:31 " 这种残缺时间
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

    // rewards.bing.com 是 Next.js 应用，hydration 时可能重建 body 子节点，把面板一起清掉；
    // 这里做幂等重挂，并提供菜单命令兜底（面板被隐藏/移除时也能重新调出来）
    const ensurePanel = () => {
        if (!document.body) return false;
        if (document.getElementById('mr-panel')) return false;
        document.body.appendChild(panel);
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
        });
    }

    // 点积分旁的同步徽章 → 立即强制同步一次（清掉页面缓存和失败负缓存，不受 60 秒轮询影响）
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
            log('🔄 手动强制同步…');
            // clearPageCache 会同时清掉页面缓存和失败负缓存，确保这次是真的重新抓
            try { clearPageCache(); } catch { }
            try {
                await updateData();
            } catch { /* updateData 内部已兜底 */ }
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

    // 授权相关
    const AUTH_URL = 'https://login.live.com/oauth20_authorize.srf?client_id=0000000040170455&scope=service::prod.rewardsplatform.microsoft.com::MBI_SSL&response_type=code&redirect_uri=https://login.live.com/oauth20_desktop.srf';

    nodes.btnAuthLink.onclick = () => window.open(AUTH_URL, '_blank');

    // 授权码兑换（手动保存 与 自动填充 共用同一套逻辑）
    let authRedeeming = false;
    const redeemAuthCode = async (code, { auto = false } = {}) => {
        GM_setValue('auth_code', code);
        GM_setValue('refresh_token', ''); // 清空旧 token，强制走 code 授权
        // 若已有进行中的 Token 请求，丢弃它，确保本次用新 code 重新兑换
        state.tokenPromise = null;
        log(auto ? '📥 已自动填入授权码，正在兑换...' : '✅ 授权码已保存，正在尝试获取 Token...');
        const token = await getAccessToken({ forceRefresh: true });
        if (token) {
            // 授权码是一次性的，兑换成功后清掉所有残留，避免下次误用
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
        // 1. 标准 URL：?code=xxx / &code=xxx / #code=xxx
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
        // 2. 直接粘贴裸授权码（不含 URL）
        if (!code && /^[A-Za-z0-9._\-]{20,}$/.test(val)) code = val;

        if (!code) {
            log('❌ 格式错误：未在URL中找到 code 参数，请复制完整的白屏网址');
            return;
        }
        nodes.boxAuth.style.display = 'none';
        nodes.inAuth.value = '';
        const ok = await redeemAuthCode(code);
        if (!ok) {
            // 兑换失败把内容留在输入框，方便直接重试
            nodes.inAuth.value = val;
            nodes.inAuth.focus();
        }
    };

    // ===== 授权码自动填充 =====
    // 登录页（login.live.com 等）捕获到 code 后会写入 GM 存储；回到 Bing / Rewards 标签页时
    // 这里自动把 code 回填到面板输入框并发起兑换，全程无需复制粘贴。
    let authAutoTried = false;
    async function tryAutoFillAuthCode() {
        if (authRedeeming || authAutoTried) return false;
        let code = '', ts = 0;
        try {
            code = GM_getValue('auth_code', '') || '';
            ts = Number(GM_getValue('auth_code_time', 0)) || 0;
        } catch (e) { }
        if (!code) return false;

        // 授权码有效期很短（约 10 分钟），过期的不再自动兑换，避免拿到必然失败的 code
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
            // 回填到输入框 + 展开授权区，让用户看得见"已自动填入"
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

    // 初始化后尝试一次（登录页刚捕获完立刻刷新回本页的场景）
    setTimeout(() => { tryAutoFillAuthCode(); }, 1000);
    // 从登录页切回本标签页时再尝试（不刷新页面的场景）
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            tryAutoFillAuthCode();
            // 从登录页切回来：确认是否已恢复登录
            if (state.needLogin) try { recoverFromLogin(); } catch { }
        }
    });
    window.addEventListener('focus', () => {
        tryAutoFillAuthCode();
        if (state.needLogin) try { recoverFromLogin(); } catch { }
    });
    updateAllButton();

    // 自动抓取微软 OAuth Code
    // 注意：这里刻意不用 gmRequest —— OAuth authorize 正常会 302 到 desktop.srf，
    // 我们要的正是跳转后的 finalUrl，而 gmRequest 把 3xx 当错误 reject。
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

    // ========== 核心逻辑 ==========

    async function updateData() {
        if (state.updatingPromise) return state.updatingPromise;
        state.updatingPromise = (async () => {
        try {
            // 等级 / 积分 / 搜索 / 阅读由 dapi 提供，直接走统一入口（每次拉最新并回写缓存，供同轮次要读取复用）。
            let dashData = null;
            try {
                const token = await getAccessToken();
                if (token) {
                    const parsed = await getDapiMe(token, currentRegion());
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

            // 空对象也算失败：dapi 兜底有时会返回一个没有 userProfile/balance/userStatus 的壳，
            // 以前会继续往下走，把等级显示成 1、积分显示成 0，看着像"数据正常但全零"
            if (!dashData || (!dashData.userProfile && !dashData.userStatus && dashData.balance == null)) {
                warnDataFail();
                return;
            }

            dashboard = dashData;

            // 1. 解析等级与积分（捕获 profile.attributes.level）
            const profile = dashData.userProfile || dashData.profile || {};
            const balance = dashData.balance;
            const userStatus = dashData.userStatus || dashData.status || {};

            // 账号地区：活动交卷 / dapi 上报都按它填 country，优先取服务端下发的区域
            state.country = String(userStatus.country || profile.country || dashData.country || state.country || 'cn').toLowerCase();

            if (typeof balance === 'number') {
                state.points = balance;
            } else if (balance && typeof balance === 'object') {
                state.points = balance.availablePoints ?? balance.points ?? 0;
            } else {
                state.points = profile.availablePoints ?? profile.points ?? dashData.availablePoints ?? 0;
            }

            //直接从 profile.attributes.level 获取新版等级代号（如 newLevel3）
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

            // 微软新版体系精准匹配（newLevel3 / Level3 / Gold = 金牌）
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
            const isLocalSigned = lastSignDate === today;

            let isRemoteSigned = false;

            // 宽松真值解析：兼容布尔/字符串 true / "1" / "True" 等。
            // 特意不叫 isTrueVal —— 文件后面还有一个全局同名、但语义更严格的实现（只认 true）。
            const looseTrueVal = (v) => {
                if (typeof v === 'boolean') return v === true;
                if (typeof v === 'number') return v !== 0;
                if (typeof v === 'string') {
                    const s = v.trim().toLowerCase();
                    return s === 'true' || s === '1' || s === 'yes' || s === 'claimed';
                }
                return false;
            };

            // A. 从签到活动卡片判断（放宽卡片匹配关键词 + 完成状态字段）
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

                // 完成状态：宽松解析多种字段来源
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

                // 只有明确完成，或存在有效进度且达到最大值，才算签到
                if (complete || (max > 0 && cur >= max)) {
                    isRemoteSigned = true;
                }
            }

            // B. 只接受明确的 claimedToday / 已领取状态
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

            // C. 本地记录只允许匹配“今天”
            state.checkedIn = isRemoteSigned || isLocalSigned;

            // D. 兜底：dashboard 无签到字段时，问 dapi 要签到卡的 last_updated 时间戳。
            //    dapi 的签到卡（Gamification_Sapphire_DailyCheckIn）的 progress/max/complete
            //    是累计快照（max=11760 等），不可用于判断"今天是否签到"；
            //    但 last_updated 是服务器在签到成功时才会更新的时间戳 —— 若它落在"今天"，
            //    即可判定今日已签到（跨设备/跨浏览器签到过也能识别）。
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
                                    // last_updated 多半是带时区的 ISO 时间，也可能是不带时区的时间串。
                                    // 必须换算成「本地日期」再和今天比：以前直接取 UTC 日期，
                                    // 北京时间 00:00–08:00 这段 UTC 还停在昨天，会把已签到判成未签到。
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
                    // dapi 补查失败不影响主流程
                }
            }

            // 5. 阅读任务与活动列表统计（优先用活动列表里的真实进度）
            const readPromo = allP.find(p => {
                if (!p || typeof p !== 'object') return false;
                const offerId = p.attributes?.offerid || p.offerid || '';
                return offerId === READ_OFFER_ID || offerId.toLowerCase().includes('readarticle');
            });

            if (readPromo && readPromo.attributes) {
                state.readCur = parseInt(readPromo.attributes.progress) || 0;
                state.readMax = parseInt(readPromo.attributes.max) || 30;
            } else {
                if (state.readCur === undefined) state.readCur = 0;
                if (state.readMax === undefined) state.readMax = 30;
            }

            // 活动进度统一用「积分」统计，只在活动任务执行时更新（见 runPromo），
            // 这里不再用卡片张数覆盖，避免出现 8/28（张）→ 35/35（分）的单位混用

            // 先更新同步时间戳再渲染，这样徽章的「上次成功同步 hh:mm」不会差一轮
            // 不再每轮打「✓ 数据已更新」：正常同步是常态，写日志只会把真正的问题淹掉。
            markSyncOk();
            render();

            // 可领取积分检测（函数内部 5 分钟节流，避免每次刷新都多拉一个页面）
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
    // 其他任务：同步「点击展开」的详情区（手机端无 hover，靠点击查看完整任务名）
    // 「前往完成」分工：行右侧按钮 → Rewards 活动总页；详情区内链接 → 当前这条任务的具体完成页
    const openUrl = (url) => {
        try { window.open(url, '_blank'); } catch (e) { location.href = url; }
    };

    // =====================================================================
    // 「去领取」直达入口
    // 官方领取弹窗可以用 query 直接唤起：/dashboard?modal=pointsclaim
    // 边界：只负责打开领取界面，绝不代用户提交领取（积分提交由人点）。
    // =====================================================================
    const CLAIM_URL = 'https://rewards.bing.com/dashboard?modal=pointsclaim';
    if (nodes.claimGo) {
        nodes.claimGo.onclick = (e) => {
            if (e) e.stopPropagation();
            // 始终新开标签：正在跑搜索/活动时点它，也不会把当前页的任务中断掉
            openUrl(CLAIM_URL);
        };
    }

    // 未登录提示条：点击直接去 rewards.bing.com 登录
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
                box.innerHTML = `[${t}] ${label} (${r.done || 0}/${r.total || 0})`
                    + `<span class="mr-quest-link" id="mr-quest-go">前往完成 →</span>`;
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

    // 其他任务行右侧「前往完成」：跳 Rewards 活动总页（具体某条任务走详情区里的链接）
    if (nodes.punchGo) {
        nodes.punchGo.onclick = (e) => {
            e.stopPropagation();
            openUrl(REWARDS.earn);
        };
    }

    function render() {
        if (!nodes.level) return;

        // 0. 未登录 / 数据读取失败提醒（点「去登录」直接跳 rewards.bing.com）
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

        // 1. 等级与积分（优先显示金牌/银牌名称）
        nodes.level.textContent = state.levelName || `Lv.${state.level}`;
        nodes.points.textContent = (state.points || 0).toLocaleString();
        // 积分新鲜度徽章：常驻显示，三态 —— 绿「已同步」/ 灰「同步中」/ 红「未同步」。
        if (nodes.sync) {
            const lastOk = state.syncAt || state.syncStartedAt || 0;
            const overdue = lastOk > 0 && Date.now() - lastOk > SYNC_STALE_MS;
            // 明确失败 / 超时未成功 / 未登录，都算未同步
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
            nodes.sync.title = bad || state.syncBusy || neverOk
                ? `${why}。${tail}点击可立即强制同步一次`
                : `${why}（${at}）。点击可立即强制同步一次`;
        }
        // 2. 搜索进度
        const pcCur = state.searchCur ?? state.pcCur ?? 0;
        const pcMax = state.searchMax ?? state.pcMax ?? 60;
        if (nodes.pc) nodes.pc.textContent = `${pcCur}/${pcMax}`;
        if (nodes.pcBar) nodes.pcBar.style.width = pcMax ? `${(pcCur / pcMax) * 100}%` : '0%';

        // 3. 签到状态
        if (nodes.signStatus) {
            nodes.signStatus.textContent = state.checkedIn ? '已签到' : '未签到';
            nodes.signStatus.style.color = state.checkedIn ? '#107c41' : '#d83b01';
        }

        // 4. 阅读任务
        const readCur = state.readCur ?? 0;
        const readMax = state.readMax ?? 30;
        if (nodes.read) nodes.read.textContent = `${readCur}/${readMax}`;
        if (nodes.readBar) nodes.readBar.style.width = readMax ? `${(readCur / readMax) * 100}%` : '0%';

        // 5. 月度 / 周度打卡任务：右侧数值 = 今天不用再管的列数 / 列总数
        //    今天还能推进的列 = 待办，不计数
        //    灰色列 = 今天做不了（含已全部完成）→ 当成已完成计数，所以分母始终是全部任务
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
                nodes.punch.title = `今天待办 ${todo} 个（绿色）· 不用管 ${settled} 个（已完成 + 今天做不了）· 共 ${list.length} 个`;
            }
        }
        // 5b. 其他任务：每列上方文字（周/月/限 + 进度），下方进度线；今天还能推进的文字高亮
        if (nodes.punchBar) {
            const list = state.quests || [];
            // render 每分钟至少一次，数据没变就别重建整块 DOM（选中态会闪、事件白绑一轮）。
            // 用自定义属性而不是 dataset，冒烟桩里的假 DOM 也能挂。
            const sig = JSON.stringify(list.map(r => [r.id, r.title, r.type, r.done, r.total, r.complete, r.canDo]));
            if (nodes.punchBar._mrSig !== sig) {
                nodes.punchBar._mrSig = sig;
                nodes.punchBar.innerHTML = '';
                const shortOf = (t) => (t === '每周' ? '周' : t === '月度' ? '月' : '限');
                list.forEach((r, i) => {
                    const done = r.done || 0;
                    const total = r.total || 0;
                    const complete = r.complete || (total > 0 && done >= total);
                    const t = r.type || questTypeOf(r.title, r.id).label;
                    const label = r.title || r.id || '';

                    const col = document.createElement('div');
                    col.className = 'mr-quest-col';
                    // 桌面端悬停看名称；手机端没有 hover，点击展开/收起完整名称
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

        // 6. 活动任务
        if (nodes.promo) {
            // 读不到账号数据时别显示 0/0（会让人以为"今天真没有活动"），与打卡区的「-」保持一致
            nodes.promo.textContent = (state.needLogin && !state.promosTotal)
                ? '-'
                : `${state.promosDone || 0}/${state.promosTotal || 0}`;
        }
        if (nodes.promoBar) {
            const done = state.promosDone || 0;
            const total = state.promosTotal || 0;
            nodes.promoBar.style.width = total ? `${Math.min(100, (done / total) * 100)}%` : '0%';
        }

        // 7. 可领取积分（检测到才显示该行）
        if (nodes.claim) {
            const amt = state.claimablePoints || 0;
            nodes.claim.style.display = amt > 0 ? 'flex' : 'none';
            if (nodes.claimAmt) nodes.claimAmt.textContent = amt.toLocaleString();
        }
    }

    // Token 获取
    // 未授权时 updateData 每分钟都会尝试一次拿 Token，日志按 10 分钟节流，避免整屏都是同一句
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
        // 负缓存：已经确认拿不到 Token（未授权 / 未登录）时，5 分钟内不再发请求，
        // 否则 updateData 每分钟都会去 login.live.com 试一次，白跑请求还写日志。
        // forceRefresh（用户点了授权 / 手动重试）会绕过这个限制。
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
                    
                    // 1. 尝试静默获取
                    let code = await checkAuth();
                    
                    // 2. 静默获取失败，检查是否有手动保存的 auth_code
                    if (!code) {
                        const savedCode = GM_getValue('auth_code', '');
                        if (savedCode) {
                            code = savedCode;
                            GM_setValue('auth_code', ''); // 授权码是一次性的，取出后立即清空
                            // 回填到面板输入框，让"自动填入"这一步对用户可见
                            try {
                                if (nodes.inAuth && !nodes.inAuth.value) nodes.inAuth.value = savedCode;
                                if (nodes.boxAuth) nodes.boxAuth.style.display = 'block';
                            } catch (e) { }
                            log('📥 已自动填入捕获的授权码，正在兑换...');
                        }
                    }

                    // 3. 仍然没有可用 code 时，弹出手动授权提示面板
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

                    // 拿到 Token 属于正常流程，不再单独打日志（每次刷新都会来一遍，只会刷屏）
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
            }
            state.tokenFailAt = Date.now();
            return null;
        })();

        state.tokenPromise = pending;
        // 只清「自己仍是当前在途请求」的情况：refresh_token 失效分支里会创建新的
        // tokenPromise，外层 finally 若无条件置 null，会把内层那个请求一起抹掉，
        // 于是后续并发调用会重复发起取 token 请求。
        pending.finally(() => {
            if (state.tokenPromise === pending) state.tokenPromise = null;
        }).catch(() => { });
        return pending;
    }
    // =========================================================================
    // 🧩 Rewards 新版站点通道（Next.js Server Action）
    // -------------------------------------------------------------------------
    // rewards.bing.com 已迁移到 Next.js App Router：活动交卷、积分领取、月度打卡都不再走旧接口
    // （/api/reportactivity + __RequestVerificationToken 已失效），而是 POST 到页面 URL 本身，
    // 并带上随站点每次部署都会变化的 `next-action` 标识。因此这里做四件事：
    //   ① 从站点 JS 分包里动态提取 action ID 并缓存（站点重新部署 404 时自动清缓存重取）；
    //   ② 优先用页面同源 fetch 提交（Origin/Cookie 天然正确，避免被风控判为扩展来源）；
    //   ③ 网页通道失败时退回 dapi APP 通道（type 101 + offerid，服务端即时记账且幂等）；
    //   ④ 交卷后复核服务端状态，避免"以为做完其实没记账"。
    // =========================================================================
    const REWARDS = {
        dash: 'https://rewards.bing.com/dashboard',
        earn: 'https://rewards.bing.com/earn',
        quest: 'https://rewards.bing.com/earn/quest/',
        actionFallback: '70babbc81d2724f60d29a95c03b3d739cba77cea92',
        claimFallback: '00491296f1d668ad46b65342c95cb9d72a62c1fa9d',
        cacheKey: 'mr_action_cache',
        questKey: 'mr_quest_state'
    };

    // 交卷 / 领取都是 POST，只有在 rewards.bing.com 页面内用同源 fetch 发出才会带上正确的
    // Sec-Fetch / Origin，跨站请求会被站点边缘层直接 503。这里生成统一的提示，避免用户误判为脚本 bug
    const isSameRewardsHost = () => typeof location !== 'undefined' && location.hostname === 'rewards.bing.com';
    const crossHostHint = () => isSameRewardsHost()
        ? ''
        : '（交卷/领取必须在 rewards.bing.com 页面内发出，当前页面是 ' + (typeof location !== 'undefined' ? location.hostname : '?') + '，请打开 rewards.bing.com 后再点）';

    const getTodayYmd = () => {
        const d = new Date();
        return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    };
    // 服务端要求 timezoneOffset，东八区为 "-480"
    const getTimezoneOffsetStr = () => String(new Date().getTimezoneOffset());

    // Next.js 路由状态树：缺少它 server action 会返回 404/500
    function getRouterStateTree(segment) {
        const flag = 4096;
        const tree = ['', {
            children: ['(nav)', {
                children: [segment, { children: ['PAGE', {}, null, null, flag] }, null, null, flag]
            }, null, null, flag]
        }, null, null, flag + 16];
        return encodeURIComponent(JSON.stringify(tree));
    }

    // 同源优先：页面本身就是 rewards.bing.com 时用页面 fetch —— Origin 与 Cookie 天然正确，
    // 不会被风控账号以"扩展来源"为由直接 500；跨站时退回 GM_xmlhttpRequest（带浏览器 Cookie）。
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
                // 明确的 HTTP 状态错误要交给上层判断（404 = 服务端标识过期），不能吞掉
                if (e && e.status) throw e;
                // 页面 fetch 被站点 CSP 或沙箱拦截时，退回 GM 请求继续
                return gmRequest({ method, url, headers, data: body, retries: options.retries ?? 1 });
            }
        }
        return gmRequest({ method, url, headers, data: body, retries: options.retries ?? 1 });
    }

    async function getRewardsHtml(url, ua) {
        // quest 详情页需要 Rewards 客户端 UA，服务端才会解锁「需在必应 App 完成」的子项；
        // 浏览器 fetch 不允许改写 UA，因此指定 UA 时固定走 GM 请求
        if (ua) return gmRequest({ method: 'GET', url, headers: { 'user-agent': ua }, retries: 1 });
        return siteFetch(url);
    }

    // —— 页面抓取健壮性：登录页 / 错误页识别 + 分层降级 ——
    // Rewards 在 cookie 失效、边缘风控、区域跳转时会返回登录页或极短的错误页，
    // 这类响应不能当成"今日没有活动"来解析，否则面板会静默清零。
    // judge() 已经先调过 detectLoginWall()，这里只补「短 JSON 错误体」这一种情况，
    function looksLikeLoginPage(html) {
        const s = String(html || '');
        if (!s) return true;
        return s.length < 4000 && /^\s*[\[{]/.test(s);
    }

    // 登录墙判定：只认登录页独有的特征，避免把正常页面里的「登录」链接误判成未登录。
    function detectLoginWall(html) {
        const s = String(html || '');
        if (!s) return false;
        // ① 内联脚本直接跳登录域名（未登录时 rewards 常见做法）
        if (/location\.(?:href|replace)\s*=\s*["'][^"']*login\.(?:live|microsoftonline|microsoft)\./i.test(s)) return true;
        // ② 登录表单特征：i0116 = MSA 邮箱输入框，loginfmt = 表单字段，loginHeader = 页头
        if (/id="i0116"|name="loginfmt"|id="loginHeader"/i.test(s)) return true;
        // ③ 登录页标题（正常 Rewards 页标题是 Microsoft Rewards，不会以 Sign in 开头）
        if (s.length < 200000 && /<title>\s*(?:Sign in|登录|登入|サインイン|로그인)/i.test(s)) return true;
        return false;
    }

    // —— 账号数据锚点 ——
    // 只靠「像不像登录页」判断不出未登录：实测未登录访 https://rewards.bing.com/
    // 返回的是 200 + 258KB 的「关于 – Microsoft Rewards」营销页，既没有 i0116/loginfmt，
    // 体积又远超 looksLikeLoginPage 的 4000 字节上限，于是被当成正常页接收 → 解析 0 条。
    // 登录后 dash 必有 dailySetItems、earn 必有 activityCards，这两类键才是可靠判据。
    // 注意别用 "balance": 当锚点：那张「关于」页里有个已登出的占位对象
    // {"balance":"$undefined","level":"$undefined"}，会把未登录误判成已登录（实测踩过）。
    const ACCOUNT_ANCHORS = {
        dash: ['"dailySetItems"', '"userStatus"', '"activityCards"', 'punchcard'],
        earn: ['"activityCards"', 'punchcard', '"dailySetItems"', '"userStatus"']
    };
    // 最近一次抓取结论：dash / earn 是并发抓的，一面成功一面失败时红条会每分钟闪一次。
    // 记录「谁最近失败了」，另一面成功时先别急着撤提醒；120 秒后视为过期，避免永远卡住。
    const lastSeen = { dash: { v: '', at: 0 }, earn: { v: '', at: 0 } };

    function hasAccountData(html, kind) {
        const s = String(html || '').replace(/\\"/g, '"');
        if (!s) return false;
        const anchors = ACCOUNT_ANCHORS[kind];
        if (!anchors) return true; // quest 详情页等不做判定，保持原行为
        return anchors.some(a => s.includes(a));
    }

    // 日志用：统计锚点出现次数，一眼区分「没登录」和「站点改版」
    function anchorStat(html) {
        const s = String(html || '').replace(/\\"/g, '"');
        const n = (k) => s.split(k).length - 1;
        return `dailySetItems:${n('"dailySetItems"')} activityCards:${n('"activityCards"')} userStatus:${n('"userStatus"')}`;
    }

    /**
     * 抓 Rewards 页面 HTML，按可靠性分层降级：
     *   ① 站内 fetch / 普通 GM 请求（正常路径）
     *   ② 显式带 UA + Cookie 的 GM 请求（跨站、风控、cookie 分区场景）
     *   ③ 当前页面就是这个地址时，直接读渲染后的 DOM（完全离线，救急用）
     * 返回 { html, from }，from 供日志与诊断定位。
     */
    // 页面 HTML 短缓存：初始化阶段 updateData / refreshPromoScore / readPunchcardProgress
    // 会连续抓同一批页面（dash、earn 各两次），45 秒内复用能省掉一半请求。
    const pageCache = new Map();
    const PAGE_CACHE_TTL = 45 * 1000;
    // 失败负缓存：未登录时 dash 会回 258KB 的营销页，一轮刷新里 dash/earn 各被抓好几次，
    // 没有负缓存会重复下载几百 KB。60 秒内直接复用失败结论。
    const failCache = new Map();
    const FAIL_CACHE_TTL = 60 * 1000;
    const clearPageCache = () => { pageCache.clear(); failCache.clear(); };

    // 同一页面的并发抓取合并成一个请求：refreshPromoScore / readPunchcardProgress /
    // recoverFromLogin 会在同一瞬间抓 earn 页，缓存还没写入就各自发一遍。
    // force（诊断用）不复用在途请求，保证拿到的是新抓的页面。
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
        // 只有 dashboard / earn 两个主页面参与「是否未登录」判定；
        // quest 详情页走 App UA，偶发风控也会吐登录页，不能据此判定账号未登录
        const isMain = target === REWARDS.dash || target === REWARDS.earn;
        const kind = target === REWARDS.dash ? 'dash' : (target === REWARDS.earn ? 'earn' : '');
        let loginWall = false;
        let noData = false;
        // ua 参与键：quest 详情页带 Rewards 客户端 UA 才会解锁子项，内容与普通 UA 不同
        const cacheKey = target + '|' + (ua || '');
        if (!opts.force) {
            const hit = pageCache.get(cacheKey);
            if (hit && hit.html && Date.now() - hit.at < PAGE_CACHE_TTL) {
                return { html: hit.html, from: hit.from + '+cache' };
            }
            const neg = failCache.get(cacheKey);
            if (neg && Date.now() - neg.at < FAIL_CACHE_TTL) {
                // 命中负缓存也要把提醒重新点亮，否则登录提示会被这 60 秒的空窗吞掉；
                // reason='struct' 是"页面结构问题、登录正常"，不能拿去点红条
                if (isMain && neg.reason !== 'struct') markNeedLogin(target, neg.reason);
                return { html: '', from: 'none+cache', login: isMain && neg.reason !== 'struct' };
            }
        }
        // 主页面这次真的拿到了内容 → 说明登录态正常，撤掉提醒
        const ok = (html, from) => {
            if (isMain) { lastSeen[kind] = { v: 'ok', at: Date.now() }; clearNeedLogin(kind); }
            failCache.delete(cacheKey);
            if (html) pageCache.set(cacheKey, { at: Date.now(), html, from });
            return { html, from };
        };
        // 判定一层抓取结果：必须「不是登录页」且「含账号数据」才算成功。
        // 只看前者会漏掉未登录时返回的那张 200 + 258KB「关于」营销页。
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
            // 另一面主页面刚拿到账号数据 → 登录态没问题，这次只是本页结构/区域差异。
            // 这种时候亮红条会变成"永远亮着但数据其实好的"误报，只记日志。
            const other = kind === 'dash' ? 'earn' : 'dash';
            const o = lastSeen[other];
            const otherOk = o && o.v === 'ok' && Date.now() - o.at < 120 * 1000;
            const structural = !loginWall && otherOk;
            // 'struct' 不参与"别撤提醒"的判定（那是登录问题的信号，这是站点改版）
            lastSeen[kind] = { v: structural ? 'struct' : 'fail', at: Date.now() };
            if (structural) {
                warnStructure(kind);
                failCache.set(cacheKey, { at: Date.now(), reason: 'struct' });
            } else {
                // loginWall=拿到登录页；noData=拿到 200 页面但没有账号数据（多为 rewards 会话未建立）
                markNeedLogin(target, loginWall ? '' : 'session');
                // 只缓存"有明确结论"的失败；纯网络错误不缓存，下次还要重试
                failCache.set(cacheKey, { at: Date.now(), reason: loginWall ? '' : 'session' });
            }
        }
        return { html: '', from: 'none', login: loginWall || noData };
    }

    // —— 未登录提醒 ——
    // 抓到登录页时：面板顶部点亮提示条 + 日志说明一次（恢复前不重复刷屏）
    let loginWarnAt = 0;
    // 结论只允许往上细化：blocked（笼统读取失败）→ dash/earn（拿到登录页）→ session（读不到账号数据）。
    // 反方向不覆盖，避免"更具体的原因"被"读取失败"顶掉。
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
            // 典型场景：Bing 已登录（等级/积分/搜索都正常），但从没打开过 rewards.bing.com，
            // 站点返回的是「关于 Microsoft Rewards」营销页，没有 dailySetItems/activityCards
            log('🔐 已登录 Bing，但读不到 rewards.bing.com 的账号数据（会话未建立，或站点改版）：活动 / 打卡 / 可领取积分取不到数据');
            log('💡 点面板上的「去登录 →」打开一次 https://rewards.bing.com 完成登录；回到本页后会自动重新拉取');
            return;
        }
        log('🔐 未登录 Microsoft Rewards（或登录已失效），活动 / 打卡 / 可领取积分取不到数据');
        log('💡 点面板上的「去登录 →」，或手动打开 https://rewards.bing.com 登录；回到本页后脚本会自动重新拉取');
    }
    function clearNeedLogin(kind) {
        if (!state.needLogin) return;
        // 另一面主页面最近一次是失败（120 秒内）时先别撤提醒：
        // dash / earn 是并发抓的，一面成功一面失败会让红条每分钟闪一次
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
    // 积分数字左侧常驻徽章：绿「✓ 已同步」/ 灰「⟳ 同步中」/ 红「⚠ 未同步」，点一下强制同步。
    // render 由调用方负责，避免一轮画两次。
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

    // 连页面都抓不到（网络 / CORS / 风控）时的兜底提醒：连续两轮才点亮，避免一次抖动就报警
    let pageFailStreak = 0;
    function markDataBlocked() {
        if (state.needLogin) return;
        state.needLogin = true;
        state.loginReason = 'blocked';
        render();
        log('⚠️ 连续两次读取 Rewards 页面失败（未登录 / 登录失效 / 风控 / 网络）');
        log('💡 点面板上的「去登录 →」确认一下，登录成功并回到本页后会自动恢复');
    }

    // 抓取失败提示做节流：同一地址 10 分钟内只提示一次，避免每分钟刷屏
    const fetchWarnAt = {};
    function warnFetchFail(label, url) {
        // 登录提示已经亮着时不再重复喊「获取失败」：同一个原因的两种说法只会刷屏
        if (state.needLogin) return;
        const key = label || url;
        const now = Date.now();
        if (fetchWarnAt[key] && now - fetchWarnAt[key] < 10 * 60 * 1000) return;
        fetchWarnAt[key] = now;
        log(`⚠️ ${label}数据获取失败（可能是登录态/风控/网络问题），已保留上次结果，稍后会自动重试`);
        log('💡 若一直为空：先在浏览器打开 https://rewards.bing.com 确认已登录，再点「🔍 导出 Rewards 诊断日志」反馈');
        console.warn('[Rewards] fetch fail:', label, url);
    }

    // updateData 每分钟跑一次：彻底取不到数据时按 10 分钟节流提示，避免挂机刷屏
    let dataFailWarnAt = 0;
    function warnDataFail() {
        // 这一轮没拿到有效的 dash 数据 → 积分停在旧值，面板上亮 ⚠
        markSyncStale('读不到 Rewards 数据');
        const now = Date.now();
        if (now - dataFailWarnAt < 10 * 60 * 1000) return;
        dataFailWarnAt = now;
        log('❌ 获取数据失败，请确认已登录 rewards.bing.com');
        log('💡 若一直失败：先打开 https://rewards.bing.com 登录，再回到本页（脚本会自动重拉）');
    }

    // 页面抓到了但解析为空（容器名/结构变化）时的提示，同样节流
    const parseWarnAt = {};
    function warnParseEmpty(label, detail) {
        const now = Date.now();
        if (parseWarnAt[label] && now - parseWarnAt[label] < 30 * 60 * 1000) return;
        parseWarnAt[label] = now;
        // detail 带上锚点计数：全 0 = 拿到的根本不是登录后的页面；有值却不解析 = 站点改版
        log(`🟡 ${label}：页面已取到但没解析出条目（可能是站点结构变化或今天确实没有任务）${detail ? `｜锚点 ${detail}` : ''}`);
    }

    // 页面没账号数据、但另一面主页正常 → 登录态没问题，多半是站点改版。只提示一次。
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
            // 扩展发起的请求既没有站点同源 Origin，也没有页面 fetch 的 Sec-Fetch-*，
            // 站点边缘层会直接 503；这里把浏览器真实发出的同源头一并补齐再试
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

    // 从页面引用的 JS 分包中提取 server action 标识映射表。
    // 微软每次重新部署都会换掉这些 ID，硬编码必然失效，所以按需扫描并缓存（键为构建号）。
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
        // 缓存命中且构建号未变化（或页面里解析不到构建号）时直接复用，避免每次点击都扫一遍分包
        if (cached && (!build || build === cached.build)) {
            return { ids: cached.ids, dpl: cached.dpl || dpl };
        }

        const chunks = new Set();
        const chunkRe = /(?:\/_next\/)?(static\/(?:chunks|immutable|media)\/[\w\-./()]+?\.js)/g;
        let m;
        while ((m = chunkRe.exec(combined)) !== null) chunks.add('/_next/' + m[1]);
        // webpack 运行时清单里按需加载的动态分包（领取组件等不在首屏分包里）
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
        // 历史领取分包兜底：新版清单无法枚举时，CDN 上仍保留旧分包
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

    // 括号配平提取数组：不依赖 "discovery" 之类固定锚点，字段顺序变化也能解析
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

    // 站点数据里的布尔值偶尔会以字符串形式出现（"true"/"false"），统一按语义判断
    const isTrueVal = (v) => v === true || String(v).toLowerCase() === 'true';
    const isFalseVal = (v) => v === false || String(v).toLowerCase() === 'false';

    // 锁定卡判定：isLocked / isUnlocked 是结构化字段，优先采信；
    // 字段缺失时才退回 unlockCriteria 与 offerId 模式（Moreactivities_RewardsApp 只能 App 内完成）
    function isLockedCard(card) {
        if (!card) return false;
        if (isFalseVal(card.isLocked) && isTrueVal(card.isUnlocked)) return false;
        if (isTrueVal(card.isLocked) || isFalseVal(card.isUnlocked)) return true;
        // unlockCriteria 只在明确要求「App / 安装」时才算锁定：
        // newLevelN 这类等级门槛改用 offerId 里的 locked_levelN 精确判断，
        // 否则会把本该能做的日常任务误判成锁定而跳过
        const crit = typeof card.unlockCriteria === 'string' ? card.unlockCriteria : '';
        return /app|install|mobile/i.test(crit) ||
            /Moreactivities_RewardsApp/i.test(card.offerId || card.name || '');
    }

    // 活动资格：offerId 里常见 locked_levelN（需要对应等级会员才能完成），等级不够就别提交，
    // 否则静默失败还会被误记为完成
    function requiredLevelOf(id) {
        const m = String(id || '').match(/locked_level(\d+)/i);
        return m ? parseInt(m[1], 10) : 0;
    }
    function lacksLevel(id) {
        const need = requiredLevelOf(id);
        return need > 0 && need > (state.level || 1);
    }

    // 按 offerId 反查所在的 JSON 对象：站点容器名会变（dailySetItems / dailySetPromotions / cards…），
    // 靠括号配平从任意容器里取出整张卡片，作为结构化解析的兜底
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
            // 回扫设上限，但要留足余量：offerId 未必是对象第一个字段，卡片里常带长描述/长图片 URL，
            // 起点可能离它几 KB。上限取 32KB —— 正常卡片（几百字节）几十个字符就找到起点，成本不变；
            // 只有真找不到起点时才会多扫，仍是有界计算，不会回到"每个 offerId 扫回文件头"的卡死。
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

    // 汇总「今日待办活动」：dashboard 的 dailySetItems（手机端每日活动）+ earn 的 activityCards（电脑端 / 周常）
    function collectPromoTasks(dashHtml, earnHtml) {
        const todayNum = Number(getTodayYmd());
        const tasks = [];
        const seen = new Set();
        const stat = { dashDone: 0, dashTotal: 0, earnDone: 0, earnTotal: 0, locked: 0, lockedPoints: 0, levelLocked: 0, levelLockedPoints: 0, noHash: 0, skippedQuest: 0, earnParseFailed: false };
        const dayEn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()];
        // 周常 / 月常卡片：过期或已完成的没必要再交卷（offerId 里带周次、月份、日期标记）
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
            // 解析不出日期时不跳过，避免误杀今日活动
            const itemDate = normalizeDate(item.date);
            if (itemDate !== null && itemDate !== todayNum) continue;
            seen.add(id);
            stat.dashTotal += points;
            if (isTrueVal(item.isCompleted)) {
                stat.dashDone += points;
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
            // 月度 / 周度打卡是"父任务"，子项由「📋 打卡」模块逐日交卷，这里不碰
            if (/punchcard/i.test(id)) {
                seen.add(id);
                stat.skippedQuest++;
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
            tasks.push({ id, title: card.title || card.name || card.description || id, hash: card.hash || '', url: REWARDS.earn, points, type: 'earn' });
        }

        // 兜底：容器名会随改版变化（dailySetItems / dailySetPromotions / cards…），
        // 按 offerId 反查整张卡片，把结构化解析没覆盖到的日常任务也纳入计划
        const addGeneric = (html, type, url) => {
            if (!html) return;
            for (const card of extractCardsByOfferId(html)) {
                const id = card.offerId;
                const points = Number(card.points) || 0;
                if (!points || !id || seen.has(id)) continue;
                // Discovery_* 是首页各分区的说明卡（Achievements/Redeem/…），不是可交卷任务
                if (/^Discovery_/i.test(id)) continue;
                if (/punchcard/i.test(id)) continue;
                // 可交卷活动一定带 hash；没有 hash 的多为展示型卡片，提交必然无效
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
                tasks.push({ id, title: card.title || card.name || card.description || id, hash: card.hash || '', url, points, type });
            }
        };
        addGeneric(dashHtml, 'dash', REWARDS.dash);
        addGeneric(earnHtml, 'earn', REWARDS.earn);
        return { tasks, stat };
    }

    // ---- 月度 / 周度打卡（Quest）----
    // earn 页「任务」板块的 quest 分三类：月度、周度（每周一换新 ID）、限时活动。
    // pcchild 型 quest 的每个子项绑定一个日历日，服务端按自然日解锁、错过即永久作废，
    // 所以一次只推进"当前已解锁且未完成"的第一个子项；多天累计型（无子项）只能如实显示进度。
    function parseQuestIds(html) {
        const clean = String(html || '').replace(/\\"/g, '"');
        const ids = [];
        let m;
        const reOffer = /"offerId":"([^"]*punchcard[^"]*)"/g;
        while ((m = reOffer.exec(clean)) !== null) {
            if (!ids.includes(m[1])) ids.push(m[1]);
        }
        // 兜底：从详情页链接里取（限时活动等 offerId 不一定带 punchcard 字样）。
        // flight 数据里的链接会被转义成 \/earn\/quest\/...，因此斜杠前的反斜杠要允许出现
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

    // 从 quest 详情页提取可读标题，用于面板「其他任务」区分不同打卡活动
    function parseQuestTitle(html) {
        const clean = String(html || '');
        const unescaped = clean.replace(/\\"/g, '"');

        // 判断是否为 Next.js 内部元数据/组件名（要跳过）
        const isInternal = (s) => {
            if (!s) return true;
            const t = s.trim();
            return /^\{|^\[|^http|^\/|^Next\.|MetadataOutlet|^rewards$/i.test(t);
        };

        // 优先用 <title> 标签：Next.js 页面通常渲染为「活动名 - Microsoft Rewards」
        const titleTag = clean.match(/<title[^>]*>([^<]{2,80})<\/title>/i);
        if (titleTag) {
            const t = titleTag[1].trim();
            const stripped = t.replace(/\s*[-|–—]\s*Microsoft\s*Rewards\s*$/i, '').replace(/\s*[-|–—]\s*必应\s*Rewards\s*$/i, '').trim();
            if (stripped && !isInternal(stripped)) return stripped;
        }

        // 遍历所有 title/name/displayName 字段，跳过内部元数据，取第一个"像真实标题"的
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

    // 根据标题/offerId 判断打卡活动类型：每周 / 月度 / 限时
    const questTypeOf = (title, id) => {
        const s = `${title || ''} ${id || ''}`.toLowerCase();
        if (/每周|weekly|weeklyset|weekly_set/.test(s)) return { tag: '🗓', label: '每周' };
        // 含中文月份或英文月份名/数字月 → 月度
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

    // ---- dapi APP 通道（阅读 / 签到 / 打卡 / 活动兜底 同一条链路）----
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
        // force=true 用于「上报后复核」，必须绕过缓存；其余场合复用同一轮的响应
        const data = await getDapiMe(token, region, !force);
        return data?.response?.promotions || null;
    }

    // 新版网页端不再下发 dailySetItems 时，每日打卡只在必应 APP 可见：
    // 走 dapi 的 Gamification_DailySet_<区域>_<日期>_ChildN 项，用 type 101 + offerid 即时记账
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
            // 复核：以服务端进度为准（稍等一拍再查，避免刚上报就回查拿到旧值）
            await sleep(randomRange(3000, 6000));
            // 上报后复核必须强制刷新，不能吃 30 秒缓存，否则拿到的还是上报前的旧值
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

    // 阅读（按钮兼作停止键：再点一次置 readRunning=false，本篇结束后退出循环）
    const runRead = async () => {
    nodes.btnRead.textContent = '⏹ 停止阅读';
    state.readRunning = true;
    markBusy(1);
    await waitWhilePaused();
    log('⏳ 开始阅读任务...');

    const region = currentRegion();

    try {
        // 2. 获取当前真实阅读进度
        const info = await withAccessTokenRequest(token => getDapiMe(token, region));

        if (info) {
            const d = typeof info === 'string' ? JSON.parse(info) : info;
            const p = d.response?.promotions?.find(x => x.attributes?.offerid === READ_OFFER_ID);

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
                    // 连续未记账计数：dapi 一直返回"没加分"时不要死循环重发
                    let readFailStreak = 0;
                    while (cur < max) {
                        // readRunning 只由本任务自己维护：按钮再点一次即可停止，
                        // 不再混进恒为 true 的 allRunning（旧判定永远不成立）。
                        if (!state.readRunning) break;

                        await waitWhilePaused();
                        currentArticleIdx++;
                        log(`📖 正在阅读第 ${currentArticleIdx}/${totalArticles} 篇文章 (进度: ${cur}/${max})...`);

                        const res = await withAccessTokenRequest(token => dapiActivity(token, {
                            type: 101,
                            attributes: { offerid: READ_OFFER_ID },
                            region
                        })).catch(() => null);

                        // 只有服务端明确记账（p > 0）才算这一篇成功。
                        // 以前这里只看 "有没有响应"：dapi 返回 2xx 但 code≠0 / isDuplicate / 0 分时
                        // 也被记成「🎉 阅读成功 +3」，进度和总积分都会虚高。
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
                            // 服务端说这篇已经记过账：本地推进一格，避免同一篇无限重发
                            cur = Math.min(max, cur + step);
                            state.readCur = cur;
                            render();
                            readFailStreak = 0;
                            log(`ℹ️ 第 ${currentArticleIdx}/${totalArticles} 篇已在此前完成（+0 分），继续下一篇`);
                        } else {
                            // 没记账：本地不推进，连续失败就停，避免白跑
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
        // 手动触发时以页面此刻的真实状态为准，不吃 45 秒缓存
        clearPageCache();
        try {
            const region = currentRegion();
            const accessToken = await getAccessToken();

            // 1) 新版站点的活动数据就在页面 HTML 的 flight 数据里，直接取 dashboard + earn
            let dashHtml = '', earnHtml = '';
            try {
                dashHtml = (await fetchRewardsPage(REWARDS.dash)).html;
            } catch (e) {
                log('⚠️ dashboard 页面获取失败：' + e.message);
            }
            // 两个主页面挨着抓太整齐（真实浏览是一页看完再点下一页）
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
            // 单页失败时明确提示，避免"活动数变成 0"被误读为今日没有任务
            if (!dashHtml) log('🟡 dashboard 未取到，仅按 earn 页统计');
            if (!earnHtml) log('🟡 earn 未取到，仅按 dashboard 统计');

            // 2) 解析今日未完成活动（自动排除 App 锁定卡、非今日任务与打卡父任务）
            const { tasks, stat } = collectPromoTasks(dashHtml, earnHtml);
            state.promosDone = stat.dashDone + stat.earnDone;
            state.promosTotal = stat.dashTotal + stat.earnTotal;
            render();
            if (stat.earnParseFailed) log('🟡 earn 页面活动结构异常，未能解析活动卡片');
            // 一行结论：跳过原因合并，避免逐条刷屏
            const skipped = [];
            if (stat.locked > 0) skipped.push(`${stat.locked} 个需 App 解锁`);
            if (stat.levelLocked > 0) skipped.push(`${stat.levelLocked} 个等级不足`);
            if (stat.skippedQuest > 0) skipped.push(`${stat.skippedQuest} 个打卡任务`);
            if (stat.noHash > 0) skipped.push(`${stat.noHash} 个无交卷标识`);
            log(`🎯 活动：待做 ${tasks.length} 个${skipped.length ? `，已跳过 ${skipped.join('、')}` : ''}`);

            let okCount = 0, failCount = 0, appGained = 0, skipRest = 0;
            if (tasks.length) {
                let actionInfo = await getRewardsAction([dashHtml, earnHtml]);
                let channelDown = false;
                for (let i = 0; i < tasks.length; i++) {
                    if (channelDown) { skipRest++; continue; }
                    await waitWhilePaused();
                    const task = tasks[i];
                    const taskLabel = `(${i + 1}/${tasks.length}) ${task.title || task.id}`;
                    let posted = false;
                    let taskGained = 0;
                    let lastWebErr = null;
                    // 通道一：网页 server action（同源 fetch 优先）
                    for (let attempt = 1; attempt <= 2 && !posted; attempt++) {
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
                            // 服务端回执里带 "p":N 时以它为准：0 分 = 没记账（多半资格不足），不能算成功
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
                                // 回执是网页而不是 flight 数据：多半被重定向到登录页了，
                                // 以前这种"有响应"会被当成交卷成功，但服务端根本没记账
                                const err = new Error('交卷被重定向到登录页（未记账）');
                                err.taskLevel = true;
                                lastWebErr = err;
                            } else {
                                posted = true;
                            }
                        } catch (e) {
                            lastWebErr = e;
                            if (e.status === 404) {
                                // 站点重新部署换了 action 标识：清缓存重取后再试一次
                                clearActionCache();
                                actionInfo = await getRewardsAction([dashHtml, earnHtml]);
                                continue;
                            }
                            if (attempt < 2) await sleep(randomRange(3000, 6000));
                        }
                    }
                    // 通道二：dapi APP 通道兜底（幂等、即时记账、不校验 Origin）
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
                    } else {
                        failCount++;
                        const e = lastWebErr;
                        log(`❌ ${taskLabel} 失败${e ? `：${e.message}` : ''}`);
                        // 通道级故障（网络错误 / 5xx）只提示一次并停止重试；单条 0 分不算通道故障
                        const channelLevel = !e || (!e.taskLevel && (!e.status || e.status >= 502));
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

            // 最终完整汇总：成功 / 失败 / 跳过 全部一次说清
            const skipTotal = stat.locked + stat.levelLocked + stat.skippedQuest + stat.noHash + skipRest;
            const skipParts = [];
            if (stat.locked > 0) skipParts.push(`${stat.locked} 个需 App 解锁`);
            if (stat.levelLocked > 0) skipParts.push(`${stat.levelLocked} 个等级不足`);
            if (stat.skippedQuest > 0) skipParts.push(`${stat.skippedQuest} 个打卡任务`);
            if (stat.noHash > 0) skipParts.push(`${stat.noHash} 个无交卷标识`);
            if (skipRest > 0) skipParts.push(`${skipRest} 个因通道中断跳过`);
            const donePoints = stat.dashDone + stat.earnDone;
            log(`🏁 活动全部完成：成功 ${okCount} 个，失败 ${failCount} 个，跳过 ${skipTotal} 个`
                + `${skipParts.length ? `（${skipParts.join('、')}）` : ''}`
                + `，到账积分 ${donePoints}/${stat.dashTotal + stat.earnTotal}${appGained ? `（本次 +${appGained}）` : ''}`);

            // 3) 新版网页端不再下发每日任务数据时（只给 App），走 dapi APP 通道补做每日打卡
            const hasWebDailySet = /"dailySetItems":\[\{/.test(String(dashHtml).replace(/\\"/g, '"'));
            if (!hasWebDailySet && accessToken) await runAppDailySet(accessToken, region);

            await updateData();
            // 活动进度统一按积分统计；持久化到当天，刷新页面后数字保持一致
            state.promosDone = stat.dashDone + stat.earnDone;
            state.promosTotal = stat.dashTotal + stat.earnTotal;
            savePromoScore();
            render();
            // 活动做完后可能产生新的可领取积分，强制检测一次（不阻塞主流程）
            checkClaimablePoints(null, true);
        } catch (e) {
            console.error('[Rewards] 活动任务异常:', e);
            log('❌ 活动执行出错：' + e.message);
        } finally {
            nodes.btnPromo.disabled = false;
            markBusy(-1);
        }
    };

    // 主动计算一次活动积分（面板初始化时用，避免必须点「活动」才有数字）
    const refreshPromoScore = async () => {
        try {
            const [dashRes, earnRes] = await Promise.all([
                fetchRewardsPage(REWARDS.dash).catch(() => ({ html: '', from: 'none' })),
                fetchRewardsPage(REWARDS.earn).catch(() => ({ html: '', from: 'none' }))
            ]);
            const dashHtml = dashRes.html, earnHtml = earnRes.html;
            if (!dashHtml && !earnHtml) {
                // 抓不到页面时不要把进度清零，保留上次结果并提示一次；
                // 已经亮着登录提示时不再重复喊「获取失败」，同一个原因喊两遍只会刷屏
                if (!state.needLogin) {
                    warnFetchFail('活动', REWARDS.earn);
                    pageFailStreak++;
                    if (pageFailStreak >= 2) markDataBlocked();
                }
                return;
            }
            pageFailStreak = 0;
            const { stat } = collectPromoTasks(dashHtml, earnHtml);
            const done = stat.dashDone + stat.earnDone;
            const total = stat.dashTotal + stat.earnTotal;
            if (!total) {
                // 页面拿到了却一个活动都解析不出来：多是站点结构变化或账号当天确实无活动
                warnParseEmpty('活动', anchorStat(dashHtml) + ' / ' + anchorStat(earnHtml));
                if (state.promosTotal > 0) return; // 有旧值时保留，避免面板被清零
            }
            state.promosDone = done;
            state.promosTotal = total;
            savePromoScore();
            render();
            // 复用刚拉到的 dashboard HTML 顺带检测可领取积分，省一次请求
            checkClaimablePoints(dashHtml, true);
        } catch { }
    };

    // 用户去登录后切回本页面：自动重拉一次缺的数据，不必等 1 分钟轮询或手动点按钮
    let lastLoginRecoverAt = 0;
    async function recoverFromLogin() {
        const now = Date.now();
        if (now - lastLoginRecoverAt < 30 * 1000) return;
        lastLoginRecoverAt = now;
        clearPageCache();
        // 只有确实在等登录恢复时才吭声，平时切标签页回来属于正常刷新，不必打日志
        if (state.needLogin) log('🔄 页面重新可见，正在确认登录状态…');
        // 串行执行：前一步抓到的 dash / earn 会进 45 秒缓存，后两步直接复用。
        try {
            await refreshPromoScore();
            await readPunchcardProgress();
            await updateData();
        } catch { }
    }

    // 可领取积分：dashboard 页出现「可领取」元素时，在面板显示待领积分并每天通知一次
    // html 传入则直接解析（省一次请求）；force=true 跳过 5 分钟节流
    // 解析支持三种来源：alt 文案（多语言）、pointClaim JSON、dapi dashboard 对象
    function detectClaimableAmount(html) {
        const s = String(html || '');
        // 1) 图片/文字 alt：中文「可领取」、英文 Claim/Redeem、日文/韩文等常见写法
        const altRe = /alt="(?:可领取|可領取|领取|領取|Claim|Redeem|Claim points|引き換え|受け取る|청구|수령|수집)[^"]*"[^>]*>[\s\S]{0,300}?(\d[\d,]*)/i;
        let m = s.match(altRe);
        if (m) return parseInt(m[1].replace(/,/g, ''), 10) || 0;
        // 2) flight 数据里的 pointClaim 结构
        m = s.match(/"pointClaim"\s*:\s*\{[^{}]{0,200}?"(?:points|amount|value|total|max)"\s*:\s*"?(\d+)/i);
        if (m) return parseInt(m[1], 10) || 0;
        // 3) 扁平字段
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
            // HTML 里没找到时，退回 dapi 下发的 dashboard 字段（部分区域页面不渲染该卡片）
            if (!amount) amount = claimableFromDashboard();
            const prev = state.claimablePoints || 0;
            state.claimablePoints = amount;
            // 首屏 updateData / refreshPromoScore / 兜底会各调一次，数值没变就不必重绘
            if (amount !== prev) render();
            if (amount > prev) {
                log(`🎁 发现 ${amount} 积分待领取，点「去领取」直达领取面板`);
                // 系统通知每天只弹一次，避免刷屏
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

    // 月度 / 周度 / 限时打卡：只读进度用于面板展示，不提交任何任务
    const readPunchcardProgress = async () => {
        if (state.punchcardRunning) return;
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
                // 已有缓存时保留：解析出 0 条多半是站点改版或拿到风控页，
                // 不能把它当成"今天没有打卡任务"而把面板清空（活动和这里保持同一策略）
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
                // 放在循环开头（而不是末尾），这样中途 continue 也不会漏掉间隔。
                // 打卡详情页是逐个抓的，太快等于一秒点开好几页；0.8–2 秒接近真人翻页。
                if (qi > 0) await sleep(randomRange(800, 2000));
                const questId = questIds[qi];
                const questUrl = REWARDS.quest + encodeURIComponent(questId);
                const { html } = await fetchRewardsPage(questUrl, CONFIG.ua.rewardsApp).catch(() => ({ html: '' }));
                const prev = prevList.find(r => r && r.id === questId);
                if (!html) {
                    // 单条详情页抓取失败：沿用上次已知进度，避免整列变成 0/0
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
                    // 页面拿到了但进度没解析出来（结构变化）：保留旧值
                    results.push({ ...prev, title, type: type.label, tag: type.tag });
                    continue;
                }
                // 今天能否继续推进：存在未完成且未锁定/未禁用的子项
                // 无子项（多天累计型）无法判断，标记为 null，渲染时按普通色处理
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

    nodes.btnPromo.onclick = runPromo;

    // ===== 诊断：把页面结构、卡片资格、打卡子项、action 标识压成几十行输出到控制台 =====
    // 用法：脚本管理器菜单 →「🔍 导出 Rewards 诊断日志」，然后 F12 控制台搜 MR-DIAG 复制发回
    async function runDiagnostics() {
        const out = [];
        const add = (s) => out.push(s);
        add(`v${APP_VERSION} level=${state.level} country=${state.country} today=${getTodayYmd()}`);
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
                if (c.points == null || !c.offerId) continue;
                add(`  ${tag} ${c.offerId} p=${c.points} done=${c.isCompleted} lock=${c.isLocked} unl=${c.isUnlocked} lvl=${requiredLevelOf(c.offerId)} date=${c.date || '-'} hash=${c.hash ? 'y' : 'n'} crit=${typeof c.unlockCriteria === 'string' ? c.unlockCriteria.slice(0, 24) : '-'}`);
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
        add('claim=' + (ci > -1 ? (dash + earn).slice(ci, ci + 60).replace(/\s+/g, ' ') : 'notfound'));
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

        // 搜索前先同步一次最新数据；一键执行里上一步刚同步过（只隔 5–12 秒）就不重复拉
        if (!state.syncAt || Date.now() - state.syncAt > 30000) await updateData();

        // 延时跟着环境走：手机慢一点，电脑快一点
        const envDelay = ENV_MOBILE ? CONFIG.mobile : CONFIG.pc;

        // 站点 = 当前页面所在域名（cn.bing.com / www.bing.com）；UA = 运行环境（手机/电脑）
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

                // 结果页校验：被重定向到登录 / 验证页时页面里没有结果容器，
                // 这种情况下后面的上报一定是白发的，不能算一次成功搜索
                const body = String(searchResult || '');
                const looksResults = /id="b_results"|class="b_results"|id="sb_form_q"|class="b_algo"/.test(body);
                // 关键：正常搜索页头部本来就带「登录」入口（login.live.com / account.live.com），
                // 未登录 Bing 时几乎必然出现，甚至 <link rel="dns-prefetch"> 里也有。
                // 所以「页面里出现登录域名」不能当重定向依据 —— 只要拿到了结果容器就是正常结果页。
                const looksLogin = !looksResults &&
                    /login\.live\.com|account\.live\.com|id="i0116"|<title>\s*(?:Sign in|登录)/i.test(body);
                const igMatch = body.match(/,IG:"([^"]+)"/) || body.match(/"IG":"([^"]+)"/);
                if (looksLogin) throw new Error('结果页被重定向到登录页，请先登录 rewards.bing.com');
                if (!igMatch && !looksResults) throw new Error('未取到有效搜索结果页');
                const ig = igMatch ? igMatch[1] : crypto.randomUUID().replace(/-/g, '').toUpperCase();

                // 2. 使用微软 Rewards 专用侧边栏/头部埋点上报积分
                const reportHeaders = {
                    'User-Agent': ua,
                    'Cookie': cookie,
                    'Referer': searchUrl,
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
                };

                // 真实浏览器是「结果页渲染完 → 停一会 → 再发埋点」，三个请求连发太整齐。
                // 这里插两段几百毫秒的随机间隔，节奏更像人手搜索。
                await sleep(randomRange(400, 1200));

                // 辅助埋点：失败不影响计数，静默跳过
                await gmRequest({
                    method: 'POST',
                    url: `https://${host}/rewardsapp/ncheader?ver=88888888&IID=SERP.5047&IG=${ig}&ajaxreq=1`,
                    headers: reportHeaders,
                    data: 'wb=1%3bi%3d1%3bv%3d1'
                }).catch(() => {});

                await sleep(randomRange(700, 1800));

                // 主上报接口：真正决定这一搜有没有被计入，抛错则不算进度
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

            // 打一位小数：20.4 秒和 27.9 秒一眼能看出间隔是随机的
            const secs = ms / 1000;
            const tail = label ? `（${label}）` : '';
            if (secs > 60) {
                log(`⏳ 等待中，预计需要 ${(secs / 60).toFixed(1)} 分钟${tail}...`);
            } else if (secs >= 1) {
                log(`⏳ 等待 ${secs.toFixed(1)} 秒${tail}...`);
            }

            while (Date.now() < endTime && state.running) {
                if (state.manualPaused) {
                    // 手动暂停多久，就把结束时间顺延多久
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

        // 动态判定搜索进度 (合并后的总搜索任务)
        if (state.searchCur < state.searchMax) {
            log(`💻 开始执行通用搜索，当前进度: ${state.searchCur}/${state.searchMax}`);
            let searchIndex = 0;
            // 容错：达到预估上限后，若服务器真实进度仍未满，允许再补搜（最多 2 轮）
            let recheckCount = 0;
            // 连续失败计数：结果页异常 / 上报被拒时不计进度，连续多次直接停，避免空跑
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
                    // 失败通常不是节奏问题，短等再试即可，不必等完整搜索间隔。
                    // 这里单独打「失败重试」并在日志里带小数秒，方便确认每次间隔都不同（不是固定值）
                    await preciseWait(randomRange(12000, 25000), '失败重试');
                    continue;
                }
                failStreak = 0;

                // 只有结果页有效、主上报被接受，才推进本地进度（+3 分/次）
                state.searchCur = Math.min(state.searchMax, state.searchCur + 3);
                render();
                await checkPause();
                if (!state.running) break;
                await preciseWait(randomRange(envDelay.minDelay, envDelay.maxDelay), '下一次搜索');

                // 降低更新频率，每 5 次搜索同步一次数据，避免进度丢失
                if (searchIndex % 5 === 0) {
                    log(`🔄 已完成 ${searchIndex} 次搜索，同步一次数据...`);
                    await updateData();
                }

                // 达到预估上限后，再检查服务器真实进度
                if (state.searchCur >= state.searchMax) {
                    if (searchIndex % 5 !== 0) {
                        log(`🔄 搜索达到预估上限，最后同步一次数据...`);
                        await updateData();
                    }

                    // 同步真实进度后，若仍未满，进入容错补搜
                    if (state.searchCur < state.searchMax) {
                        recheckCount++;
                        if (recheckCount > 2) {
                            log(`🛑 已达到预估上限且连续 ${recheckCount} 次同步仍未完成，停止搜索 (${state.searchCur}/${state.searchMax})`);
                            break;
                        }
                        log(`🔁 预估已满但真实进度未满 (${state.searchCur}/${state.searchMax})，第 ${recheckCount} 次补搜...`);
                        // 用真实进度重估上限，避免再次卡在旧预估值上
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
            // 任务之间留随机间隔，避免四个任务首尾相接、请求时间戳过于整齐
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
    // Init
    (async () => {
        try {
            // 回显今日已检查过的打卡进度，避免刷新页面后进度栏空白
            state.quests = loadQuestState();
            // 活动进度同样回显当天缓存（单位：积分）
            try {
                const ps = JSON.parse(GM_getValue('mr_promo_score', '') || 'null');
                if (ps && ps.date === getTodayYmd()) {
                    state.promosDone = ps.done || 0;
                    state.promosTotal = ps.total || 0;
                }
            } catch { }
            render();
            await updateData();
            // 当天还没有统计结果时，初始化阶段主动算一次，面板不再显示 0/0。
            // 顺序执行 + 小间隔，后一次能命中缓存，总请求数更少。
            if (!state.promosTotal) {
                await refreshPromoScore();
                await sleep(randomRange(800, 2000));
            }
            await readPunchcardProgress();

            // 阅读进度补查走统一入口，复用同轮 dapi/me 响应，不重复发请求。
            try {
                const token = await getAccessToken();
                if (token) {
                    const d = await getDapiMe(token, currentRegion(), true);
                    const p = d?.response?.promotions?.find(x => x.attributes?.offerid === READ_OFFER_ID);
                    if (p && p.attributes) {
                        state.readCur = parseInt(p.attributes.progress) || 0;
                        state.readMax = parseInt(p.attributes.max) || 30;
                        render();
                    }
                }
            } catch { }
        } catch { }
        const hour = new Date().getHours();

        if (hour >= 0 && hour < 8) {
            log('⚠️ 当前时间 00:00-08:00，Rewards 每日任务可能尚未刷新');
            log('💡 建议北京时间 08:00 后运行脚本，避免任务进度显示异常');
        }
        log(`🌟 脚本就绪 v${APP_VERSION}`);
    })();

    // 数据轮询 / 徽章兜底 / 缺数据自动恢复合并成一个 60 秒 tick，减少唤醒次数。
    let lastRecoverAt = 0;
    setInterval(() => {
        // ① 数据轮询；② 徽章兜底放在它的 finally 里，用的是本轮更新后的 syncAt，更准
        updateData().finally(() => {
            if (state.needLogin || state.syncBusy) return;
            const lastOk = state.syncAt || state.syncStartedAt || 0;
            if (lastOk && Date.now() - lastOk > SYNC_STALE_MS) render();
        });

        // ③ 首屏没拿到活动 / 打卡 / 可领取积分时，每 5 分钟补拉一次
        const now = Date.now();
        if (now - lastRecoverAt >= 5 * 60 * 1000) {
            lastRecoverAt = now;
            const needPromo = !state.promosTotal;
            const needQuest = !(state.quests || []).length;
            const needClaim = state.claimablePoints == null;
            if (needPromo) refreshPromoScore();
            if (needQuest) readPunchcardProgress();
            if (needClaim) checkClaimablePoints(null, true);
        }
    }, 60000);

})();
