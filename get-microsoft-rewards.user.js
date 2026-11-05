// ==UserScript==
// @name         Get Microsoft Rewards (修复/增强版)
// @namespace    https://github.com/Muverix/Get-Microsoft-Rewards
// @version      1.4.0
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
    // 但只在下列站点构建面板，其它页面直接返回
    const HOST_SUPPORTED = ['rewards.bing.com', 'www.bing.com', 'cn.bing.com', 'rewards.microsoft.com', 'login.live.com'];
    if (!HOST_SUPPORTED.includes(window.location.hostname)) return;

    /* =========================================================================
     * 登录页「授权码自动捕获」
     * -------------------------------------------------------------------------
     * 在 login.live.com / login.microsoftonline.com 上不注入 Rewards 面板，
     * 只负责把跳转后网址里的 code 自动存进脚本存储，并给出提示页。
     * 回到 Bing / Rewards 标签页后，tryAutoFillAuthCode() 会自动回填并兑换，
     * 全程无需复制粘贴。
     * ========================================================================= */
    if (/^(login\.(live|microsoftonline)\.com|account\.live\.com)$/i.test(location.hostname)) {
        initOAuthCapturePage();
        return;
    }

    function initOAuthCapturePage() {
        const href = location.href;
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

        // 极简提示页（白底深字，亮色浏览器下清晰）
        const box = document.createElement('div');
        box.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:min(360px,92vw);box-sizing:border-box;background:#fff;color:#222;border:1px solid #e0e0e0;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.15);padding:20px;font:14px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;z-index:2147483647;text-align:center;';

        if (code) {
            box.innerHTML = `
                <div style="font-size:34px;line-height:1">✅</div>
                <div style="font-weight:700;font-size:16px;margin:8px 0 6px">授权码已自动获取</div>
                <div style="color:#666;font-size:13px">现在可以关闭本页，回到 Bing 标签页。<br>脚本会自动填充授权码并完成兑换。</div>
                <div style="margin:12px 0;padding:8px;background:#fafafa;border:1px solid #eee;border-radius:6px;font:11px/1.5 monospace;color:#888;word-break:break-all">${code.slice(0, 24)}…</div>
                <div style="display:flex;gap:8px;margin-top:12px">
                    <button id="mr-cap-copy" style="flex:1;min-height:42px;border:1px solid #d0d0d0;background:#fff;color:#333;border-radius:6px;font-size:14px">📋 复制授权码</button>
                    <button id="mr-cap-close" style="flex:1;min-height:42px;border:none;background:#0078d4;color:#fff;border-radius:6px;font-size:14px">关闭本页</button>
                </div>
            `;
        } else {
            const e1 = errM ? errM[1] : '未知错误';
            let e2 = '';
            try { e2 = errDesc ? decodeURIComponent(errDesc[1].replace(/\+/g, ' ')) : ''; } catch (e) { e2 = errDesc ? errDesc[1] : ''; }
            box.innerHTML = `
                <div style="font-size:34px;line-height:1">⚠️</div>
                <div style="font-weight:700;font-size:16px;margin:8px 0 6px">授权被取消或失败</div>
                <div style="color:#666;font-size:13px;word-break:break-all">${e1}${e2 ? '<br>' + e2 : ''}</div>
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
        pc: { minDelay: 15000, maxDelay: 30000 },
        mobile: { minDelay: 20000, maxDelay: 35000 },
        ua: {
            pc: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36 Edg/157.0.0.0',
            mobile: 'Mozilla/5.0 (Linux; Android 16; MEIZU 20 Build/BQ2A.251110.001-BP2A.250605.031.A3; ) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/150.0.7871.181 Mobile Safari/537.36 BingSapphire/34.3.441014006',
            rewardsApp: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36 Edg/153.0.0.0 MSRewards/Desktop/1.3.0'
        },
        mobileApi: {appId: 'SAAndroid/34.3.441014006'},
        read: { minDelay: 8000, maxDelay: 15000 },
        // 多个热搜API备用源
        hotApis: [
            { url: 'https://hot.baiwumm.com/api/', sources: ['weibo', 'douyin', 'baidu', 'zhihu', 'toutiao'] },
            { url: 'https://hotapi.nntool.cc/', sources: ['weibo', 'douyin', 'baidu', 'toutiao', 'zhihu'] },
            { url: 'https://cnxiaobai.com/DailyHotApi/', sources: ['weibo', 'douyin', 'baidu', 'toutiao'] }
        ],
        keywords: ["天气预报", "今日新闻", "体育赛事", "股票行情", "电影推荐", "科技资讯", "美食食谱", "旅游攻略"],
        // 暂停机制配置
        pause: {
        enabled: true,
        interval: 10,
        // 每次暂停时随机 3-10 分钟
        duration: () => (3 + Math.random() * 7) * 60 * 1000
    }
    };

    // ========== 状态 ==========
    let state = {
        level: 1, points: 0,
        readRunning: false,
        pcCur: 0, pcMax: 0,
        mobileCur: 0, mobileMax: 0,
        promosTotal: 0, promosDone: 0,
        signDone: false, signPoints: -1,
        readCur: 0, readMax: 0,
        running: false,
        busyCount: 0, // 👈 补上此初始化
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
        pauseResolver: null,
        // 新增：区域、月度打卡进度、领取状态
        country: '',
        quests: [],
        questDetailIdx: -1,   // 其他任务：当前点击展开的任务下标（-1 = 未展开）
        claimRunning: false,
        punchcardRunning: false,
        needLogin: false,     // 抓到登录页 → 提示用户去登录 rewards.bing.com
        loginReason: ''       // 触发提醒的来源（dash / earn / quest），仅用于提示文案
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
        if (data.date === getDateHyphen()) {
            state.searchCount = data.searchCount || 0;
            return data;
        } else {
            resetProgress(); // 👈 跨天重置本地和内存中的计数
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

                //console.log('[Rewards] Cookie长度:', str.length, url);
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
        .mr-quest-col { flex: 1; min-width: 0; }
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
        /* 点击展开：选中列高亮 + 下方任务名详情（手机端无 hover 时靠点击查看） */
        .mr-quest-col { cursor: pointer; }
        .mr-quest-col.active .mr-quest-label { color: #8764b8; font-weight: 700; }
        .mr-quest-detail {
            font-size: 10px; line-height: 14px; color: #555;
            background: #f5f3fa; border-radius: 3px; padding: 4px 6px;
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

                <!-- 未登录提醒（检测到登录页才显示） -->
                <div id="mr-login-tip" style="display:none">
                    <span id="mr-login-msg">🔐 未登录 Microsoft Rewards，活动/打卡/可领取积分将取不到数据</span>
                    <span class="mr-login-go">去登录 →</span>
                </div>

                <!-- 可领取积分（检测到才显示） -->
                <div class="mr-row" id="mr-claim" style="display:none">
                    <span>🎁 可领取积分</span>
                    <span id="mr-claim-amt" style="font-weight:600;color:#d83b01">0</span>
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
    const log = (msg) => {
        const div = document.createElement('div');
        div.textContent = `[${new Date().toLocaleTimeString().slice(0, 5)}] ${msg}`;
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
    async function checkAuth() {
        // return null;//test
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
                                'content-type': 'application/json; charset=UTF-8',
                                'user-agent': CONFIG.ua.mobile,
                                'authorization': `Bearer ${token}`,
                                'x-rewards-appid': CONFIG.mobileApi.appId,
                                'x-rewards-ismobile': 'true',
                                'x-rewards-country': 'cn',
                                'x-rewards-language': 'zh',
                                'x-rewards-partnerid': 'startapp',
                                'x-rewards-flights': 'rwgobig'
                            }
                        });
                        const parsed = JSON.parse(dapiRes);
                        dashData = parsed.response?.dashboard || parsed.response || parsed;
                    }
                } catch (e) {
                    console.error('[Rewards] DAPI 请求错误:', {
                        status: e?.status,
                        message: e?.message,
                        responseText: e?.responseText,
                        finalUrl: e?.finalUrl
                    });

                    console.error(
                        '[Rewards] DAPI 401 Response:',
                        e?.responseText || '(empty)'
                    );
                }
            }

            if (!dashData) {
                log('❌ 获取数据失败，请确认已登录 rewards.bing.com');
                return;
            }

            dashboard = dashData;

            // =========================================================================
            // 1. 解析等级与积分（捕获 profile.attributes.level）
            // =========================================================================
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

            // 🔍 控制台确认日志
            //console.log('[Rewards 最终等级匹配]: 捕获到等级代号 ->', rawLevelStr);

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

            // 宽松真值解析：兼容布尔/字符串 true / "1" / "True" 等
            const isTrueVal = (v) => {
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
                    isTrueVal(checkInPromo.complete) ||
                    isTrueVal(checkInPromo.completed) ||
                    isTrueVal(checkInPromo.isCompleted) ||
                    isTrueVal(attrs.complete) ||
                    isTrueVal(attrs.completed) ||
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
                        isTrueVal(dashData?.claimedToday) ||
                        isTrueVal(dashData?.userStatus?.claimedToday) ||
                        isTrueVal(dashData?.status?.claimedToday) ||
                        isTrueVal(dashData?.userStatus?.claimed) ||
                        isTrueVal(dashData?.claimed);
                
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
                        const dapiPromos = await getDapiPromotions(dapiToken, state.country || 'cn');
                        if (Array.isArray(dapiPromos)) {
                            const oidOf = p => ((p?.attributes?.offerid || p?.offerId || p?.id || '') + '').toLowerCase();
                            const signCard = dapiPromos.find(p => oidOf(p) === 'gamification_sapphire_dailycheckin')
                                || dapiPromos.find(p => oidOf(p).includes('sapphire') && (oidOf(p).includes('checkin') || oidOf(p).includes('signin')));
                            if (signCard) {
                                const lu = signCard.attributes?.last_updated || signCard.last_updated || '';
                                if (lu) {
                                    // last_updated 是 ISO 时间（含时区），取日期部分与"今天"比对
                                    const luDate = String(lu).slice(0, 10); // YYYY-MM-DD
                                    const todayIso = new Date().toISOString().slice(0, 10);
                                    if (luDate === todayIso) {
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

            // 活动进度统一用「积分」统计，只在活动任务执行时更新（见 runPromo），
            // 这里不再用卡片张数覆盖，避免出现 8/28（张）→ 35/35（分）的单位混用

            render();
            const newStatus = `${state.level}-${state.points}-${state.searchCur}-${state.searchMax}`;
            if (state.lastStatus !== newStatus) {
                log(`✓ 数据已更新: Lv.${state.level} ${state.points}pts`);
                state.lastStatus = newStatus;
            }

            // 可领取积分检测（函数内部 5 分钟节流，避免每次刷新都多拉一个页面）
            checkClaimablePoints();
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
    // 其他任务：同步「点击展开」的详情区（手机端无 hover，靠点击查看完整任务名）
    // 「前往完成」分工：行右侧按钮 → Rewards 活动总页；详情区内链接 → 当前这条任务的具体完成页
    const openUrl = (url) => {
        try { window.open(url, '_blank'); } catch (e) { location.href = url; }
    };

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
        // 选中列高亮
        if (nodes.punchBar) {
            [...nodes.punchBar.children].forEach((c, i) => c.classList.toggle('active', i === idx));
        }
        // 行右侧「前往完成」始终指向活动总页，标题固定
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
                    : '🔐 未登录 Microsoft Rewards，活动 / 打卡 / 可领取积分取不到数据';
            }
        }

        // 1. 等级与积分（优先显示金牌/银牌名称）
        nodes.level.textContent = state.levelName || `Lv.${state.level}`;
        nodes.points.textContent = (state.points || 0).toLocaleString();
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
        //    绿色列 = 今天还能做但没做完 → 算"待办"，不计数
        //    灰色列 = 今天做不了（含已全部完成）→ 当成已完成计数，所以分母始终是全部任务
        if (nodes.punch) {
            const list = state.quests || [];
            const isDone = (r) => r.complete || (r.total > 0 && (r.done || 0) >= r.total);
            if (!list.length) {
                nodes.punch.textContent = '-';
                nodes.punch.title = '';
            } else {
                const todo = list.filter(r => !isDone(r) && r.canDo === true).length; // 绿色：今天待办
                const settled = list.length - todo;                                  // 已完成 + 今天做不了
                nodes.punch.textContent = `${settled}/${list.length}`;
                nodes.punch.title = `今天待办 ${todo} 个（绿色）· 不用管 ${settled} 个（已完成 + 今天做不了）· 共 ${list.length} 个`;
            }
        }
        // 5b. 其他任务：每列上方文字（周/月/限 + 进度），下方进度线；今天还能推进的文字绿色
        if (nodes.punchBar) {
            const list = state.quests || [];
            const shortOf = (t) => (t === '每周' ? '周' : t === '月度' ? '月' : '限');
            nodes.punchBar.innerHTML = '';
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
            syncQuestDetail();
        }

        // 6. 活动任务
        if (nodes.promo) {
            nodes.promo.textContent = `${state.promosDone || 0}/${state.promosTotal || 0}`;
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

                let refreshToken = GM_getValue('refresh_token', '');//test
                let body = '';

                if (refreshToken) {
                    body = `client_id=0000000040170455&refresh_token=${encodeURIComponent(refreshToken)}&scope=service::prod.rewardsplatform.microsoft.com::MBI_SSL&grant_type=REFRESH_TOKEN`;
                } else {
                    log('🔑 正在获取微软活动 Token...');
                    
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
                        log('⚠️ 静默授权失败，请点击面板中的“获取授权码”链接手动授权');
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
                    state.accessTokenExpiresAt =
                        Date.now() + (Number(data.expires_in) || 3600) * 1000;

                    if (data.refresh_token) {
                        GM_setValue('refresh_token', data.refresh_token);
                    }

                    log('🔑 活动 Token 建立成功');
                    // 走 code 授权成功：清掉面板里的授权码残留，避免重复使用一次性 code
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
            } finally {
                state.tokenPromise = null;
            }
            return null;
        })();

        return state.tokenPromise;
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
    function looksLikeLoginPage(html) {
        const s = String(html || '');
        if (!s) return true;
        if (s.length < 4000) {
            if (detectLoginWall(s)) return true;
            if (/^\s*[\[{]/.test(s)) return true; // 纯 JSON 错误体（如 401 响应）
        }
        return false;
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

    /**
     * 抓 Rewards 页面 HTML，按可靠性分层降级：
     *   ① 站内 fetch / 普通 GM 请求（正常路径）
     *   ② 显式带 UA + Cookie 的 GM 请求（跨站、风控、cookie 分区场景）
     *   ③ 当前页面就是这个地址时，直接读渲染后的 DOM（完全离线，救急用）
     * 返回 { html, from }，from 供日志与诊断定位。
     */
    async function fetchRewardsPage(url, ua) {
        const target = String(url || '').split('?')[0].replace(/\/+$/, '');
        // 只有 dashboard / earn 两个主页面参与「是否未登录」判定；
        // quest 详情页走 App UA，偶发风控也会吐登录页，不能据此判定账号未登录
        const isMain = target === REWARDS.dash || target === REWARDS.earn;
        let loginWall = false;
        // 主页面这次真的拿到了内容 → 说明登录态正常，撤掉提醒
        const ok = (html, from) => {
            if (isMain) clearNeedLogin();
            return { html, from };
        };

        try {
            const html = await getRewardsHtml(url, ua);
            if (detectLoginWall(html)) loginWall = true;
            else if (!looksLikeLoginPage(html)) return ok(html, 'fetch');
        } catch (e) { /* 继续降级 */ }

        try {
            const cookie = await getCookies('https://rewards.bing.com').catch(() => '');
            const headers = {
                'user-agent': ua || CONFIG.ua.pc,
                referer: 'https://rewards.bing.com/'
            };
            if (cookie) headers.cookie = cookie;
            const html = await gmRequest({ method: 'GET', url, headers, retries: 1 }).catch(() => '');
            if (detectLoginWall(html)) loginWall = true;
            else if (!looksLikeLoginPage(html)) return ok(html, 'gm');
        } catch (e) { /* 继续降级 */ }

        try {
            const cur = (location.origin + location.pathname).replace(/\/+$/, '');
            if (cur === target) {
                const dom = document.documentElement?.outerHTML || '';
                if (detectLoginWall(dom)) loginWall = true;
                else if (!looksLikeLoginPage(dom)) return ok(dom, 'dom');
            }
        } catch (e) { /* ignore */ }

        if (isMain && loginWall) markNeedLogin(target);
        return { html: '', from: 'none', login: loginWall };
    }

    // —— 未登录提醒 ——
    // 抓到登录页时：面板顶部点亮提示条 + 日志说明一次（恢复前不重复刷屏）
    let loginWarnAt = 0;
    function markNeedLogin(target) {
        if (state.needLogin) return; // 已经亮着，不重复刷日志 / 重绘
        state.needLogin = true;
        state.loginReason = target === REWARDS.earn ? 'earn' : 'dash';
        render();
        const now = Date.now();
        if (now - loginWarnAt < 10 * 60 * 1000) return;
        loginWarnAt = now;
        log('🔐 未登录 Microsoft Rewards（或登录已失效），活动 / 打卡 / 可领取积分取不到数据');
        log('💡 点面板上的「去登录 →」，或手动打开 https://rewards.bing.com 登录；回到本页后脚本会自动重新拉取');
    }
    function clearNeedLogin() {
        if (!state.needLogin) return;
        state.needLogin = false;
        state.loginReason = '';
        pageFailStreak = 0;
        render();
        log('✅ 登录状态已恢复，数据重新同步中');
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
        const key = label || url;
        const now = Date.now();
        if (fetchWarnAt[key] && now - fetchWarnAt[key] < 10 * 60 * 1000) return;
        fetchWarnAt[key] = now;
        log(`⚠️ ${label}数据获取失败（可能是登录态/风控/网络问题），已保留上次结果，稍后会自动重试`);
        log('💡 若一直为空：先在浏览器打开 https://rewards.bing.com 确认已登录，再点「🔍 导出 Rewards 诊断日志」反馈');
        console.warn('[Rewards] fetch fail:', label, url);
    }

    // 页面抓到了但解析为空（容器名/结构变化）时的提示，同样节流
    const parseWarnAt = {};
    function warnParseEmpty(label) {
        const now = Date.now();
        if (parseWarnAt[label] && now - parseWarnAt[label] < 30 * 60 * 1000) return;
        parseWarnAt[label] = now;
        log(`🟡 ${label}：页面已取到但没解析出条目（可能是站点结构变化或今天确实没有任务）`);
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
            for (let i = idx; i >= 0; i--) {
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
            url: 'https://prod.rewardsplatform.microsoft.com/dapi/me/activities',
            headers: {
                'content-type': 'application/json; charset=UTF-8',
                'user-agent': CONFIG.ua.mobile,
                'authorization': `Bearer ${token}`,
                'x-rewards-appid': CONFIG.mobileApi.appId,
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
                type,
                channel: 'SAAndroid',
                attributes
            })
        });
        return typeof res === 'string' ? JSON.parse(res) : res;
    }

    async function getDapiPromotions(token, region) {
        const res = await gmRequest({
            url: 'https://prod.rewardsplatform.microsoft.com/dapi/me?channel=SAAndroid&options=613',
            headers: {
                'content-type': 'application/json; charset=UTF-8',
                'user-agent': CONFIG.ua.mobile,
                'authorization': `Bearer ${token}`,
                'x-rewards-appid': CONFIG.mobileApi.appId,
                'x-rewards-ismobile': 'true',
                'x-rewards-country': region,
                'x-rewards-language': 'zh',
                'x-rewards-partnerid': 'startapp',
                'x-rewards-flights': 'rwgobig'
            }
        });
        const data = typeof res === 'string' ? JSON.parse(res) : res;
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
                if (i < pending.length - 1) await sleep(randomRange(2500, 5000));
            }
            // 复核：以服务端进度为准
            await sleep(4000);
            const after = await getDapiPromotions(token, region);
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

    //签到
    const runSign = async () => {
        nodes.btnSign.disabled = true;
        markBusy(1);
        await waitWhilePaused();
        log('⏳ 正在尝试 App 移动端签到...');

        const region = (state.country || dashboard?.userStatus?.country || 'cn').toLowerCase();

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
                    'user-agent': CONFIG.ua.mobile,
                    'authorization': `Bearer ${token}`,
                    'x-rewards-appid': CONFIG.mobileApi.appId,
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
    state.readRunning = true;
    markBusy(1);
    await waitWhilePaused();
    log('⏳ 开始阅读任务...');

    const region = (state.country || dashboard?.userStatus?.country || 'cn').toLowerCase();
    const readOfferId = 'ENUS_readarticle3_30points';

    try {
        // 2. 获取当前真实阅读进度
        const info = await withAccessTokenRequest(token => gmRequest({
            url: 'https://prod.rewardsplatform.microsoft.com/dapi/me?channel=SAAndroid&options=613',
            headers: {
                'authorization': `Bearer ${token}`,
                'user-agent': CONFIG.ua.mobile,
                'x-rewards-appid': CONFIG.mobileApi.appId,
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
                    while (cur < max) {
                       // 方式一：改用已有的运行状态判定
                        if (!state.readRunning && !state.allRunning) break;

                        await waitWhilePaused();
                        currentArticleIdx++;
                        log(`📖 正在阅读第 ${currentArticleIdx}/${totalArticles} 篇文章 (进度: ${cur}/${max})...`);

                        const res = await withAccessTokenRequest(token => gmRequest({
                            method: 'POST',
                            url: 'https://prod.rewardsplatform.microsoft.com/dapi/me/activities',
                            headers: {
                                'content-type': 'application/json; charset=utf-8',
                                'user-agent': CONFIG.ua.mobile,
                                'authorization': `Bearer ${token}`,
                                'x-rewards-appid': CONFIG.mobileApi.appId,
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
                            // 👈 优化：使用 CONFIG 中的随机时间，并打印休眠日志
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
    state.readRunning = false;
    nodes.btnRead.disabled = false;
    markBusy(-1);
    }
};

nodes.btnRead.onclick = runRead;

    const runPromo = async () => {
        nodes.btnPromo.disabled = true;
        markBusy(1);
        await waitWhilePaused();
        log('⏳ 开始执行活动任务...');
        try {
            const region = (state.country || dashboard?.userStatus?.country || 'cn').toLowerCase();
            const accessToken = await getAccessToken();

            // 1) 新版站点的活动数据就在页面 HTML 的 flight 数据里，直接取 dashboard + earn
            let dashHtml = '', earnHtml = '';
            try {
                dashHtml = (await fetchRewardsPage(REWARDS.dash)).html;
            } catch (e) {
                log('⚠️ dashboard 页面获取失败：' + e.message);
            }
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
            await readPunchcardProgress();
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
                            if (attempt < 2) await sleep(randomRange(1800, 3500));
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
                    if (!channelDown && i < tasks.length - 1) await sleep(randomRange(2500, 5000));
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
            try {
                GM_setValue('mr_promo_score', JSON.stringify({ date: getTodayYmd(), done: state.promosDone, total: state.promosTotal }));
            } catch { }
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
                // 抓不到页面时不要把进度清零，保留上次结果并提示一次
                warnFetchFail('活动', REWARDS.earn);
                pageFailStreak++;
                if (pageFailStreak >= 2) markDataBlocked();
                return;
            }
            pageFailStreak = 0;
            const { stat } = collectPromoTasks(dashHtml, earnHtml);
            const done = stat.dashDone + stat.earnDone;
            const total = stat.dashTotal + stat.earnTotal;
            if (!total) {
                // 页面拿到了却一个活动都解析不出来：多是站点结构变化或账号当天确实无活动
                warnParseEmpty('活动');
                if (state.promosTotal > 0) return; // 有旧值时保留，避免面板被清零
            }
            state.promosDone = done;
            state.promosTotal = total;
            try {
                GM_setValue('mr_promo_score', JSON.stringify({ date: getTodayYmd(), done: state.promosDone, total: state.promosTotal }));
            } catch { }
            render();
            // 复用刚拉到的 dashboard HTML 顺带检测可领取积分，省一次请求
            checkClaimablePoints(dashHtml, true);
        } catch { }
    };

    // 用户去登录后切回本页面：自动重拉一次缺的数据，不必等 1 分钟轮询或手动点按钮
    let lastLoginRecoverAt = 0;
    function recoverFromLogin() {
        const now = Date.now();
        if (now - lastLoginRecoverAt < 30 * 1000) return;
        lastLoginRecoverAt = now;
        log('🔄 检测到页面重新可见，正在确认登录状态…');
        refreshPromoScore();
        readPunchcardProgress().catch(() => { });
        updateData().catch(() => { });
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
            render();
            if (amount > prev) {
                log(`🎁 发现 ${amount} 积分待领取，请打开 Rewards 页面手动领取`);
                // 系统通知每天只弹一次，避免刷屏（沿用旧版 Config.claimNoticeDate 方案）
                try {
                    if (typeof GM_notification === 'function' && GM_getValue('Config.claimNoticeDate', 0) !== getTodayYmd()) {
                        GM_setValue('Config.claimNoticeDate', getTodayYmd());
                        GM_notification({
                            title: 'Microsoft Rewards',
                            text: `有 ${amount} 积分待领取，请打开 Rewards 页面手动领取`,
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
                warnFetchFail('其他任务', REWARDS.earn);
                return; // 保留上次结果，不清空
            }
            const questIds = parseQuestIds(earnHtml);
            if (!questIds.length) {
                // 只有确实抓到页面却解析不到任务时才清空（说明今天真的没有打卡任务）
                warnParseEmpty('其他任务');
                saveQuestState([]);
                render();
                return;
            }
            const prevList = state.quests || [];
            const results = [];
            for (const questId of questIds) {
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
            const r = await fetchRewardsPage(REWARDS.dash);
            dash = r.html; fromOf.dash = r.from; if (r.login) loginHit = true;
        } catch (e) { add('dash ERR ' + e.message); }
        try {
            const r = await fetchRewardsPage(REWARDS.earn);
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

    // 搜索模块：重构版（动态判定合并后的总搜索进度）
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

        // 搜索前先同步一次最新数据
        await updateData();

        // 延时跟着环境走：手机慢一点，电脑快一点
        const envDelay = ENV_MOBILE ? CONFIG.mobile : CONFIG.pc;

        // 执行单次搜索与奖励触发
        // 站点 = 当前页面所在域名（cn.bing.com / www.bing.com）；UA = 运行环境（手机/电脑）
        const doSearch = async (query) => {
            const host = currentSearchHost();
            const cookie = await getCookies(`https://${host}`);
            await waitWhilePaused();

            const ua = ENV_MOBILE ? CONFIG.ua.mobile : CONFIG.ua.pc;
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

                log(`✓ 搜索: "${query.substring(0, 12)}..."`);
            } catch (e) {
                console.error('[Rewards] 搜索异常:', e);
                log(`✗ 搜索失败: ${e.message}`);
            }
        };
        // 精确等待函数（优化日志输出频率，彻底杜绝刷屏）
        const preciseWait = async (ms) => {
            state.countdownStartTime = Date.now();
            state.countdownDuration = ms;
            let endTime = Date.now() + ms;

            const totalSecs = Math.ceil(ms / 1000);
            if (totalSecs > 60) {
                const mins = (totalSecs / 60).toFixed(1);
                log(`⏳ 等待中，预计需要 ${mins} 分钟...`);
            } else if (totalSecs > 0) {
                log(`⏳ 等待 ${totalSecs} 秒...`);
            }

            while (Date.now() < endTime && state.running) {
                if (state.manualPaused) {
                    const pausedMs = await waitWhilePaused();
                    endTime += pausedMs;
                    state.countdownStartTime += pausedMs;
                    continue;
                }
                const remaining = Math.max(0, endTime - Date.now());
                await sleep(Math.min(500, remaining));
            }
            
            state.countdownStartTime = 0;
            state.countdownDuration = 0;
        };

        // 暂停检查函数（优化：如果已满直接跳过暂停）
        const checkPause = async () => {
            if (!CONFIG.pause.enabled) return;
            if (state.searchCur >= state.searchMax) return;

            state.searchCount++;
            saveProgress();

            if (state.searchCount % CONFIG.pause.interval === 0) {
                state.isPaused = true;
                const pauseMs = CONFIG.pause.duration();
                const pauseMinutes = Math.round(pauseMs / 60000);
                log(`⏸️ 已完成 ${state.searchCount} 次搜索，触发防风控暂停 ${pauseMinutes} 分钟...`);
                state.pauseEndTime = Date.now() + pauseMs;
                await preciseWait(pauseMs);
                state.isPaused = false;
                state.pauseEndTime = 0;
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

            while (state.searchCur < state.searchMax && state.running) {
                await waitWhilePaused();

                searchIndex++;
                const q = await getHotQuery();
                await doSearch(q);

                // 👈 核心修复：每次做完立即同步预估积分 (+3分/次)
                state.searchCur = Math.min(state.searchMax, state.searchCur + 3);
                render();
                await checkPause();
                if (!state.running) break;
                await preciseWait(randomRange(envDelay.minDelay, envDelay.maxDelay));

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
            // 当天还没有统计结果时，初始化阶段主动算一次，面板不再显示 0/0
            await Promise.all([
                state.promosTotal ? null : refreshPromoScore(),
                readPunchcardProgress()
            ]);

            try {
                const info = await withAccessTokenRequest(token => gmRequest({
                    url: 'https://prod.rewardsplatform.microsoft.com/dapi/me?channel=SAAndroid&options=613',
                    headers: { 
                        'Authorization': `Bearer ${token}`, 
                        'X-Rewards-AppId': CONFIG.mobileApi.appId, 
                        'X-Rewards-IsMobile': 'true' 
                    }
                }));
                if (info) {
                    const d = typeof info === 'string' ? JSON.parse(info) : info;
                    const p = d.response?.promotions?.find(x => x.attributes?.offerid === 'ENUS_readarticle3_30points');
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

    setInterval(updateData, 60000);

    // 偶发抓取失败自动恢复：首屏没拿到活动/打卡/可领取积分时，每 5 分钟补拉一次，
    // 网络恢复或登录态刷新后无需用户手动点按钮。
    let lastRecoverAt = 0;
    setInterval(() => {
        const now = Date.now();
        if (now - lastRecoverAt < 5 * 60 * 1000) return;
        const needPromo = !state.promosTotal;
        const needQuest = !(state.quests || []).length;
        const needClaim = state.claimablePoints == null;
        if (!needPromo && !needQuest && !needClaim) { lastRecoverAt = now; return; }
        lastRecoverAt = now;
        if (needPromo) refreshPromoScore();
        if (needQuest) readPunchcardProgress();
        if (needClaim) checkClaimablePoints(null, true);
    }, 60000);

})();
