const app = document.querySelector("#app");
const header = document.querySelector("#app-header");
const bottomNav = document.querySelector("#bottom-nav");
const shell = document.querySelector(".phone-shell");
const readerLayer = document.querySelector("#reader-layer");
const modalRoot = document.querySelector("#modal-root");
const toastRoot = document.querySelector("#toast-root");

const state = {
  user: null,
  home: null,
  detail: null,
  detailTab: "intro",
  discover: { query: "", category: 0, sort: "hot", books: [] },
  forumFilter: "all",
  wallet: null,
  preferences: null,
  reader: null,
  returnHash: "#/home",
};

const THEMES = {
  night: { label: "深夜", text: "#e9dfcf", background: "#171613" },
  paper: { label: "纸张", text: "#3d352b", background: "#f3ead8" },
  green: { label: "青竹", text: "#344538", background: "#dfe8d9" },
  blue: { label: "雾蓝", text: "#304657", background: "#dfe9ec" },
  rose: { label: "旧玫", text: "#513b3d", background: "#f1e1df" },
};

const VIP_THEME_KEYS = new Set(["blue", "rose"]);
const UI_THEMES = {
  sand: { label: "暖砂", color: "#e87350" },
  sage: { label: "森青", color: "#5c826b" },
};

const STATUS_TEXT = {
  draft: "草稿",
  pending: "审核中",
  published: "已发布",
  rejected: "已驳回",
};

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function money(cents, trim = true) {
  const value = Number(cents || 0) / 100;
  return `¥${trim && Number.isInteger(value) ? value.toFixed(0) : value.toFixed(2)}`;
}

function compactCount(value) {
  const number = Number(value || 0);
  if (number >= 10000) return `${(number / 10000).toFixed(number >= 100000 ? 0 : 1)}万`;
  return String(number);
}

function dateText(value) {
  if (!value) return "";
  const date = new Date(value);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function icon(name, size = 20) {
  const paths = {
    home: '<path d="M3 10.7 12 3l9 7.7v9.1a1.2 1.2 0 0 1-1.2 1.2h-5.2v-6.1H9.4V21H4.2A1.2 1.2 0 0 1 3 19.8v-9.1Z"/>',
    discover: '<circle cx="12" cy="12" r="8.5"/><path d="m15.6 8.4-2.1 5.1-5.1 2.1 2.1-5.1 5.1-2.1Z"/>',
    pen: '<path d="m4 20 4.3-1 10.9-10.9a2.2 2.2 0 0 0-3.1-3.1L5.2 15.9 4 20Z"/><path d="m14.8 6.3 3.1 3.1"/>',
    forum: '<path d="M4 4h16v12H9l-5 4V4Z"/><path d="M8 8h8M8 11.5h5"/>',
    user: '<circle cx="12" cy="8" r="3.4"/><path d="M5 20c.4-4 3.1-6.2 7-6.2s6.6 2.2 7 6.2"/>',
    search: '<circle cx="10.8" cy="10.8" r="6.4"/><path d="m16 16 4.2 4.2"/>',
    bell: '<path d="M6.5 10a5.5 5.5 0 0 1 11 0c0 6 2.1 6.3 2.1 7.4H4.4C4.4 16.3 6.5 16 6.5 10Z"/><path d="M10 20h4"/>',
    back: '<path d="m15 5-7 7 7 7"/>',
    heart: '<path d="M20.8 5.8a5 5 0 0 0-7.1 0L12 7.5l-1.7-1.7a5 5 0 0 0-7.1 7.1L12 21l8.8-8.1a5 5 0 0 0 0-7.1Z"/>',
    plus: '<path d="M12 4v16M4 12h16"/>',
    close: '<path d="m5 5 14 14M19 5 5 19"/>',
    chevron: '<path d="m9 5 7 7-7 7"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/>',
    book: '<path d="M4 4.5h6a3 3 0 0 1 3 3V21a3 3 0 0 0-3-3H4V4.5ZM20 4.5h-4a3 3 0 0 0-3 3V21a3 3 0 0 1 3-3h4V4.5Z"/>',
    wallet: '<path d="M3.5 6.5h15a2 2 0 0 1 2 2v10h-17v-12Z"/><path d="M3.5 6.5V5a1.5 1.5 0 0 1 1.5-1.5h11M16 11h4.5v4H16a2 2 0 0 1 0-4Z"/>',
    crown: '<path d="m3 7 4.5 3L12 4l4.5 6L21 7l-2 11H5L3 7Z"/><path d="M5 21h14"/>',
    receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z"/><path d="M9 8h6M9 12h6"/>',
    logout: '<path d="M10 4H4v16h6M14 8l4 4-4 4M8 12h10"/>',
    tip: '<path d="M12 3v18M17 7.3c-.8-1.4-2.6-2.2-5-2.2-2.8 0-5 1.5-5 3.8 0 2.5 2.4 3.5 5.4 4.2 3.1.7 5.1 1.4 5.1 4 0 2.4-2.3 4-5.2 4-2.9 0-5-1-5.9-2.7"/>',
    more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    eye: '<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/>',
    lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.book}</svg>`;
}

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  let body = options.body;
  if (body !== undefined && typeof body !== "string") {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(body);
  }
  const response = await fetch(path, {
    credentials: "same-origin",
    ...options,
    headers,
    body,
  });
  let payload;
  try {
    payload = await response.json();
  } catch {
    payload = { ok: false, error: { code: "BAD_RESPONSE", message: "服务器返回了无法识别的内容" } };
  }
  if (!response.ok || !payload.ok) {
    const error = new Error(payload.error?.message || "请求失败");
    error.code = payload.error?.code || "REQUEST_FAILED";
    error.details = payload.error?.details;
    error.status = response.status;
    throw error;
  }
  return payload.data;
}

function toast(message, kind = "info") {
  const node = document.createElement("div");
  node.className = `toast ${kind === "error" ? "error" : ""}`;
  node.textContent = message;
  toastRoot.append(node);
  setTimeout(() => node.remove(), 2600);
}

function openModal(content) {
  modalRoot.innerHTML = `
    <div class="modal-backdrop" data-action="close-modal">
      <section class="modal-sheet" role="dialog" aria-modal="true">
        <div class="modal-handle"></div>
        ${content}
      </section>
    </div>
  `;
}

function closeModal() {
  modalRoot.innerHTML = "";
}

function navigate(path) {
  if (location.hash === path) {
    renderRoute();
  } else {
    location.hash = path;
  }
}

function coverHTML(book, size = "") {
  return `
    <div class="book-cover ${size}" data-symbol="${esc(book.cover.symbol)}"
      style="--cover-start:${esc(book.cover.start)};--cover-end:${esc(book.cover.end)}">
      <span class="cover-top">XUNYE · ORIGINAL</span>
      <span class="cover-title">${esc(book.title)}</span>
      <span class="cover-author">${esc(book.authorName)} 著</span>
    </div>
  `;
}

function bookCardHTML(book) {
  return `
    <button class="book-card" data-action="open-book" data-id="${book.id}">
      ${coverHTML(book)}
      <span class="book-card-title">${esc(book.title)}</span>
      <span class="book-card-meta">
        <span>${esc(book.categoryName)} · ${esc(book.authorName)}</span>
        <span>★ ${Number(book.rating).toFixed(1)}</span>
      </span>
    </button>
  `;
}

function railBookHTML(book) {
  return `
    <button class="rail-book" data-action="open-book" data-id="${book.id}">
      ${coverHTML(book, "small")}
      <span class="rail-book-title">${esc(book.title)}</span>
      <span class="rail-book-meta">${esc(book.categoryName)} · ${compactCount(book.readCount)} 阅读</span>
    </button>
  `;
}

function renderHeader(type = "main", { title = "" } = {}) {
  if (type === "none") {
    header.innerHTML = "";
    header.className = "app-header hidden";
    return;
  }
  if (type === "back") {
    header.className = "app-header";
    header.innerHTML = `
      <button class="icon-button" data-action="back" aria-label="返回">${icon("back")}</button>
      <span class="section-title">${esc(title)}</span>
      <button class="icon-button" data-action="go" data-path="#/home" aria-label="首页">${icon("home", 18)}</button>
    `;
    return;
  }
  header.className = "app-header";
  header.innerHTML = `
    <button class="brand" data-action="go" data-path="#/home">
      <span class="brand-mark">页</span>
      <span class="brand-copy">
        <span class="brand-name">寻页</span>
        <span class="brand-slogan">Find your story</span>
      </span>
    </button>
    <div class="header-actions">
      <button class="icon-button" data-action="go" data-path="#/discover" aria-label="搜索">${icon("search", 18)}</button>
      ${
        state.user
          ? `<button class="avatar-button" data-action="go" data-path="#/me" aria-label="个人中心">${esc(state.user.avatar)}</button>`
          : `<button class="btn btn-dark btn-sm" data-action="go" data-path="#/login">登录</button>`
      }
    </div>
  `;
}

function renderBottomNav(active) {
  const items = [
    ["home", "首页", "#/home", "home"],
    ["discover", "书城", "#/discover", "discover"],
    ["author", "创作", "#/author", "pen"],
    ["forum", "社区", "#/forum", "forum"],
    ["me", "我的", "#/me", "user"],
  ];
  bottomNav.className = "bottom-nav visible";
  bottomNav.innerHTML = items.map(([key, label, path, iconName]) => `
    <button class="nav-item ${active === key ? "active" : ""} ${key === "author" ? "create-nav" : ""}"
      data-action="go" data-path="${path}">
      ${key === "author"
        ? `<span class="nav-icon-wrap">${icon(iconName, 18)}</span>`
        : icon(iconName, 21)}
      <span>${label}</span>
    </button>
  `).join("");
}

function hideNavigation() {
  bottomNav.className = "bottom-nav";
  bottomNav.innerHTML = "";
}

function pageLoading() {
  app.innerHTML = `
    <div class="page-loading">
      <div class="brand-mark">页</div>
      <p>正在翻开故事…</p>
    </div>
  `;
}

function guestNotice() {
  return `
    <div class="form-card" style="margin:20px;text-align:center">
      <h3>登录后继续</h3>
      <p class="text-caption">收藏书架、同步进度、发表评论、购买章节和参与社区都需要登录。</p>
      <button class="btn btn-primary btn-block" data-action="go" data-path="#/login">去登录 / 注册</button>
    </div>
  `;
}

async function renderHome() {
  renderHeader();
  renderBottomNav("home");
  pageLoading();
  if (!state.home) {
    state.home = await api("/api/home");
    state.user = state.home.user;
  }
  const home = state.home;
  const featured = home.featured[0];
  app.innerHTML = `
    <section class="page">
      <div class="home-intro">
        <span class="eyebrow">TODAY'S DISCOVERY</span>
        <h1 class="display-title">在字里行间，<br><em>遇见另一种人生。</em></h1>
        <p>发现被认真写下的故事，也把脑海里的世界，交给下一位读者。</p>
      </div>

      <form id="home-search-form" class="search-bar">
        ${icon("search", 19)}
        <input name="q" type="search" placeholder="搜索书名、作者或故事关键词" autocomplete="off">
      </form>

      ${
        featured
          ? `<article class="hero-card">
              <div class="hero-inner">
                <div>
                  <span class="hero-kicker">编辑精选 · ${esc(featured.categoryName)}</span>
                  <h2 class="hero-title">${esc(featured.title)}</h2>
                  <p class="hero-summary">${esc(featured.summary)}</p>
                  <div class="hero-actions">
                    <button class="btn btn-primary btn-sm" data-action="open-book" data-id="${featured.id}">开始阅读</button>
                    <button class="btn btn-ghost btn-sm" data-action="open-book" data-id="${featured.id}">作品详情</button>
                  </div>
                </div>
                <div class="hero-cover">${coverHTML(featured, "large")}</div>
              </div>
            </article>`
          : ""
      }

      <div class="notice-strip">
        <span class="notice-dot"></span>
        <p>${esc(home.notices[0]?.title || "欢迎来到寻页")} · ${esc(home.notices[0]?.content || "")}</p>
      </div>

      <section class="home-block">
        <div class="section-head">
          <div>
            <h2 class="section-title">按心情找故事</h2>
            <p class="section-subtitle">八种题材，等待一次意外相遇</p>
          </div>
        </div>
        <div class="category-scroll">
          ${home.categories.map((category) => `
            <button class="category-pill" data-action="browse-category" data-id="${category.id}">
              <span class="category-icon" style="background:${esc(category.color)}">${esc(category.icon)}</span>
              <span>${esc(category.name)}</span>
            </button>
          `).join("")}
        </div>
      </section>

      <section class="home-block">
        <div class="section-head">
          <div>
            <h2 class="section-title">此刻值得读</h2>
            <p class="section-subtitle">读者正在追更的故事</p>
          </div>
          <button class="text-button" data-action="go" data-path="#/discover">全部 ${icon("chevron", 12)}</button>
        </div>
        <div class="book-rail">
          ${home.hot.map(railBookHTML).join("")}
        </div>
      </section>

      <section class="home-block">
        <div class="section-head">
          <div>
            <h2 class="section-title">本周热读</h2>
            <p class="section-subtitle">由真实阅读趋势生成</p>
          </div>
        </div>
        <div class="rank-list">
          ${home.hot.slice(0, 5).map((book, index) => `
            <button class="rank-item" data-action="open-book" data-id="${book.id}">
              <span class="rank-num">${String(index + 1).padStart(2, "0")}</span>
              ${coverHTML(book)}
              <span class="rank-info">
                <strong>${esc(book.title)}</strong>
                <small>${esc(book.authorName)} · ${esc(book.categoryName)}</small>
              </span>
              <span class="rank-reads">${compactCount(book.readCount)}</span>
            </button>
          `).join("")}
        </div>
      </section>

      <aside class="vip-banner">
        <span class="vip-label">XUNYE VIP</span>
        <h3>${state.user?.isVip ? "会员有效期持续中" : "让好故事不被中断"}</h3>
        <p>${
          state.user?.isVip
            ? `当前会员剩余 ${state.user.vipDaysLeft} 天，会员章节与购书折扣均已生效。`
            : `会员书库、付费章节折扣、专属主题与身份标识，最低 ${money(home.membershipPlans[0]?.priceCents)} 起。`
        }</p>
        <button class="btn btn-primary btn-sm" data-action="${state.user ? "open-membership" : "go"}"
          ${state.user ? "" : `data-path="#/login"`}>${state.user?.isVip ? "续费会员" : "了解会员"}</button>
      </aside>
    </section>
  `;
}

async function renderDiscover() {
  renderHeader();
  renderBottomNav("discover");
  pageLoading();
  const [home, data] = await Promise.all([
    state.home ? Promise.resolve(state.home) : api("/api/home"),
    api(`/api/books?q=${encodeURIComponent(state.discover.query)}&category=${state.discover.category}&sort=${state.discover.sort}&limit=40`),
  ]);
  state.home = home;
  state.discover.books = data.books;
  renderDiscoverView();
}

function renderDiscoverView() {
  const { query, category, sort, books } = state.discover;
  const categories = state.home.categories;
  app.innerHTML = `
    <section class="page">
      <div class="search-page-head">
        <span class="eyebrow">EXPLORE THE SHELF</span>
        <h1 class="display-title" style="font-size:36px">下一本书，<br>藏在哪一页？</h1>
      </div>
      <form id="discover-search-form" class="search-bar" style="margin-top:18px">
        ${icon("search", 19)}
        <input name="q" type="search" value="${esc(query)}" placeholder="书名、作者、关键词" autocomplete="off">
      </form>
      <div class="filter-row">
        <button class="filter-chip ${category === 0 ? "active" : ""}" data-action="filter-category" data-id="0">全部</button>
        ${categories.map((item) => `
          <button class="filter-chip ${category === item.id ? "active" : ""}" data-action="filter-category" data-id="${item.id}">
            ${esc(item.name)}
          </button>
        `).join("")}
      </div>
      <div class="filter-row" style="padding-top:0">
        ${[
          ["hot", "热度"],
          ["new", "新上架"],
          ["updated", "最近更新"],
          ["rating", "评分"],
        ].map(([value, label]) => `
          <button class="filter-chip ${sort === value ? "active" : ""}" data-action="filter-sort" data-value="${value}">${label}</button>
        `).join("")}
      </div>
      ${
        books.length
          ? `<div class="book-grid">${books.map(bookCardHTML).join("")}</div>`
          : `<div class="empty-state">
              <div class="empty-state-icon">${icon("search", 28)}</div>
              <h3>没有找到相关故事</h3>
              <p>换一个关键词或分类，也许下一次翻页就会遇见。</p>
            </div>`
      }
      <div class="spacer-24"></div>
    </section>
  `;
}

async function renderBookDetail(bookId, preserveTab = false) {
  renderHeader("back", { title: "作品详情" });
  hideNavigation();
  if (!preserveTab) state.detailTab = "intro";
  pageLoading();
  const data = await api(`/api/books/${bookId}`);
  state.detail = data.book;
  renderBookDetailView();
}

function renderBookDetailView() {
  const book = state.detail;
  const firstUnread = book.progress?.chapterId
    ? book.chapters.find((chapter) => chapter.id === book.progress.chapterId)
    : book.chapters[0];
  const startChapter = firstUnread || book.chapters[0];
  app.innerHTML = `
    <section class="page">
      <div class="detail-hero" data-symbol="${esc(book.cover.symbol)}"
        style="--detail-start:${esc(book.cover.start)};--detail-end:${esc(book.cover.end)}">
        <div class="detail-main">
          <div class="detail-cover">${coverHTML(book, "large")}</div>
          <div>
            <span class="detail-category">${esc(book.categoryName)} · ${book.serialStatus === "finished" ? "已完结" : "连载中"}</span>
            <h1 class="detail-title">${esc(book.title)}</h1>
            <div class="detail-author">${esc(book.authorName)} 著</div>
            <div class="detail-stats">
              <span>★ ${Number(book.rating).toFixed(1)}</span>
              <span>${compactCount(book.readCount)} 阅读</span>
              <span>${compactCount(book.favoriteCount)} 收藏</span>
            </div>
          </div>
        </div>
      </div>
      <div class="detail-sheet">
        <div class="detail-actions">
          <button class="btn btn-primary" data-action="continue-reading"
            data-id="${startChapter?.id || ""}">
            ${book.progress ? `继续阅读 · ${book.progress.percent}%` : "开始阅读"}
          </button>
          <button class="btn btn-light" data-action="favorite" data-id="${book.id}">
            ${icon("heart", 16)} ${book.isFavorite ? "已收藏" : "收藏"}
          </button>
          <button class="btn btn-light" data-action="tip-open" data-id="${book.id}" aria-label="打赏">${icon("tip", 16)}</button>
        </div>
        <p class="detail-summary">${esc(book.summary)}</p>
        <div class="detail-info-row">
          <span class="tag">${esc(book.categoryName)}</span>
          ${book.vipOnly ? '<span class="tag warm">会员书库</span>' : ""}
          <span class="tag green">${book.chapters.length} 章</span>
          ${book.vipDiscountPercent < 100 ? `<span class="tag warm">会员购书 ${book.vipDiscountPercent} 折</span>` : ""}
        </div>
      </div>
      <div class="content-tabs">
        <button class="content-tab ${state.detailTab === "intro" ? "active" : ""}" data-action="detail-tab" data-tab="intro">详情</button>
        <button class="content-tab ${state.detailTab === "chapters" ? "active" : ""}" data-action="detail-tab" data-tab="chapters">目录 · ${book.chapters.length}</button>
        <button class="content-tab ${state.detailTab === "comments" ? "active" : ""}" data-action="detail-tab" data-tab="comments">书评 · ${book.comments.length}</button>
      </div>
      <div class="tab-panel">${renderDetailTab(book)}</div>
    </section>
  `;
}

function renderDetailTab(book) {
  if (state.detailTab === "chapters") {
    return `
      <div class="chapter-list">
        ${book.chapters.map((chapter) => `
          <button class="chapter-row" data-action="open-chapter" data-id="${chapter.id}">
            <span>
              <strong>${esc(chapter.title)}</strong>
              <small>${chapter.wordCount} 字 · ${chapter.vipFree ? "会员免费" : chapter.priceCents ? `${money(chapter.displayPriceCents)} 阅读` : "免费章节"}</small>
            </span>
            <span class="chapter-state ${chapter.locked ? "locked" : ""}">
              ${chapter.locked ? icon("lock", 14) : chapter.accessReason === "purchased" ? "已购" : "阅读"}
            </span>
          </button>
        `).join("")}
      </div>
    `;
  }
  if (state.detailTab === "comments") {
    return `
      <form id="comment-form" class="comment-composer" data-book-id="${book.id}">
        <input class="input" name="content" maxlength="500" placeholder="说说这本书带给你的感受…">
        <button class="btn btn-dark btn-sm" type="submit">发布</button>
      </form>
      ${
        book.comments.length
          ? book.comments.map((comment) => `
              <article class="comment-card">
                <span class="mini-avatar">${esc(comment.user.avatar)}</span>
                <div class="comment-body">
                  <div class="comment-head">
                    <strong>${esc(comment.user.nickname)}</strong>
                    ${comment.user.role === "author" ? '<span class="tag">作者</span>' : ""}
                    ${comment.user.isVip ? '<span class="tag warm">VIP</span>' : ""}
                    <span>${dateText(comment.createdAt)}</span>
                  </div>
                  <p>${esc(comment.content)}</p>
                </div>
              </article>
            `).join("")
          : `<div class="empty-state"><h3>还没有书评</h3><p>成为第一个留下阅读感受的人。</p></div>`
      }
    `;
  }
  return `
    <div class="form-card">
      <h3>关于这个故事</h3>
      <p class="detail-summary">${esc(book.summary)}</p>
      <div class="spacer-16"></div>
      <div class="detail-info-row">
        <span class="tag green">${book.serialStatus === "finished" ? "已完结" : "连载中"}</span>
        <span class="tag">${esc(book.categoryName)}</span>
        <span class="tag ${book.vipOnly ? "warm" : ""}">${book.vipOnly ? "会员书库" : "普通书库"}</span>
      </div>
    </div>
    <div class="spacer-16"></div>
    <div class="form-card">
      <h3>作者的话</h3>
      <p class="detail-summary">写城市，也写城市里没有寄出的信。感谢你翻开《${esc(book.title)}》，愿我们都能在故事里找到一盏灯。</p>
      <div class="spacer-16"></div>
      <button class="btn btn-light btn-sm" data-action="tip-open" data-id="${book.id}">${icon("tip", 14)} 支持作者</button>
    </div>
  `;
}

async function renderShelf() {
  renderHeader("back", { title: "我的书架" });
  hideNavigation();
  if (!state.user) {
    app.innerHTML = guestNotice();
    return;
  }
  pageLoading();
  const data = await api("/api/shelf");
  app.innerHTML = `
    <section class="page page-narrow">
      <span class="eyebrow">MY COLLECTION</span>
      <h1 class="display-title" style="font-size:34px">留在书架上的故事</h1>
      <p class="text-caption" style="margin:10px 0 20px">${data.books.length} 本收藏，进度自动云端同步。</p>
      ${
        data.books.length
          ? data.books.map((book) => `
              <article class="shelf-card" data-action="open-book" data-id="${book.id}">
                ${coverHTML(book)}
                <div class="shelf-info">
                  <h3>${esc(book.title)}</h3>
                  <p>${esc(book.summary)}</p>
                  <div class="progress-track"><span style="width:${book.progress?.percent || 0}%"></span></div>
                  <div class="progress-caption">
                    <span>${book.progress ? `读到「${esc(book.progress.chapterTitle)}」` : "尚未开始阅读"}</span>
                    <span>${book.progress?.percent || 0}%</span>
                  </div>
                </div>
              </article>
            `).join("")
          : `<div class="empty-state">
              <div class="empty-state-icon">${icon("book", 30)}</div>
              <h3>书架还是空的</h3>
              <p>去书城挑一本喜欢的故事，下一次打开时就能接着读。</p>
              <button class="btn btn-primary" data-action="go" data-path="#/discover">去发现故事</button>
            </div>`
      }
    </section>
  `;
}

function renderAuth(mode = "login") {
  renderHeader("none");
  hideNavigation();
  app.innerHTML = `
    <section class="page auth-page">
      <button class="icon-button auth-back" data-action="back" aria-label="返回">${icon("back")}</button>
      <span class="eyebrow">WELCOME TO XUNYE</span>
      <h1 class="auth-title">故事从这里<br>继续发生。</h1>
      <p class="auth-desc">一个账号，连接阅读、创作、书评与会员权益。</p>
      <div class="auth-card">
        <div class="auth-tabs">
          <button class="auth-tab ${mode === "login" ? "active" : ""}" data-action="auth-mode" data-mode="login">登录</button>
          <button class="auth-tab ${mode === "register" ? "active" : ""}" data-action="auth-mode" data-mode="register">注册</button>
        </div>
        ${
          mode === "register"
            ? `<form id="register-form">
                <div class="field">
                  <label for="reg-nickname">昵称</label>
                  <input id="reg-nickname" class="input" name="nickname" maxlength="16" placeholder="读者会看到的名字" required>
                </div>
                <div class="field">
                  <label for="reg-username">用户名</label>
                  <input id="reg-username" class="input" name="username" minlength="3" maxlength="24" placeholder="3-24 位字母、数字或中文" required>
                </div>
                <div class="field">
                  <label for="reg-email">邮箱</label>
                  <input id="reg-email" class="input" name="email" type="email" placeholder="用于登录和找回账号" required>
                </div>
                <div class="field">
                  <label for="reg-password">密码</label>
                  <input id="reg-password" class="input" name="password" type="password" minlength="6" maxlength="72" placeholder="至少 6 位" required>
                </div>
                <button class="btn btn-primary btn-block" type="submit">创建账号并领取 10 元阅读余额</button>
              </form>`
            : `<form id="login-form">
                <div class="field">
                  <label for="login-account">账号</label>
                  <input id="login-account" class="input" name="account" autocomplete="username" placeholder="用户名或邮箱" required>
                </div>
                <div class="field">
                  <label for="login-password">密码</label>
                  <input id="login-password" class="input" name="password" type="password" autocomplete="current-password" placeholder="请输入密码" required>
                </div>
                <button class="btn btn-primary btn-block" type="submit">进入寻页</button>
              </form>`
        }
        <div class="demo-accounts">
          <p>演示账号 · 密码均为 123456</p>
          <div class="demo-buttons">
            <button class="btn btn-light" data-action="quick-login" data-account="reader">读者</button>
            <button class="btn btn-light" data-action="quick-login" data-account="author">作者</button>
            <button class="btn btn-light" data-action="quick-login" data-account="admin">管理员</button>
          </div>
        </div>
      </div>
      <p class="text-caption" style="margin:18px 5px;text-align:center">
        本项目为比赛演示版，充值与会员购买均为模拟支付，不会产生真实扣款。
      </p>
    </section>
  `;
}

async function renderAuthor() {
  renderHeader();
  renderBottomNav("author");
  if (!state.user) {
    app.innerHTML = `
      <section class="page page-narrow">
        <span class="eyebrow">WRITER'S DESK</span>
        <h1 class="display-title">把脑海里的世界，<br>写下一页。</h1>
        <p class="auth-desc">作者工作台支持创建作品、提交章节、查看审核意见与作品数据。</p>
        <div class="form-card">
          <h3>开始创作</h3>
          <p class="text-caption">登录后即可申请作者身份。平台会对作品与章节进行审核，通过后进入书城。</p>
          <button class="btn btn-primary btn-block" data-action="go" data-path="#/login">登录 / 注册</button>
        </div>
      </section>
    `;
    return;
  }
  if (state.user.role === "reader") {
    app.innerHTML = `
      <section class="page page-narrow">
        <span class="eyebrow">BECOME A WRITER</span>
        <h1 class="display-title">每一个作者，<br>都曾是读者。</h1>
        <p class="auth-desc">申请后，你将拥有自己的作品、章节和数据分析空间。</p>
        <div class="form-card">
          <h3>作者权益</h3>
          <p class="detail-summary">发布原创作品、分章管理、查看阅读与收藏数据，并获得读者打赏的 70% 分成。</p>
          <div class="spacer-16"></div>
          <button class="btn btn-primary btn-block" data-action="apply-author">申请成为作者</button>
        </div>
      </section>
    `;
    return;
  }
  pageLoading();
  const data = await api("/api/author/overview");
  const { stats, books, categories } = data;
  app.innerHTML = `
    <section class="page">
      <div class="home-intro">
        <span class="eyebrow">WRITER'S DESK</span>
        <h1 class="display-title" style="font-size:36px">${esc(state.user.nickname)}，<br>今天写到哪里？</h1>
        <p>作品审核、读者数据和创作收益，都在这张桌上。</p>
      </div>
      <div class="stat-grid">
        <div class="stat-card"><span>作品数</span><strong>${stats.bookCount}</strong></div>
        <div class="stat-card"><span>累计阅读</span><strong>${compactCount(stats.totalReads)}</strong></div>
        <div class="stat-card"><span>读者收藏</span><strong>${compactCount(stats.totalFavorites)}</strong></div>
        <div class="stat-card"><span>打赏分成</span><strong>${money(stats.authorIncomeCents)}</strong></div>
      </div>
      <div class="section-head" style="margin-top:28px">
        <div>
          <h2 class="section-title">我的作品</h2>
          <p class="section-subtitle">草稿只对自己可见，提交后进入审核</p>
        </div>
        <button class="btn btn-primary btn-sm" data-action="new-book">${icon("plus", 14)} 新作品</button>
      </div>
      <div style="padding:0 20px">
        ${
          books.length
            ? books.map((book) => `
                <article class="author-book-card">
                  <div class="author-book-head">
                    <div>
                      <h3>${esc(book.title)}</h3>
                      <p>${esc(book.categoryName)} · ${compactCount(book.readCount)} 阅读 · ${compactCount(book.favoriteCount)} 收藏</p>
                    </div>
                    <span class="status-pill ${book.status}">${STATUS_TEXT[book.status]}</span>
                  </div>
                  ${book.reviewNote ? `<p class="text-caption" style="margin:10px 0 0">审核意见：${esc(book.reviewNote)}</p>` : ""}
                  <div class="chapter-mini-list">
                    ${book.chapters.slice(0, 4).map((chapter) => `
                      <div class="chapter-mini">
                        <span>${esc(chapter.title)}</span>
                        <span>${STATUS_TEXT[chapter.status]} · ${chapter.wordCount} 字</span>
                      </div>
                    `).join("")}
                    ${book.chapters.length === 0 ? '<p class="text-caption">还没有章节，先写下第一章吧。</p>' : ""}
                  </div>
                  <div class="spacer-8"></div>
                  <div style="display:flex;gap:8px;flex-wrap:wrap">
                    <button class="btn btn-dark btn-sm" data-action="new-chapter" data-id="${book.id}">${icon("plus", 13)} 新建章节</button>
                    ${book.status === "draft" || book.status === "rejected"
                      ? `<button class="btn btn-light btn-sm" data-action="submit-book" data-id="${book.id}">提交作品审核</button>`
                      : ""}
                  </div>
                </article>
              `).join("")
            : `<div class="empty-state"><div class="empty-state-icon">${icon("pen", 28)}</div><h3>还没有作品</h3><p>从书名和一句简介开始，创建你的第一部作品。</p></div>`
        }
      </div>
    </section>
  `;
  state.author = data;
}

async function renderForum() {
  renderHeader();
  renderBottomNav("forum");
  pageLoading();
  const data = await api(`/api/forum?type=${state.forumFilter}`);
  app.innerHTML = `
    <section class="page">
      <div class="home-intro" style="padding-bottom:18px">
        <span class="eyebrow">STORY COMMUNITY</span>
        <h1 class="display-title" style="font-size:36px">一起找书，<br>也一起聊故事。</h1>
        <p>描述一段模糊记忆，让其他读者帮你找回那本书。</p>
      </div>
      <div class="forum-tabs">
        ${[
          ["all", "全部"],
          ["find", "找书"],
          ["discuss", "讨论"],
          ["author", "作者"],
        ].map(([value, label]) => `
          <button class="forum-tab ${state.forumFilter === value ? "active" : ""}" data-action="forum-filter" data-value="${value}">${label}</button>
        `).join("")}
      </div>
      ${
        data.posts.length
          ? data.posts.map((post) => `
              <article class="forum-post">
                <div class="forum-post-head">
                  <span class="mini-avatar">${esc(post.user.avatar)}</span>
                  <div>
                    <strong>${esc(post.user.nickname)}</strong>
                    <span> · ${dateText(post.createdAt)}</span>
                  </div>
                  <span class="tag" style="margin-left:auto">${post.type === "find" ? "找书" : post.type === "author" ? "作者" : "讨论"}</span>
                </div>
                <h3>${esc(post.title)}</h3>
                <p>${esc(post.content)}</p>
                ${
                  post.replies.length
                    ? `<div class="forum-replies">${post.replies.map((reply) => `
                        <div class="forum-reply"><strong>${esc(reply.user.nickname)}：</strong>${esc(reply.content)}</div>
                      `).join("")}</div>`
                    : ""
                }
                <div class="forum-post-foot">
                  <span>${icon("eye", 12)} ${post.views}</span>
                  <span>${icon("heart", 12)} ${post.likes}</span>
                  <span>${post.replyCount} 条回复</span>
                  <button class="text-button strong" style="margin-left:auto" data-action="reply-post" data-id="${post.id}">回复</button>
                </div>
              </article>
            `).join("")
          : `<div class="empty-state"><h3>这个话题还没有帖子</h3><p>成为第一个开口的人。</p></div>`
      }
      <button class="btn btn-primary" style="position:sticky;bottom:calc(var(--nav-height) + 10px);float:right;margin:0 20px 24px"
        data-action="new-post">${icon("plus", 15)} 发帖</button>
    </section>
  `;
}

async function renderMe() {
  renderHeader();
  renderBottomNav("me");
  if (!state.user) {
    app.innerHTML = `
      <section class="page page-narrow">
        <div class="profile-hero">
          <div class="profile-main">
            <div class="profile-avatar">页</div>
            <div><h2>尚未登录</h2><p>登录后同步你的书架与阅读进度</p></div>
          </div>
        </div>
        ${guestNotice()}
      </section>
    `;
    return;
  }
  pageLoading();
  const wallet = await api("/api/wallet");
  state.wallet = wallet;
  app.innerHTML = `
    <section class="page">
      <div class="profile-hero">
        <div class="profile-main">
          <div class="profile-avatar">${esc(state.user.avatar)}</div>
          <div>
            <h2>${esc(state.user.nickname)}</h2>
            <p>@${esc(state.user.username)} · ${state.user.role === "admin" ? "管理员" : state.user.role === "author" ? "作者" : "读者"}</p>
            ${wallet.isVip ? `<span class="profile-vip">${icon("crown", 12)} 寻页会员 · 剩余 ${wallet.vipDaysLeft} 天</span>` : ""}
          </div>
        </div>
        <div class="balance-card">
          <div class="balance-item"><span>阅读余额</span><strong>${money(wallet.balanceCents)}</strong></div>
          <div class="balance-item"><span>会员状态</span><strong style="font-family:inherit;font-size:15px">${wallet.isVip ? "生效中" : "未开通"}</strong></div>
        </div>
      </div>
      <div class="profile-menu">
        <button class="profile-menu-item" data-action="open-membership">
          <span class="menu-icon">${icon("crown", 16)}</span>
          <span><strong>会员中心</strong><small>会员书库、购书折扣与限定主题</small></span>
          <span>${icon("chevron", 15)}</span>
        </button>
        <button class="profile-menu-item" data-action="open-recharge">
          <span class="menu-icon">${icon("wallet", 16)}</span>
          <span><strong>余额充值</strong><small>余额用于购买章节和打赏，不与会员混用</small></span>
          <span>${icon("chevron", 15)}</span>
        </button>
        <button class="profile-menu-item" data-action="go" data-path="#/shelf">
          <span class="menu-icon">${icon("book", 16)}</span>
          <span><strong>我的书架</strong><small>收藏与阅读进度</small></span>
          <span>${icon("chevron", 15)}</span>
        </button>
        <button class="profile-menu-item" data-action="show-orders">
          <span class="menu-icon">${icon("receipt", 16)}</span>
          <span><strong>订单与流水</strong><small>充值、会员、购章与打赏记录</small></span>
          <span>${icon("chevron", 15)}</span>
        </button>
        <button class="profile-menu-item" data-action="open-reader-prefs">
          <span class="menu-icon">${icon("settings", 16)}</span>
          <span><strong>阅读偏好</strong><small>字体、字号、背景与翻页模式</small></span>
          <span>${icon("chevron", 15)}</span>
        </button>
        ${state.user.role === "admin" ? `
          <a class="profile-menu-item" href="/admin" target="_blank" rel="noopener">
            <span class="menu-icon">${icon("settings", 16)}</span>
            <span><strong>Web 管理后台</strong><small>作品审核、用户、配置与运营数据</small></span>
            <span>${icon("chevron", 15)}</span>
          </a>
        ` : ""}
        <button class="profile-menu-item" data-action="logout">
          <span class="menu-icon">${icon("logout", 16)}</span>
          <span><strong>退出登录</strong><small>本机登录状态将被清除</small></span>
          <span>${icon("chevron", 15)}</span>
        </button>
      </div>
      <p class="text-caption" style="text-align:center;margin:22px">寻页 v1.0 · 比赛演示版</p>
    </section>
  `;
}

function showMembershipModal() {
  const plans = state.wallet?.membershipPlans || state.home?.membershipPlans || [];
  openModal(`
    <div class="modal-head">
      <div><span class="eyebrow">XUNYE VIP</span><h2>选择会员方案</h2></div>
      <button class="icon-button" data-action="close-modal">${icon("close", 17)}</button>
    </div>
    <p class="text-caption" style="margin:-8px 0 18px">会员按有效期控制权益，与阅读余额相互独立。演示环境为模拟支付。</p>
    <div class="plan-grid">
      ${plans.map((plan) => `
        <button class="plan-card ${plan.recommended ? "recommended" : ""}" data-action="subscribe-plan" data-id="${plan.id}">
          <div>
            <h4>${esc(plan.name)}</h4>
            <p>${esc(plan.benefits).split("|").join(" · ")}</p>
          </div>
          <span class="plan-price"><strong>${money(plan.price_cents)}</strong><small>${money(plan.original_price_cents)}</small></span>
        </button>
      `).join("")}
    </div>
  `);
}

function showRechargeModal() {
  const plans = state.wallet?.rechargePlans || [];
  openModal(`
    <div class="modal-head">
      <div><span class="eyebrow">READING BALANCE</span><h2>充值阅读余额</h2></div>
      <button class="icon-button" data-action="close-modal">${icon("close", 17)}</button>
    </div>
    <p class="text-caption" style="margin:-8px 0 18px">余额仅用于购买付费章节和打赏作品，不会被会员订阅占用。演示环境为模拟支付。</p>
    <div class="plan-grid">
      ${plans.map((plan) => `
        <button class="plan-card ${plan.recommended ? "recommended" : ""}" data-action="recharge-plan" data-id="${plan.id}">
          <div>
            <h4>${esc(plan.label)}</h4>
            <p>${money(plan.price_cents)} 支付 · 到账 ${money(plan.amount_cents + plan.bonus_cents)}</p>
          </div>
          <span class="plan-price"><strong>${money(plan.price_cents)}</strong><small>${plan.bonus_cents ? `赠 ${money(plan.bonus_cents)}` : "无赠额"}</small></span>
        </button>
      `).join("")}
    </div>
  `);
}

function showOrdersModal() {
  const wallet = state.wallet;
  openModal(`
    <div class="modal-head">
      <div><span class="eyebrow">ACCOUNT LEDGER</span><h2>订单与流水</h2></div>
      <button class="icon-button" data-action="close-modal">${icon("close", 17)}</button>
    </div>
    <h3 class="section-title" style="font-size:18px">余额流水</h3>
    <div class="spacer-8"></div>
    ${
      wallet.transactions.length
        ? wallet.transactions.map((item) => `
            <div class="transaction-row">
              <div><strong>${esc(item.description)}</strong><small>${dateText(item.created_at)} · 余额 ${money(item.balance_after_cents)}</small></div>
              <span class="transaction-amount ${item.amount_cents < 0 ? "negative" : ""}">${item.amount_cents > 0 ? "+" : ""}${money(item.amount_cents)}</span>
            </div>
          `).join("")
        : '<p class="text-caption">暂无余额流水</p>'
    }
    <div class="spacer-24"></div>
    <h3 class="section-title" style="font-size:18px">在线订单</h3>
    <div class="spacer-8"></div>
    ${
      wallet.orders.length
        ? wallet.orders.map((order) => `
            <div class="order-row">
              <div><strong style="font-size:11px">${order.type === "membership" ? "会员订阅" : "余额充值"}</strong><small class="muted">${esc(order.order_no)}</small></div>
              <div style="text-align:right"><strong>${money(order.amount_cents)}</strong><small class="muted" style="display:block">已支付</small></div>
            </div>
          `).join("")
        : '<p class="text-caption">暂无在线订单</p>'
    }
  `);
}

function showPreferencesModal() {
  const preferences = state.preferences || {
    font_size: 19,
    font_family: "serif",
    theme: "night",
    line_height: 1.9,
    page_mode: "scroll",
  };
  openModal(`
    <div class="modal-head">
      <div><span class="eyebrow">READING STYLE</span><h2>阅读偏好</h2></div>
      <button class="icon-button" data-action="close-modal">${icon("close", 17)}</button>
    </div>
    <div class="setting-block">
      <div class="setting-label"><span>字号</span><span>${preferences.font_size}px</span></div>
      <div class="setting-options">
        ${[16, 17, 18, 19, 20, 22, 24, 26].map((size) => `
          <button class="size-button ${Number(preferences.font_size) === size ? "active" : ""}" data-action="pref-size" data-value="${size}">${size}</button>
        `).join("")}
      </div>
    </div>
    <div class="setting-block">
      <div class="setting-label"><span>字体</span></div>
      <div class="setting-options">
        <button class="font-button ${preferences.font_family === "serif" ? "active" : ""}" data-action="pref-font" data-value="serif" style="font-family:serif">宋体</button>
        <button class="font-button ${preferences.font_family === "sans" ? "active" : ""}" data-action="pref-font" data-value="sans">黑体</button>
      </div>
    </div>
    <div class="setting-block">
      <div class="setting-label"><span>阅读主题</span></div>
      <div class="setting-options">
        ${Object.entries(THEMES).map(([key, theme]) => `
          <button class="theme-option ${preferences.theme === key ? "active" : ""} ${VIP_THEME_KEYS.has(key) && !state.user?.isVip ? "locked" : ""}"
            data-action="pref-theme" data-value="${key}" title="${theme.label}${VIP_THEME_KEYS.has(key) ? " · 会员专属" : ""}">
            <span class="theme-swatch" style="background:${theme.background};border:5px solid ${theme.background};box-shadow:inset 0 0 0 1px rgba(0,0,0,.1),inset 0 12px 0 ${theme.text}55"></span>
            ${VIP_THEME_KEYS.has(key) && !state.user?.isVip ? `<span class="theme-lock">${icon("lock", 10)}</span>` : ""}
          </button>
        `).join("")}
      </div>
    </div>
    <div class="setting-block">
      <div class="setting-label"><span>自定义颜色</span></div>
      <div class="setting-options">
        <label class="color-control">文字<input type="color" data-color-scope="preference" data-color-field="text_color" value="${esc(preferences.text_color || "#e9dfcf")}"></label>
        <label class="color-control">背景<input type="color" data-color-scope="preference" data-color-field="background" value="${esc(preferences.background || "#171613")}"></label>
      </div>
    </div>
    <div class="setting-block">
      <div class="setting-label"><span>翻页方式</span></div>
      <div class="setting-options">
        <button class="mode-button ${preferences.page_mode === "scroll" ? "active" : ""}" data-action="pref-mode" data-value="scroll">滚动阅读</button>
        <button class="mode-button ${preferences.page_mode === "paged" ? "active" : ""}" data-action="pref-mode" data-value="paged">分页阅读</button>
      </div>
    </div>
    <div class="setting-block">
      <div class="setting-label"><span>界面主题</span></div>
      <div class="setting-options">
        ${Object.entries(UI_THEMES).map(([key, item]) => `
          <button class="mode-button ${document.documentElement.dataset.uiTheme === key ? "active" : ""}"
            data-action="ui-theme" data-value="${key}" style="--swatch:${item.color}">
            ${item.label}
          </button>
        `).join("")}
      </div>
    </div>
  `);
}

function detailBookId() {
  return state.detail?.id;
}

function showUnlockModal(chapterId, title, details = {}) {
  const book = state.detail;
  const chapter = book?.chapters.find((item) => item.id === Number(chapterId));
  const price = details.displayPriceCents ?? chapter?.displayPriceCents ?? 0;
  openModal(`
    <div class="modal-head">
      <div><span class="eyebrow">UNLOCK CHAPTER</span><h2>解锁下一段故事</h2></div>
      <button class="icon-button" data-action="close-modal">${icon("close", 17)}</button>
    </div>
    <p class="detail-summary">「${esc(title || chapter?.title || "付费章节")}」需要购买或会员权益才能阅读。</p>
    <div class="form-card" style="margin-top:18px">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px">
        <div><strong>单独购买本章</strong><p class="text-caption">购买后永久保留阅读权限</p></div>
        <strong style="font-size:22px;color:var(--accent)">${money(price)}</strong>
      </div>
      <div class="spacer-16"></div>
      <button class="btn btn-primary btn-block" data-action="confirm-unlock" data-id="${chapterId}">
        使用阅读余额购买
      </button>
      <div class="spacer-8"></div>
      <button class="btn btn-light btn-block" data-action="open-membership">开通会员，享折扣与会员章节</button>
    </div>
    <p class="text-caption" style="margin:14px 0 0">当前余额：${money(state.user?.balanceCents || 0)}</p>
  `);
}

async function openChapter(chapterId, context = {}) {
  if (!chapterId) {
    toast("这本书还没有可阅读章节", "error");
    return;
  }
  let data;
  let locked = null;
  try {
    data = await api(`/api/chapters/${chapterId}`);
  } catch (error) {
    if (error.status === 402) {
      locked = {
        chapterId: Number(chapterId),
        title: context.title || state.detail?.chapters.find((item) => item.id === Number(chapterId))?.title || "付费章节",
        bookTitle: context.bookTitle || state.detail?.title || "",
        ...error.details,
      };
    } else {
      throw error;
    }
  }
  state.preferences = state.preferences || await loadPreferences();
  state.readerSettings = {
    ...state.preferences,
    font_size: Number(state.preferences?.font_size || 19),
    font_family: state.preferences?.font_family || "serif",
    theme: state.preferences?.theme || "night",
    text_color: state.preferences?.text_color || THEMES.night.text,
    background: state.preferences?.background || THEMES.night.background,
    line_height: Number(state.preferences?.line_height || 1.9),
    page_mode: state.preferences?.page_mode || "scroll",
  };
  showReader(locked || data.chapter, Boolean(locked));
}

async function loadPreferences() {
  if (!state.user) {
    return { font_size: 19, font_family: "serif", theme: "night", line_height: 1.9, page_mode: "scroll" };
  }
  try {
    const data = await api("/api/preferences");
    state.preferences = data.preferences;
    return data.preferences;
  } catch {
    return { font_size: 19, font_family: "serif", theme: "night", line_height: 1.9, page_mode: "scroll" };
  }
}

function showReader(chapter, locked = false) {
  shell.classList.add("hidden");
  state.reader = { chapter, locked, settingsOpen: false, progress: 0 };
  readerLayer.innerHTML = `
    <div id="reader-root" class="reader-shell">
      <header class="reader-topbar">
        <button class="icon-button" data-action="close-reader" aria-label="返回">${icon("back")}</button>
        <div class="reader-title">
          <strong>${esc(locked ? chapter.bookTitle || "付费章节" : chapter.bookTitle)}</strong>
          <small>${esc(locked ? chapter.title : chapter.title)}</small>
        </div>
        <button class="icon-button" data-action="reader-settings" aria-label="阅读设置">${icon("settings", 18)}</button>
      </header>
      <main id="reader-scroll" class="reader-scroll">
        ${
          locked
            ? `<section class="locked-page">
                <div>${icon("lock", 34)}</div>
                <h2>故事在这里停顿了一下</h2>
                <p>「${esc(chapter.title)}」需要购买或使用会员权益阅读。${chapter.vipFree ? "开通会员可免费阅读本章。" : ""}</p>
                <div class="locked-preview">${esc(chapter.preview || "")}</div>
                <button class="btn btn-primary btn-block" data-action="unlock-from-reader">
                  解锁本章 · ${money(chapter.displayPriceCents || chapter.priceCents || 0)}
                </button>
                <div class="spacer-8"></div>
                <button class="btn btn-ghost btn-block" data-action="open-membership">了解会员权益</button>
              </section>`
            : `<article class="reader-content" id="reader-content">${esc(chapter.content)}</article>`
        }
      </main>
      <div class="reader-progress"><span id="reader-progress-bar" style="width:0%"></span></div>
      <footer class="reader-toolbar">
        <button class="reader-tool" data-action="reader-prev" ${chapter.previous ? "" : "disabled"}>
          ${icon("back", 18)}<span>上一章</span>
        </button>
        <button class="reader-tool" data-action="reader-settings">
          ${icon("settings", 18)}<span>阅读设置</span>
        </button>
        <button class="reader-tool" data-action="reader-next" ${chapter.next ? "" : "disabled"}>
          ${icon("chevron", 18)}<span>下一章</span>
        </button>
      </footer>
      <aside id="reader-settings-panel" class="reader-settings hidden"></aside>
    </div>
  `;
  applyReaderTheme();
  const scroll = document.querySelector("#reader-scroll");
  if (scroll) {
    scroll.addEventListener("scroll", () => {
      const max = scroll.scrollHeight - scroll.clientHeight;
      const progress = max > 0 ? Math.round((scroll.scrollTop / max) * 100) : 100;
      const bar = document.querySelector("#reader-progress-bar");
      if (bar) bar.style.width = `${progress}%`;
      if (progress !== state.reader.progress && progress % 8 === 0) {
        state.reader.progress = progress;
        saveReadingProgress(progress);
      }
      if (progress > 20) saveReadingProgress(Math.max(progress, 2));
    }, { passive: true });
  }
}

function readerThemeStyle() {
  if (!state.reader) return;
  const settings = state.readerSettings;
  const theme = THEMES[settings.theme] || THEMES.night;
  const root = document.querySelector("#reader-root");
  if (!root) return;
  root.style.setProperty("--reader-bg", settings.background || theme.background);
  root.style.setProperty("--reader-text", settings.text_color || theme.text);
  root.style.setProperty("--reader-size", `${settings.font_size}px`);
  root.style.setProperty("--reader-line", settings.line_height);
  root.style.setProperty(
    "--reader-font",
    settings.font_family === "sans"
      ? '"PingFang SC","Microsoft YaHei",sans-serif'
      : '"Songti SC","STSong","SimSun",serif',
  );
}

function applyReaderTheme() {
  readerThemeStyle();
}

let progressTimer = null;
function saveReadingProgress(percent) {
  if (!state.user || !state.reader || state.reader.locked) return;
  clearTimeout(progressTimer);
  progressTimer = setTimeout(() => {
    api("/api/reading/progress", {
      method: "POST",
      body: {
        bookId: state.reader.chapter.bookId,
        chapterId: state.reader.chapter.id,
        percent,
      },
    }).catch(() => {});
  }, 500);
}

function renderReaderSettings() {
  if (!state.reader || !state.readerSettings) return;
  const panel = document.querySelector("#reader-settings-panel");
  const settings = state.readerSettings;
  panel.classList.toggle("hidden", !state.reader.settingsOpen);
  if (!state.reader.settingsOpen) return;
  panel.innerHTML = `
    <h3>阅读设置</h3>
    <div class="setting-block">
      <div class="setting-label"><span>字号</span><span>${settings.font_size}px</span></div>
      <div class="setting-options">
        ${[16, 17, 18, 19, 20, 22, 24, 26].map((size) => `
          <button class="size-button ${settings.font_size === size ? "active" : ""}" data-action="reader-size" data-value="${size}">${size}</button>
        `).join("")}
      </div>
    </div>
    <div class="setting-block">
      <div class="setting-label"><span>字体</span></div>
      <div class="setting-options">
        <button class="font-button ${settings.font_family === "serif" ? "active" : ""}" data-action="reader-font" data-value="serif" style="font-family:serif">宋体</button>
        <button class="font-button ${settings.font_family === "sans" ? "active" : ""}" data-action="reader-font" data-value="sans">黑体</button>
      </div>
    </div>
    <div class="setting-block">
      <div class="setting-label"><span>背景</span></div>
      <div class="setting-options">
        ${Object.entries(THEMES).map(([key, theme]) => `
          <button class="theme-option ${settings.theme === key ? "active" : ""} ${VIP_THEME_KEYS.has(key) && !state.user?.isVip ? "locked" : ""}"
            data-action="reader-theme" data-value="${key}" title="${theme.label}${VIP_THEME_KEYS.has(key) ? " · 会员专属" : ""}">
            <span class="theme-swatch" style="background:${theme.background};border:5px solid ${theme.background};box-shadow:inset 0 0 0 1px rgba(0,0,0,.1),inset 0 12px 0 ${theme.text}55"></span>
            ${VIP_THEME_KEYS.has(key) && !state.user?.isVip ? `<span class="theme-lock">${icon("lock", 10)}</span>` : ""}
          </button>
        `).join("")}
      </div>
    </div>
    <div class="setting-block">
      <div class="setting-label"><span>自定义颜色</span></div>
      <div class="setting-options">
        <label class="color-control">文字<input type="color" data-color-scope="reader" data-color-field="text_color" value="${esc(settings.text_color || "#e9dfcf")}"></label>
        <label class="color-control">背景<input type="color" data-color-scope="reader" data-color-field="background" value="${esc(settings.background || "#171613")}"></label>
      </div>
    </div>
    <div class="setting-block">
      <div class="setting-label"><span>行距</span></div>
      <div class="setting-options">
        ${[1.6, 1.8, 1.9, 2.1, 2.3].map((line) => `
          <button class="size-button ${Number(settings.line_height) === line ? "active" : ""}" data-action="reader-line" data-value="${line}">${line}</button>
        `).join("")}
      </div>
    </div>
    <div class="setting-block">
      <div class="setting-label"><span>阅读方式</span></div>
      <div class="setting-options">
        <button class="mode-button ${settings.page_mode === "scroll" ? "active" : ""}" data-action="reader-mode" data-value="scroll">滚动</button>
        <button class="mode-button ${settings.page_mode === "paged" ? "active" : ""}" data-action="reader-mode" data-value="paged">分页</button>
      </div>
    </div>
    <button class="btn btn-dark btn-block" data-action="reader-settings-close">完成</button>
  `;
}

async function savePreferences() {
  if (!state.user || !state.readerSettings) return;
  const settings = state.readerSettings;
  try {
    const data = await api("/api/preferences", {
      method: "PUT",
      body: {
        fontSize: settings.font_size,
        fontFamily: settings.font_family,
        theme: settings.theme,
        textColor: settings.text_color,
        background: settings.background,
        lineHeight: settings.line_height,
        pageMode: settings.page_mode,
      },
    });
    state.preferences = data.preferences;
  } catch {
    // Reading settings still apply locally if server sync is temporarily unavailable.
  }
}

function closeReader() {
  const bookId = state.reader?.chapter?.bookId;
  readerLayer.innerHTML = "";
  shell.classList.remove("hidden");
  state.reader = null;
  if (bookId) navigate(`#/book/${bookId}`);
  else navigate(state.returnHash || "#/home");
}

async function refreshUser() {
  const data = await api("/api/session");
  state.user = data.user;
  if (state.home) state.home.user = data.user;
}

async function refreshHome() {
  state.home = await api("/api/home");
  state.user = state.home.user;
}

async function login(account, password) {
  const data = await api("/api/auth/login", {
    method: "POST",
    body: { account, password },
  });
  state.user = data.user;
  state.home = null;
  await refreshHome();
  toast(`欢迎回来，${data.user.nickname}`);
  navigate(state.returnHash || "#/home");
}

async function openBook(bookId) {
  state.returnHash = `#/book/${bookId}`;
  navigate(`#/book/${bookId}`);
}

function openNewBookModal() {
  const categories = state.author?.categories || state.home?.categories || [];
  openModal(`
    <div class="modal-head">
      <div><span class="eyebrow">NEW STORY</span><h2>创建新作品</h2></div>
      <button class="icon-button" data-action="close-modal">${icon("close", 17)}</button>
    </div>
    <form id="book-form">
      <div class="field"><label>书名</label><input class="input" name="title" maxlength="40" placeholder="先给故事一个名字" required></div>
      <div class="field"><label>分类</label>
        <select class="input" name="categoryId" required>
          ${categories.map((category) => `<option value="${category.id}">${esc(category.name)}</option>`).join("")}
        </select>
      </div>
      <div class="field"><label>作品简介</label><textarea class="input" name="summary" maxlength="300" placeholder="用两三句话讲清故事的钩子" required></textarea></div>
      <label class="checkbox-field"><input type="checkbox" name="vipOnly"> 标记为会员书库作品</label>
      <div class="spacer-16"></div>
      <button class="btn btn-primary btn-block" type="submit">创建作品草稿</button>
    </form>
  `);
}

function openNewChapterModal(bookId) {
  const books = state.author?.books || [];
  openModal(`
    <div class="modal-head">
      <div><span class="eyebrow">NEW CHAPTER</span><h2>写下新章节</h2></div>
      <button class="icon-button" data-action="close-modal">${icon("close", 17)}</button>
    </div>
    <form id="chapter-form">
      <div class="field"><label>所属作品</label>
        <select class="input" name="bookId" required>
          ${books.map((book) => `<option value="${book.id}" ${book.id === Number(bookId) ? "selected" : ""}>${esc(book.title)}</option>`).join("")}
        </select>
      </div>
      <div class="field"><label>章节标题</label><input class="input" name="title" maxlength="60" placeholder="例如：雨夜来客" required></div>
      <div class="field"><label>章节正文</label><textarea class="input" name="content" style="min-height:220px" placeholder="从这里开始写…" required></textarea></div>
      <div class="field-row">
        <div class="field"><label>单章价格（元）</label><input class="input" name="price" type="number" min="0" max="50" step="0.01" value="0"></div>
        <div class="field"><label>会员权益</label><label class="checkbox-field" style="min-height:46px"><input type="checkbox" name="vipFree"> 会员免费阅读</label></div>
      </div>
      <p class="form-hint">价格为 0 时是免费章节。提交后进入 Web 管理端审核，草稿则继续保留在作者工作台。</p>
      <div class="field-row">
        <button class="btn btn-light" type="submit" name="action" value="draft">保存草稿</button>
        <button class="btn btn-primary" type="submit" name="action" value="submit">提交审核</button>
      </div>
    </form>
  `);
}

function openTipModal(bookId) {
  if (!state.user) {
    state.returnHash = `#/book/${bookId}`;
    navigate("#/login");
    return;
  }
  openModal(`
    <div class="modal-head">
      <div><span class="eyebrow">SUPPORT THE AUTHOR</span><h2>打赏作者</h2></div>
      <button class="icon-button" data-action="close-modal">${icon("close", 17)}</button>
    </div>
    <form id="tip-form" data-book-id="${bookId}">
      <div class="field-row">
        ${[100, 300, 500, 1000].map((amount) => `
          <button class="mode-button" type="button" data-action="tip-amount" data-value="${amount}">${money(amount)}</button>
        `).join("")}
      </div>
      <div class="field"><label>自定义金额（元）</label><input class="input" name="amount" type="number" min="1" max="1000" value="5" required></div>
      <div class="field"><label>留言（可选）</label><input class="input" name="message" maxlength="80" placeholder="对作者说点什么"></div>
      <button class="btn btn-primary btn-block" type="submit">使用余额打赏</button>
      <p class="text-caption" style="margin:12px 0 0;text-align:center">当前余额 ${money(state.user.balanceCents)} · 作者获得 70% 分成</p>
    </form>
  `);
}

function openNewPostModal() {
  if (!state.user) {
    state.returnHash = "#/forum";
    navigate("#/login");
    return;
  }
  openModal(`
    <div class="modal-head">
      <div><span class="eyebrow">START A CONVERSATION</span><h2>发布社区帖子</h2></div>
      <button class="icon-button" data-action="close-modal">${icon("close", 17)}</button>
    </div>
    <form id="forum-form">
      <div class="field"><label>主题</label>
        <select class="input" name="type">
          <option value="find">找书求助</option>
          <option value="discuss">阅读讨论</option>
          <option value="author">作者交流</option>
        </select>
      </div>
      <div class="field"><label>标题</label><input class="input" name="title" maxlength="80" placeholder="一句话说清想聊什么" required></div>
      <div class="field"><label>正文</label><textarea class="input" name="content" maxlength="2000" placeholder="可以描述剧情、人物或一段模糊记忆" required></textarea></div>
      <button class="btn btn-primary btn-block" type="submit">提交审核并发布</button>
    </form>
  `);
}

function openReplyModal(postId) {
  if (!state.user) {
    state.returnHash = "#/forum";
    navigate("#/login");
    return;
  }
  openModal(`
    <div class="modal-head">
      <div><span class="eyebrow">REPLY</span><h2>回复帖子</h2></div>
      <button class="icon-button" data-action="close-modal">${icon("close", 17)}</button>
    </div>
    <form id="reply-form" data-post-id="${postId}">
      <div class="field"><label>回复内容</label><textarea class="input" name="content" maxlength="500" placeholder="友善地分享你的想法" required></textarea></div>
      <button class="btn btn-primary btn-block" type="submit">发布回复</button>
    </form>
  `);
}

async function handleAction(element) {
  const action = element.dataset.action;
  if (!action) return;
  if (action === "close-modal") closeModal();
  if (action === "reload") location.reload();
  if (action === "go") navigate(element.dataset.path);
  if (action === "back") {
    if (history.length > 1) history.back();
    else navigate("#/home");
  }
  if (action === "open-book") await openBook(Number(element.dataset.id));
  if (action === "browse-category") {
    state.discover.category = Number(element.dataset.id);
    navigate("#/discover");
  }
  if (action === "filter-category") {
    state.discover.category = Number(element.dataset.id);
    await loadDiscoverResults();
  }
  if (action === "filter-sort") {
    state.discover.sort = element.dataset.value;
    await loadDiscoverResults();
  }
  if (action === "detail-tab") {
    state.detailTab = element.dataset.tab;
    renderBookDetailView();
  }
  if (action === "auth-mode") renderAuth(element.dataset.mode);
  if (action === "quick-login") await login(element.dataset.account, "123456");
  if (action === "favorite") await toggleFavorite(Number(element.dataset.id));
  if (action === "open-chapter") {
    const chapter = state.detail?.chapters.find((item) => item.id === Number(element.dataset.id));
    if (chapter?.locked) {
      if (!state.user) {
        state.returnHash = `#/book/${state.detail.id}`;
        navigate("#/login");
      } else {
        showUnlockModal(chapter.id, chapter.title);
      }
    } else {
      await openChapter(Number(element.dataset.id), {
        title: chapter?.title,
        bookTitle: state.detail?.title,
      });
    }
  }
  if (action === "continue-reading") {
    const chapter = state.detail?.chapters.find((item) => item.id === Number(element.dataset.id));
    if (chapter?.locked) showUnlockModal(chapter.id, chapter.title);
    else await openChapter(Number(element.dataset.id));
  }
  if (action === "tip-open") openTipModal(Number(element.dataset.id));
  if (action === "open-membership") showMembershipModal();
  if (action === "open-recharge") showRechargeModal();
  if (action === "show-orders") showOrdersModal();
  if (action === "open-reader-prefs") {
    state.preferences = await loadPreferences();
    showPreferencesModal();
  }
  if (action === "logout") {
    await api("/api/auth/logout", { method: "POST" });
    state.user = null;
    state.home = null;
    state.wallet = null;
    toast("已退出登录");
    navigate("#/home");
  }
  if (action === "apply-author") {
    await api("/api/author/apply", { method: "POST" });
    await refreshUser();
    toast("作者身份已开通");
    await renderAuthor();
  }
  if (action === "new-book") openNewBookModal();
  if (action === "new-chapter") openNewChapterModal(Number(element.dataset.id));
  if (action === "submit-book") {
    await api(`/api/author/books/${element.dataset.id}/submit`, { method: "POST" });
    toast("作品已提交审核");
    await renderAuthor();
  }
  if (action === "forum-filter") {
    state.forumFilter = element.dataset.value;
    await renderForum();
  }
  if (action === "new-post") openNewPostModal();
  if (action === "reply-post") openReplyModal(Number(element.dataset.id));
  if (action === "subscribe-plan") await subscribePlan(Number(element.dataset.id));
  if (action === "recharge-plan") await recharge(Number(element.dataset.id));
  if (action === "confirm-unlock") await unlockChapter(Number(element.dataset.id));
  if (action === "tip-amount") {
    const input = document.querySelector('#tip-form input[name="amount"]');
    if (input) input.value = Number(element.dataset.value) / 100;
  }
  if (action === "close-reader") closeReader();
  if (action === "reader-settings") {
    state.reader.settingsOpen = !state.reader.settingsOpen;
    renderReaderSettings();
  }
  if (action === "reader-settings-close") {
    state.reader.settingsOpen = false;
    renderReaderSettings();
  }
  if (action === "reader-size") await updateReaderSetting("font_size", Number(element.dataset.value));
  if (action === "reader-font") await updateReaderSetting("font_family", element.dataset.value);
  if (action === "reader-theme") {
    if (VIP_THEME_KEYS.has(element.dataset.value) && !state.user?.isVip) {
      toast("该主题为会员专属，开通会员后即可使用", "error");
      return;
    }
    const theme = THEMES[element.dataset.value];
    state.readerSettings.text_color = theme.text;
    state.readerSettings.background = theme.background;
    await updateReaderSetting("theme", element.dataset.value);
  }
  if (action === "reader-line") await updateReaderSetting("line_height", Number(element.dataset.value));
  if (action === "reader-mode") await updateReaderSetting("page_mode", element.dataset.value);
  if (action === "reader-prev" && state.reader?.chapter?.previous) {
    await openChapter(state.reader.chapter.previous.id, { title: state.reader.chapter.previous.title });
  }
  if (action === "reader-next" && state.reader?.chapter?.next) {
    await openChapter(state.reader.chapter.next.id, { title: state.reader.chapter.next.title });
  }
  if (action === "unlock-from-reader") {
    const chapter = state.reader.chapter;
    closeReader();
    showUnlockModal(chapter.chapterId || chapter.id, chapter.title, chapter);
  }
  if (action === "pref-size") await updatePreferenceModal("font_size", Number(element.dataset.value));
  if (action === "pref-font") await updatePreferenceModal("font_family", element.dataset.value);
  if (action === "pref-theme") {
    if (VIP_THEME_KEYS.has(element.dataset.value) && !state.user?.isVip) {
      toast("该主题为会员专属，开通会员后即可使用", "error");
      return;
    }
    const theme = THEMES[element.dataset.value];
    state.preferences = {
      ...(state.preferences || {}),
      theme: element.dataset.value,
      text_color: theme.text,
      background: theme.background,
    };
    await updatePreferenceModal("theme", element.dataset.value);
  }
  if (action === "ui-theme") {
    applyUiTheme(element.dataset.value);
    showPreferencesModal();
    toast(`界面主题已切换为${UI_THEMES[element.dataset.value]?.label || "默认"}`);
  }
  if (action === "pref-mode") await updatePreferenceModal("page_mode", element.dataset.value);
}

async function loadDiscoverResults() {
  try {
    const data = await api(`/api/books?q=${encodeURIComponent(state.discover.query)}&category=${state.discover.category}&sort=${state.discover.sort}&limit=40`);
    state.discover.books = data.books;
    renderDiscoverView();
  } catch (error) {
    toast(error.message, "error");
  }
}

async function toggleFavorite(bookId) {
  if (!state.user) {
    state.returnHash = `#/book/${bookId}`;
    navigate("#/login");
    return;
  }
  try {
    const data = await api(`/api/books/${bookId}/favorite`, { method: "POST" });
    state.detail.isFavorite = data.isFavorite;
    state.detail.favoriteCount += data.isFavorite ? 1 : -1;
    renderBookDetailView();
    toast(data.isFavorite ? "已加入书架" : "已从书架移除");
  } catch (error) {
    toast(error.message, "error");
  }
}

async function unlockChapter(chapterId) {
  if (!state.user) {
    closeModal();
    state.returnHash = `#/book/${state.detail?.id || ""}`;
    navigate("#/login");
    return;
  }
  try {
    const result = await api(`/api/chapters/${chapterId}/unlock`, { method: "POST" });
    await refreshUser();
    closeModal();
    toast(result.chargedCents ? `已扣款 ${money(result.chargedCents)}` : "会员权益已生效");
    await renderBookDetail(state.detail.id, true);
    await openChapter(chapterId);
  } catch (error) {
    toast(error.message, "error");
  }
}

async function subscribePlan(planId) {
  try {
    const result = await api("/api/memberships/subscribe", {
      method: "POST",
      body: { planId },
    });
    closeModal();
    await refreshUser();
    toast(`${result.planName}已开通，会员持续至 ${dateText(result.expiresAt)}`);
    if (location.hash.startsWith("#/me")) await renderMe();
    if (location.hash.startsWith("#/book/") && state.detail) await renderBookDetail(state.detail.id, true);
  } catch (error) {
    toast(error.message, "error");
  }
}

async function recharge(planId) {
  try {
    const result = await api("/api/wallet/recharge", {
      method: "POST",
      body: { planId },
    });
    closeModal();
    await refreshUser();
    toast(`充值成功，到账 ${money(result.creditedCents)}`);
    if (location.hash.startsWith("#/me")) await renderMe();
  } catch (error) {
    toast(error.message, "error");
  }
}

async function updateReaderSetting(key, value) {
  state.readerSettings[key] = value;
  applyReaderTheme();
  renderReaderSettings();
  await savePreferences();
}

async function updatePreferenceModal(key, value) {
  const current = state.preferences || {
    font_size: 19,
    font_family: "serif",
    text_color: "#e9dfcf",
    background: "#171613",
    theme: "night",
    line_height: 1.9,
    page_mode: "scroll",
  };
  state.preferences = { ...current, [key]: value };
  try {
    const data = await api("/api/preferences", {
      method: "PUT",
      body: {
        fontSize: state.preferences.font_size,
        fontFamily: state.preferences.font_family,
        theme: state.preferences.theme,
        textColor: state.preferences.text_color,
        background: state.preferences.background,
        lineHeight: state.preferences.line_height,
        pageMode: state.preferences.page_mode,
      },
    });
    state.preferences = data.preferences;
    showPreferencesModal();
    toast("阅读偏好已同步");
  } catch (error) {
    toast(error.message, "error");
  }
}

async function handleSubmit(event) {
  const form = event.target;
  const id = form.id;
  if (!["home-search-form", "discover-search-form", "login-form", "register-form", "comment-form", "book-form", "chapter-form", "tip-form", "forum-form", "reply-form"].includes(id)) return;
  event.preventDefault();
  const formData = new FormData(form);
  try {
    if (id === "home-search-form" || id === "discover-search-form") {
      state.discover.query = String(formData.get("q") || "").trim();
      state.discover.category = 0;
      if (location.hash !== "#/discover") navigate("#/discover");
      else await loadDiscoverResults();
    }
    if (id === "login-form") {
      await login(String(formData.get("account") || ""), String(formData.get("password") || ""));
    }
    if (id === "register-form") {
      const data = await api("/api/auth/register", {
        method: "POST",
        body: {
          nickname: formData.get("nickname"),
          username: formData.get("username"),
          email: formData.get("email"),
          password: formData.get("password"),
        },
      });
      state.user = data.user;
      state.home = null;
      await refreshHome();
      toast("账号创建成功，10 元阅读余额已到账");
      navigate("#/home");
    }
    if (id === "comment-form") {
      if (!state.user) {
        navigate("#/login");
        return;
      }
      const bookId = Number(form.dataset.bookId);
      await api(`/api/books/${bookId}/comments`, {
        method: "POST",
        body: { content: formData.get("content") },
      });
      toast("书评已发布");
      await renderBookDetail(bookId, true);
      state.detailTab = "comments";
      renderBookDetailView();
    }
    if (id === "book-form") {
      await api("/api/author/books", {
        method: "POST",
        body: {
          title: formData.get("title"),
          summary: formData.get("summary"),
          categoryId: Number(formData.get("categoryId")),
          vipOnly: formData.get("vipOnly") === "on",
        },
      });
      closeModal();
      toast("作品草稿已创建");
      await renderAuthor();
    }
    if (id === "chapter-form") {
      const submit = event.submitter?.value === "submit";
      await api(`/api/author/books/${formData.get("bookId")}/chapters`, {
        method: "POST",
        body: {
          title: formData.get("title"),
          content: formData.get("content"),
          priceCents: Math.round(Number(formData.get("price") || 0) * 100),
          vipFree: formData.get("vipFree") === "on",
          submit,
        },
      });
      closeModal();
      toast(submit ? "章节已提交审核" : "章节草稿已保存");
      await renderAuthor();
    }
    if (id === "tip-form") {
      const amount = Math.round(Number(formData.get("amount")) * 100);
      const result = await api(`/api/books/${form.dataset.bookId}/tips`, {
        method: "POST",
        body: { amountCents: amount, message: formData.get("message") },
      });
      closeModal();
      await refreshUser();
      toast(`已打赏 ${money(result.amountCents)}，感谢你支持作者`);
    }
    if (id === "forum-form") {
      await api("/api/forum/posts", {
        method: "POST",
        body: {
          type: formData.get("type"),
          title: formData.get("title"),
          content: formData.get("content"),
        },
      });
      closeModal();
      toast("帖子已提交，审核通过后公开");
    }
    if (id === "reply-form") {
      await api(`/api/forum/posts/${form.dataset.postId}/replies`, {
        method: "POST",
        body: { content: formData.get("content") },
      });
      closeModal();
      toast("回复已发布");
      await renderForum();
    }
  } catch (error) {
    toast(error.message, "error");
  }
}

async function renderRoute() {
  const hash = location.hash || "#/home";
  const route = hash.split("?")[0];
  modalRoot.innerHTML = "";
  readerLayer.innerHTML = "";
  shell.classList.remove("hidden");
  window.scrollTo({ top: 0 });
  try {
    if (route === "#/home" || route === "#/" || route === "") {
      await renderHome();
    } else if (route === "#/discover") {
      await renderDiscover();
    } else if (route.match(/^#\/book\/\d+$/)) {
      await renderBookDetail(Number(route.split("/").pop()));
    } else if (route === "#/shelf") {
      await renderShelf();
    } else if (route === "#/author") {
      await renderAuthor();
    } else if (route === "#/forum") {
      await renderForum();
    } else if (route === "#/me") {
      await renderMe();
    } else if (route === "#/login") {
      renderAuth("login");
    } else {
      navigate("#/home");
    }
  } catch (error) {
    renderHeader();
    hideNavigation();
    app.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">${icon("book", 28)}</div>
        <h3>这一页暂时没有打开</h3>
        <p>${esc(error.message)}</p>
        <button class="btn btn-primary" data-action="go" data-path="#/home">回到首页</button>
      </div>
    `;
  }
}

async function handleColorChange(event) {
  const input = event.target.closest("[data-color-field]");
  if (!input) return;
  const key = input.dataset.colorField;
  const value = input.value;
  try {
    if (input.dataset.colorScope === "reader" && state.readerSettings) {
      state.readerSettings[key] = value;
      applyReaderTheme();
      await savePreferences();
      toast("阅读颜色已更新");
    } else {
      state.preferences = { ...(state.preferences || {}), [key]: value };
      await updatePreferenceModal(key, value);
    }
  } catch (error) {
    toast(error.message, "error");
  }
}

function applyUiTheme(key = "sand") {
  const selected = UI_THEMES[key] ? key : "sand";
  document.documentElement.dataset.uiTheme = selected;
  localStorage.setItem("xunye_ui_theme", selected);
}

document.addEventListener("click", async (event) => {
  const target = event.target.closest("[data-action]");
  if (!target) return;
  if (event.target.closest(".modal-sheet") && target.classList.contains("modal-backdrop")) return;
  try {
    await handleAction(target);
  } catch (error) {
    toast(error.message || "操作失败", "error");
  }
});

document.addEventListener("submit", handleSubmit);
document.addEventListener("change", handleColorChange);
window.addEventListener("hashchange", renderRoute);
window.addEventListener("scroll", () => {
  if (header && !header.classList.contains("hidden")) {
    header.classList.toggle("scrolled", window.scrollY > 12);
  }
});

async function boot() {
  try {
    applyUiTheme(localStorage.getItem("xunye_ui_theme") || "sand");
    const [session, home] = await Promise.all([
      api("/api/session"),
      api("/api/home"),
    ]);
    state.user = session.user;
    state.home = home;
    state.home.user = session.user;
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    if (!location.hash) location.hash = "#/home";
    await renderRoute();
  } catch (error) {
    app.innerHTML = `
      <div class="page-loading">
        <div class="empty-state-icon">${icon("book", 30)}</div>
        <h3>寻页暂时无法连接</h3>
        <p>${esc(error.message)}</p>
        <button class="btn btn-primary" data-action="reload">重新加载</button>
      </div>
    `;
  }
}

boot();
