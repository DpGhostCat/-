const root = document.querySelector("#admin-root");
const modalRoot = document.querySelector("#admin-modal");
const toastRoot = document.querySelector("#admin-toast");

const state = {
  user: null,
  page: "dashboard",
  overview: null,
  queue: null,
  content: null,
  config: null,
  orders: null,
  contentSearch: "",
};

const PAGE_META = {
  dashboard: ["运营总览", "掌握平台内容、用户与收入变化"],
  review: ["内容审核", "统一处理作品、章节和社区待审内容"],
  content: ["作品与章节", "查看全部作品状态和章节发布情况"],
  users: ["用户与评论", "管理账号状态、会员信息与评论可见性"],
  community: ["论坛审核", "处理找书、讨论与作者交流帖子"],
  config: ["平台配置", "分类、会员、充值档位与公告配置"],
  orders: ["订单与打赏", "查看充值与会员订单、作者打赏流水"],
};

const STATUS = {
  draft: "草稿",
  pending: "待审核",
  published: "已发布",
  rejected: "已驳回",
  active: "正常",
  banned: "已停用",
  hidden: "已隐藏",
  paid: "已支付",
};

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function money(cents) {
  return `¥${(Number(cents || 0) / 100).toFixed(2)}`;
}

function dateTime(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function icon(name, size = 18) {
  const paths = {
    dashboard: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
    review: '<path d="M9 11.5 11.5 14 16 8.5"/><path d="M20 12a8 8 0 1 1-3.1-6.3L21 3v6h-6"/>',
    book: '<path d="M4 4.5h6a3 3 0 0 1 3 3V21a3 3 0 0 0-3-3H4V4.5ZM20 4.5h-4a3 3 0 0 0-3 3V21a3 3 0 0 1 3-3h4V4.5Z"/>',
    users: '<circle cx="9" cy="8" r="3"/><path d="M3.5 20c.4-4 2.4-6 5.5-6s5.1 2 5.5 6"/><circle cx="17" cy="9" r="2.5"/><path d="M15 14c3.2-.8 5.3 1.2 5.5 4.5"/>',
    forum: '<path d="M4 4h16v12H9l-5 4V4Z"/><path d="M8 8h8M8 11.5h5"/>',
    config: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/>',
    orders: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z"/><path d="M9 8h6M9 12h6"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.3 6.7"/><path d="M20 4v7h-7"/>',
    exit: '<path d="M10 4H4v16h6M14 8l4 4-4 4M8 12h10"/>',
    plus: '<path d="M12 4v16M4 12h16"/>',
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
    payload = { ok: false, error: { message: "服务器返回内容无法识别" } };
  }
  if (!response.ok || !payload.ok) {
    const error = new Error(payload.error?.message || "请求失败");
    error.status = response.status;
    error.code = payload.error?.code;
    throw error;
  }
  return payload.data;
}

function toast(message, kind = "info") {
  const item = document.createElement("div");
  item.className = `admin-toast-item ${kind === "error" ? "error" : ""}`;
  item.textContent = message;
  toastRoot.append(item);
  setTimeout(() => item.remove(), 2800);
}

function openModal(content) {
  modalRoot.innerHTML = `
    <div class="admin-modal-backdrop" data-action="close-modal">
      <section class="admin-modal" role="dialog" aria-modal="true">
        ${content}
      </section>
    </div>
  `;
}

function closeModal() {
  modalRoot.innerHTML = "";
}

function renderLogin() {
  root.innerHTML = `
    <section class="login-page">
      <div class="login-visual">
        <p class="login-quote">内容被认真对待，<br>故事才能抵达读者。</p>
        <p class="login-sub">XUNYE CONTENT & OPERATIONS CONSOLE</p>
      </div>
      <div class="login-form-side">
        <div class="login-form-wrap">
          <div class="admin-logo">页</div>
          <h1>进入管理端</h1>
          <p>审核作品、配置会员与充值档位，查看平台运营数据。</p>
          <form id="admin-login-form">
            <div class="login-field">
              <label for="admin-account">管理员账号</label>
              <input id="admin-account" name="account" autocomplete="username" value="admin" required>
            </div>
            <div class="login-field">
              <label for="admin-password">密码</label>
              <input id="admin-password" name="password" type="password" autocomplete="current-password" value="123456" required>
            </div>
            <button class="admin-button dark" type="submit" style="width:100%;min-height:45px">登录管理后台</button>
          </form>
          <div class="demo-login">
            演示管理员：admin / 123456<br>
            本系统当前为比赛演示环境，请勿使用真实支付密码。
          </div>
        </div>
      </div>
    </section>
  `;
}

function navItem(page, label, iconName, count = 0) {
  return `
    <button class="admin-nav-item ${state.page === page ? "active" : ""}" data-action="nav-page" data-page="${page}">
      <span class="admin-nav-icon">${icon(iconName, 16)}</span>
      <span>${label}</span>
      ${count ? `<span class="nav-count">${count}</span>` : ""}
    </button>
  `;
}

function renderShell() {
  const pending = state.overview?.metrics?.pendingReviews || 0;
  root.innerHTML = `
    <div class="admin-layout">
      <aside class="admin-sidebar">
        <div class="admin-brand">
          <div class="admin-logo">页</div>
          <div><strong>寻页</strong><small>STORY ADMIN</small></div>
        </div>
        <div class="admin-section-label">工作台</div>
        <nav class="admin-nav">
          ${navItem("dashboard", "运营总览", "dashboard")}
          ${navItem("review", "内容审核", "review", pending)}
          ${navItem("content", "作品与章节", "book")}
        </nav>
        <div class="admin-section-label">用户与社区</div>
        <nav class="admin-nav">
          ${navItem("users", "用户与评论", "users")}
          ${navItem("community", "论坛审核", "forum", state.queue?.pendingPosts?.length || 0)}
        </nav>
        <div class="admin-section-label">经营配置</div>
        <nav class="admin-nav">
          ${navItem("config", "平台配置", "config")}
          ${navItem("orders", "订单与打赏", "orders")}
        </nav>
        <div class="admin-sidebar-footer">
          <div class="admin-user">
            <span class="admin-avatar">${esc(state.user?.avatar || "管")}</span>
            <div><strong>${esc(state.user?.nickname || "管理员")}</strong><small>平台管理员</small></div>
            <button class="sidebar-exit" data-action="logout" title="退出登录">${icon("exit", 17)}</button>
          </div>
        </div>
      </aside>
      <main class="admin-main">
        <header class="admin-topbar">
          <div><h1>${PAGE_META[state.page][0]}</h1><p>${PAGE_META[state.page][1]}</p></div>
          <div class="topbar-actions">
            <a class="admin-button" href="/" target="_blank" rel="noopener">打开手机端</a>
            <button class="admin-button" data-action="refresh">${icon("refresh", 14)} 刷新</button>
          </div>
        </header>
        <section id="admin-content" class="admin-content">
          <div class="admin-loading" style="min-height:55vh"><div class="admin-logo">页</div><p>正在加载数据…</p></div>
        </section>
      </main>
    </div>
  `;
}

function renderTopbarOnly() {
  const title = root.querySelector(".admin-topbar h1");
  const description = root.querySelector(".admin-topbar p");
  if (title) title.textContent = PAGE_META[state.page][0];
  if (description) description.textContent = PAGE_META[state.page][1];
  root.querySelectorAll(".admin-nav-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.page === state.page);
  });
}

async function loadData(page = state.page) {
  state.page = page;
  const content = document.querySelector("#admin-content");
  if (content) {
    content.innerHTML = '<div class="admin-loading" style="min-height:55vh"><div class="admin-logo">页</div><p>正在加载数据…</p></div>';
  }
  try {
    if (page === "dashboard") {
      state.overview = await api("/api/admin/overview");
      state.queue ||= await api("/api/admin/queue");
      renderDashboard();
    } else if (page === "review") {
      state.queue = await api("/api/admin/queue");
      state.overview = await api("/api/admin/overview");
      renderReview();
    } else if (page === "content") {
      state.content = await api("/api/admin/content");
      renderContent();
    } else if (page === "users") {
      state.queue = await api("/api/admin/queue");
      renderUsers();
    } else if (page === "community") {
      state.queue = await api("/api/admin/queue");
      renderCommunity();
    } else if (page === "config") {
      state.config = await api("/api/admin/config");
      renderConfig();
    } else if (page === "orders") {
      state.orders = await api("/api/admin/orders");
      renderOrders();
    }
    renderTopbarOnly();
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      state.user = null;
      renderLogin();
      toast("管理员会话已失效，请重新登录", "error");
      return;
    }
    content.innerHTML = `<div class="empty-admin"><div><p>${esc(error.message)}</p><button class="admin-button" data-action="refresh">重试</button></div></div>`;
  }
}

function renderDashboard() {
  const data = state.overview;
  const maxRevenue = Math.max(...data.dailyRevenue.map((item) => item.amountCents), 1);
  const maxBook = Math.max(...data.categoryStats.map((item) => Number(item.book_count)), 1);
  const content = document.querySelector("#admin-content");
  content.innerHTML = `
    <div class="admin-page-enter">
      <section class="metric-grid">
        <article class="metric-card">
          <span class="metric-label">累计平台收入</span>
          <strong class="metric-value">${money(data.metrics.revenueCents)}</strong>
          <span class="metric-note">充值与非余额会员订单合计</span>
        </article>
        <article class="metric-card">
          <span class="metric-label">注册用户</span>
          <strong class="metric-value">${data.metrics.totalUsers}</strong>
          <span class="metric-note">不含管理员账号</span>
        </article>
        <article class="metric-card">
          <span class="metric-label">上架作品</span>
          <strong class="metric-value">${data.metrics.totalBooks}</strong>
          <span class="metric-note">已通过审核的书库内容</span>
        </article>
        <article class="metric-card">
          <span class="metric-label">待处理审核</span>
          <strong class="metric-value" style="color:var(--accent)">${data.metrics.pendingReviews}</strong>
          <span class="metric-note">作品、章节与论坛帖子</span>
        </article>
      </section>
      <div class="admin-grid">
        <article class="admin-card">
          <div class="admin-card-head">
            <div><h2>近七日收入</h2><p>按订单支付日期统计</p></div>
            <span class="tag paid">今日 ${data.metrics.todayOrders} 单</span>
          </div>
          <div class="chart">
            ${data.dailyRevenue.map((item) => `
              <div class="chart-bar-wrap">
                <span class="chart-value">${item.amountCents ? money(item.amountCents) : ""}</span>
                <span class="chart-bar" style="height:${Math.max(3, Math.round((item.amountCents / maxRevenue) * 150))}px"></span>
                <span class="chart-label">${Number(item.day.slice(5, 7))}/${Number(item.day.slice(8))}</span>
              </div>
            `).join("")}
          </div>
        </article>
        <article class="admin-card">
          <div class="admin-card-head">
            <div><h2>分类内容分布</h2><p>上架作品数量</p></div>
          </div>
          ${data.categoryStats.map((item) => `
            <div class="category-bar">
              <div class="category-bar-head"><span>${esc(item.name)}</span><span>${item.book_count} 本 · ${item.reads} 阅读</span></div>
              <div class="category-track"><span style="width:${Math.max(3, Math.round((Number(item.book_count) / maxBook) * 100))}%;background:${esc(item.color)}"></span></div>
            </div>
          `).join("")}
        </article>
      </div>
      <article class="admin-card" style="margin-top:15px">
        <div class="admin-card-head">
          <div><h2>最近订单</h2><p>充值、会员订阅与模拟支付记录</p></div>
          <button class="admin-button small" data-action="nav-page" data-page="orders">查看全部</button>
        </div>
        <table class="admin-table">
          <thead><tr><th>订单号</th><th>用户</th><th>类型</th><th>金额</th><th>状态</th><th>支付时间</th></tr></thead>
          <tbody>
            ${data.recentOrders.map((order) => `
              <tr>
                <td class="primary-cell"><strong>${esc(order.order_no)}</strong><small>#${order.id}</small></td>
                <td>${esc(order.nickname)}</td>
                <td>${order.type === "membership" ? "会员订阅" : "余额充值"}</td>
                <td>${money(order.amount_cents)}</td>
                <td><span class="tag ${order.status}">${STATUS[order.status] || order.status}</span></td>
                <td>${dateTime(order.paid_at)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </article>
    </div>
  `;
}

function renderReview() {
  const queue = state.queue;
  const content = document.querySelector("#admin-content");
  content.innerHTML = `
    <div class="admin-page-enter">
      <div class="queue-grid">
        <article class="queue-column">
          <h2>作品审核 <span class="queue-count">${queue.pendingBooks.length}</span></h2>
          ${
            queue.pendingBooks.length
              ? queue.pendingBooks.map((book) => `
                  <div class="review-item">
                    <div class="review-item-head">
                      <div><strong>${esc(book.title)}</strong><span class="tag pending">${esc(book.categoryName)}</span></div>
                      <span class="tag">${esc(book.authorName)}</span>
                    </div>
                    <p>${esc(book.summary)}</p>
                    <div class="review-actions">
                      <button class="admin-button success small" data-action="review-book" data-id="${book.id}" data-decision="approved">通过</button>
                      <button class="admin-button danger small" data-action="reject-review" data-kind="book" data-id="${book.id}" data-title="${esc(book.title)}">驳回</button>
                    </div>
                  </div>
                `).join("")
              : '<div class="empty-admin">暂无待审作品</div>'
          }
        </article>
        <article class="queue-column">
          <h2>章节审核 <span class="queue-count">${queue.pendingChapters.length}</span></h2>
          ${
            queue.pendingChapters.length
              ? queue.pendingChapters.map((chapter) => `
                  <div class="review-item">
                    <div class="review-item-head">
                      <div><strong>${esc(chapter.title)}</strong><span class="tag pending">${esc(chapter.book_title)}</span></div>
                      <span class="tag">${chapter.word_count} 字</span>
                    </div>
                    <p>${esc(chapter.content.slice(0, 130))}</p>
                    <div class="review-actions">
                      <button class="admin-button success small" data-action="review-chapter" data-id="${chapter.id}" data-decision="approved">通过</button>
                      <button class="admin-button danger small" data-action="reject-review" data-kind="chapter" data-id="${chapter.id}" data-title="${esc(chapter.title)}">驳回</button>
                    </div>
                  </div>
                `).join("")
              : '<div class="empty-admin">暂无待审章节</div>'
          }
        </article>
        <article class="queue-column">
          <h2>论坛帖子 <span class="queue-count">${queue.pendingPosts.length}</span></h2>
          ${
            queue.pendingPosts.length
              ? queue.pendingPosts.map((post) => `
                  <div class="review-item">
                    <div class="review-item-head">
                      <div><strong>${esc(post.title)}</strong><span class="tag pending">${post.type === "find" ? "找书" : post.type === "author" ? "作者" : "讨论"}</span></div>
                      <span class="tag">${esc(post.nickname)}</span>
                    </div>
                    <p>${esc(post.content)}</p>
                    <div class="review-actions">
                      <button class="admin-button success small" data-action="review-post" data-id="${post.id}" data-decision="approved">通过</button>
                      <button class="admin-button danger small" data-action="reject-review" data-kind="post" data-id="${post.id}" data-title="${esc(post.title)}">驳回</button>
                    </div>
                  </div>
                `).join("")
              : '<div class="empty-admin">暂无待审帖子</div>'
          }
        </article>
      </div>
    </div>
  `;
}

function renderContent() {
  const content = document.querySelector("#admin-content");
  const search = state.contentSearch.toLowerCase();
  const books = state.content.books.filter((book) =>
    !search || `${book.title} ${book.authorName} ${book.categoryName}`.toLowerCase().includes(search),
  );
  const chapters = state.content.chapters.filter((chapter) =>
    !search || `${chapter.title} ${chapter.book_title} ${chapter.author_name}`.toLowerCase().includes(search),
  );
  content.innerHTML = `
    <div class="admin-page-enter">
      <div class="admin-filters">
        <input class="admin-input admin-search" id="content-search" value="${esc(state.contentSearch)}" placeholder="搜索书名、章节或作者">
        <span class="admin-button" style="pointer-events:none">${books.length} 部作品 · ${chapters.length} 个章节</span>
      </div>
      <article class="admin-card">
        <div class="admin-card-head"><div><h2>作品列表</h2><p>所有状态的作品均在此显示</p></div></div>
        <table class="admin-table">
          <thead><tr><th>作品</th><th>作者</th><th>分类</th><th>状态</th><th>阅读</th><th>收藏</th><th>最近更新</th></tr></thead>
          <tbody>
            ${books.map((book) => `
              <tr>
                <td class="primary-cell"><strong>${esc(book.title)}</strong><small>#${book.id} · ${book.vipOnly ? "会员书库" : "普通书库"}</small></td>
                <td>${esc(book.authorName)}</td>
                <td>${esc(book.categoryName)}</td>
                <td><span class="tag ${book.status}">${STATUS[book.status] || book.status}</span></td>
                <td>${book.readCount}</td>
                <td>${book.favoriteCount}</td>
                <td>${dateTime(book.updatedAt)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </article>
      <article class="admin-card" style="margin-top:15px">
        <div class="admin-card-head"><div><h2>章节列表</h2><p>按最近更新时间排序</p></div></div>
        <table class="admin-table">
          <thead><tr><th>章节</th><th>所属作品</th><th>作者</th><th>字数</th><th>价格</th><th>会员</th><th>状态</th></tr></thead>
          <tbody>
            ${chapters.map((chapter) => `
              <tr>
                <td class="primary-cell"><strong>${esc(chapter.title)}</strong><small>#${chapter.id} · 第 ${chapter.sort_order} 章</small></td>
                <td>${esc(chapter.book_title)}</td>
                <td>${esc(chapter.author_name)}</td>
                <td>${chapter.word_count}</td>
                <td>${chapter.price_cents ? money(chapter.price_cents) : "免费"}</td>
                <td>${chapter.vip_free ? "会员免费" : "—"}</td>
                <td><span class="tag ${chapter.status}">${STATUS[chapter.status] || chapter.status}</span></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </article>
    </div>
  `;
  const input = document.querySelector("#content-search");
  input.addEventListener("input", (event) => {
    state.contentSearch = event.target.value;
    renderContent();
    document.querySelector("#content-search")?.focus();
  });
}

function renderUsers() {
  const { users, comments } = state.queue;
  const content = document.querySelector("#admin-content");
  content.innerHTML = `
    <div class="admin-page-enter">
      <article class="admin-card">
        <div class="admin-card-head"><div><h2>账号管理</h2><p>查看余额、会员有效期与账号状态</p></div></div>
        <table class="admin-table">
          <thead><tr><th>用户</th><th>角色</th><th>余额</th><th>会员到期</th><th>注册时间</th><th>状态</th><th>操作</th></tr></thead>
          <tbody>
            ${users.map((user) => `
              <tr>
                <td class="primary-cell"><strong>${esc(user.nickname)}</strong><small>@${esc(user.username)} · ${esc(user.email)}</small></td>
                <td>${user.role === "admin" ? "管理员" : user.role === "author" ? "作者" : "读者"}</td>
                <td>${money(user.balance_cents)}</td>
                <td>${user.vip_expires_at ? dateTime(user.vip_expires_at) : "未开通"}</td>
                <td>${dateTime(user.created_at)}</td>
                <td><span class="tag ${user.status}">${STATUS[user.status] || user.status}</span></td>
                <td>
                  ${user.role !== "admin" ? `
                    <button class="admin-button ${user.status === "active" ? "danger" : "success"} small"
                      data-action="toggle-user" data-id="${user.id}">
                      ${user.status === "active" ? "停用" : "恢复"}
                    </button>
                  ` : "—"}
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </article>
      <article class="admin-card" style="margin-top:15px">
        <div class="admin-card-head"><div><h2>评论管理</h2><p>隐藏违规评论后，手机端立即不再显示</p></div></div>
        <table class="admin-table">
          <thead><tr><th>评论内容</th><th>用户</th><th>作品</th><th>时间</th><th>状态</th><th>操作</th></tr></thead>
          <tbody>
            ${comments.map((comment) => `
              <tr>
                <td class="primary-cell" style="max-width:430px"><strong>${esc(comment.content)}</strong><small>#${comment.id}</small></td>
                <td>${esc(comment.nickname)}</td>
                <td>${esc(comment.book_title)}</td>
                <td>${dateTime(comment.created_at)}</td>
                <td><span class="tag ${comment.status}">${STATUS[comment.status] || comment.status}</span></td>
                <td>
                  <button class="admin-button ${comment.status === "active" ? "danger" : "success"} small"
                    data-action="toggle-comment" data-id="${comment.id}" data-status="${comment.status}">
                    ${comment.status === "active" ? "隐藏" : "恢复"}
                  </button>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </article>
    </div>
  `;
}

function renderCommunity() {
  const posts = state.queue.pendingPosts;
  const content = document.querySelector("#admin-content");
  content.innerHTML = `
    <div class="admin-page-enter">
      <article class="admin-card">
        <div class="admin-card-head">
          <div><h2>待审核帖子</h2><p>通过后立即出现在手机端社区</p></div>
          <span class="tag pending">${posts.length} 条待处理</span>
        </div>
        <table class="admin-table">
          <thead><tr><th>标题与正文</th><th>作者</th><th>类型</th><th>提交时间</th><th>操作</th></tr></thead>
          <tbody>
            ${posts.map((post) => `
              <tr>
                <td class="primary-cell" style="max-width:560px">
                  <strong>${esc(post.title)}</strong>
                  <small style="line-height:1.6;margin-top:6px">${esc(post.content)}</small>
                </td>
                <td>${esc(post.nickname)}</td>
                <td>${post.type === "find" ? "找书" : post.type === "author" ? "作者" : "讨论"}</td>
                <td>${dateTime(post.created_at)}</td>
                <td>
                  <div class="table-actions">
                    <button class="admin-button success small" data-action="review-post" data-id="${post.id}" data-decision="approved">通过</button>
                    <button class="admin-button danger small" data-action="reject-review" data-kind="post" data-id="${post.id}" data-title="${esc(post.title)}">驳回</button>
                  </div>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
        ${posts.length === 0 ? '<div class="empty-admin">论坛暂无待审核内容</div>' : ""}
      </article>
    </div>
  `;
}

function renderConfig() {
  const { categories, membershipPlans, rechargePlans, notices } = state.config;
  const content = document.querySelector("#admin-content");
  content.innerHTML = `
    <div class="admin-page-enter">
      <div class="config-grid">
        <article class="admin-card">
          <div class="admin-card-head">
            <div><h2>内容分类</h2><p>手机端首页与书城筛选同步</p></div>
            <button class="admin-button small" data-action="add-category">${icon("plus", 13)} 新增分类</button>
          </div>
          ${categories.map((category) => `
            <div class="config-list-item">
              <div><strong>${esc(category.icon)} · ${esc(category.name)}</strong><small>${esc(category.color)} · ${category.active ? "启用" : "停用"}</small></div>
              <button class="admin-button small" data-action="edit-category" data-id="${category.id}">编辑</button>
            </div>
          `).join("")}
        </article>
        <article class="admin-card">
          <div class="admin-card-head">
            <div><h2>会员套餐</h2><p>有效期、价格与购书折扣</p></div>
            <button class="admin-button small" data-action="add-member-plan">${icon("plus", 13)} 新增套餐</button>
          </div>
          ${membershipPlans.map((plan) => `
            <div class="config-list-item">
              <div><strong>${esc(plan.name)} · ${money(plan.price_cents)}</strong><small>${plan.days} 天 · ${plan.discount_percent}% 购书价 · ${plan.active ? "启用" : "停用"}</small></div>
              <button class="admin-button small" data-action="edit-member-plan" data-id="${plan.id}">编辑</button>
            </div>
          `).join("")}
        </article>
        <article class="admin-card">
          <div class="admin-card-head">
            <div><h2>充值档位</h2><p>余额到账金额与赠送额度</p></div>
            <button class="admin-button small" data-action="add-recharge-plan">${icon("plus", 13)} 新增档位</button>
          </div>
          ${rechargePlans.map((plan) => `
            <div class="config-list-item">
              <div><strong>${esc(plan.label)} · ${money(plan.price_cents)}</strong><small>到账 ${money(plan.amount_cents + plan.bonus_cents)} · ${plan.active ? "启用" : "停用"}</small></div>
              <button class="admin-button small" data-action="edit-recharge-plan" data-id="${plan.id}">编辑</button>
            </div>
          `).join("")}
        </article>
        <article class="admin-card">
          <div class="admin-card-head">
            <div><h2>平台公告</h2><p>手机端首页展示最近公告</p></div>
            <button class="admin-button small" data-action="add-notice">${icon("plus", 13)} 发布公告</button>
          </div>
          ${notices.map((notice) => `
            <div class="config-list-item">
              <div><strong>${esc(notice.title)}</strong><small>${dateTime(notice.created_at)} · ${notice.active ? "展示中" : "已停用"}</small></div>
              <span class="tag ${notice.type === "event" ? "pending" : "published"}">${notice.type === "event" ? "活动" : notice.type === "author" ? "作者" : "通知"}</span>
            </div>
          `).join("")}
        </article>
      </div>
    </div>
  `;
}

function renderOrders() {
  const { orders, tips } = state.orders;
  const content = document.querySelector("#admin-content");
  content.innerHTML = `
    <div class="admin-page-enter">
      <section class="metric-grid" style="grid-template-columns:repeat(3,1fr)">
        <article class="metric-card"><span class="metric-label">订单总额</span><strong class="metric-value">${money(orders.reduce((sum, item) => sum + Number(item.amount_cents), 0))}</strong></article>
        <article class="metric-card"><span class="metric-label">会员订单</span><strong class="metric-value">${orders.filter((item) => item.type === "membership").length}</strong></article>
        <article class="metric-card"><span class="metric-label">打赏流水</span><strong class="metric-value">${money(tips.reduce((sum, item) => sum + Number(item.amount_cents), 0))}</strong></article>
      </section>
      <article class="admin-card" style="margin-top:15px">
        <div class="admin-card-head"><div><h2>充值与会员订单</h2><p>模拟在线支付，仅用于业务演示</p></div></div>
        <table class="admin-table">
          <thead><tr><th>订单号</th><th>用户</th><th>类型</th><th>金额</th><th>状态</th><th>支付时间</th></tr></thead>
          <tbody>
            ${orders.map((order) => `
              <tr>
                <td class="primary-cell"><strong>${esc(order.order_no)}</strong><small>#${order.id}</small></td>
                <td>${esc(order.nickname)}<small style="color:var(--muted)"> @${esc(order.username)}</small></td>
                <td>${order.type === "membership" ? "会员订阅" : "余额充值"}</td>
                <td>${money(order.amount_cents)}</td>
                <td><span class="tag ${order.status}">${STATUS[order.status] || order.status}</span></td>
                <td>${dateTime(order.paid_at)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </article>
      <article class="admin-card" style="margin-top:15px">
        <div class="admin-card-head"><div><h2>作品打赏记录</h2><p>读者使用余额打赏，作者获得 70% 分成</p></div></div>
        <table class="admin-table">
          <thead><tr><th>打赏时间</th><th>读者</th><th>作品</th><th>作者</th><th>打赏金额</th><th>作者分成</th><th>留言</th></tr></thead>
          <tbody>
            ${tips.map((tip) => `
              <tr>
                <td>${dateTime(tip.created_at)}</td>
                <td>${esc(tip.reader_name)}</td>
                <td>${esc(tip.book_title)}</td>
                <td>${esc(tip.author_name)}</td>
                <td>${money(tip.amount_cents)}</td>
                <td>${money(tip.author_income_cents)}</td>
                <td>${esc(tip.message || "—")}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </article>
    </div>
  `;
}

function openRejectModal(kind, id, title) {
  openModal(`
    <div class="admin-modal-head">
      <div><h2>填写驳回原因</h2><p>${esc(title)}</p></div>
      <button class="modal-close" data-action="close-modal">×</button>
    </div>
    <form id="reject-form" data-kind="${kind}" data-id="${id}">
      <div class="config-field">
        <label>审核意见</label>
        <textarea class="admin-textarea" name="note" maxlength="200" placeholder="请说明需要作者修改的具体内容" required></textarea>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px">
        <button class="admin-button" type="button" data-action="close-modal">取消</button>
        <button class="admin-button danger" type="submit">确认驳回</button>
      </div>
    </form>
  `);
}

function openCategoryModal(item = null) {
  openModal(`
    <div class="admin-modal-head">
      <div><h2>${item ? "编辑分类" : "新增分类"}</h2><p>分类会同步到手机端首页与书城</p></div>
      <button class="modal-close" data-action="close-modal">×</button>
    </div>
    <form id="category-form">
      <input type="hidden" name="id" value="${item?.id || ""}">
      <div class="config-form">
        <div class="config-field"><label>分类名称</label><input class="admin-input" name="name" maxlength="12" value="${esc(item?.name || "")}" required></div>
        <div class="config-field"><label>单字图标</label><input class="admin-input" name="icon" maxlength="2" value="${esc(item?.icon || "书")}" required></div>
        <div class="config-field"><label>主题色</label><input class="admin-input" name="color" type="color" value="${esc(item?.color || "#7357ff")}"></div>
        <div class="config-field"><label>状态</label><select class="admin-select" name="active"><option value="1" ${item?.active !== 0 ? "selected" : ""}>启用</option><option value="0" ${item?.active === 0 ? "selected" : ""}>停用</option></select></div>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:18px">
        <button class="admin-button" type="button" data-action="close-modal">取消</button>
        <button class="admin-button primary" type="submit">保存分类</button>
      </div>
    </form>
  `);
}

function openMemberPlanModal(item = null) {
  openModal(`
    <div class="admin-modal-head">
      <div><h2>${item ? "编辑会员套餐" : "新增会员套餐"}</h2><p>会员有效期与购书折扣统一在此配置</p></div>
      <button class="modal-close" data-action="close-modal">×</button>
    </div>
    <form id="member-plan-form">
      <input type="hidden" name="id" value="${item?.id || ""}">
      <div class="config-form">
        <div class="config-field"><label>套餐名称</label><input class="admin-input" name="name" value="${esc(item?.name || "")}" required></div>
        <div class="config-field"><label>有效天数</label><input class="admin-input" name="days" type="number" min="1" value="${item?.days || 30}" required></div>
        <div class="config-field"><label>售价（元）</label><input class="admin-input" name="price" type="number" min="0.01" step="0.01" value="${item ? (item.price_cents / 100).toFixed(2) : "18"}" required></div>
        <div class="config-field"><label>原价（元）</label><input class="admin-input" name="originalPrice" type="number" min="0.01" step="0.01" value="${item ? (item.original_price_cents / 100).toFixed(2) : "25"}" required></div>
        <div class="config-field"><label>购书折扣（%）</label><input class="admin-input" name="discount" type="number" min="50" max="100" value="${item?.discount_percent || 90}" required></div>
        <div class="config-field"><label>排序</label><input class="admin-input" name="sortOrder" type="number" value="${item?.sort_order || 99}"></div>
        <div class="config-field full"><label>会员权益（用 | 分隔）</label><input class="admin-input" name="benefits" value="${esc(item?.benefits || "会员书库|付费章节折扣|免广告|专属标识")}" required></div>
        <div class="config-field"><label>推荐</label><select class="admin-select" name="recommended"><option value="0" ${!item?.recommended ? "selected" : ""}>否</option><option value="1" ${item?.recommended ? "selected" : ""}>是</option></select></div>
        <div class="config-field"><label>状态</label><select class="admin-select" name="active"><option value="1" ${item?.active !== 0 ? "selected" : ""}>启用</option><option value="0" ${item?.active === 0 ? "selected" : ""}>停用</option></select></div>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:18px">
        <button class="admin-button" type="button" data-action="close-modal">取消</button>
        <button class="admin-button primary" type="submit">保存套餐</button>
      </div>
    </form>
  `);
}

function openRechargePlanModal(item = null) {
  openModal(`
    <div class="admin-modal-head">
      <div><h2>${item ? "编辑充值档位" : "新增充值档位"}</h2><p>余额与会员相互独立，充值只增加阅读余额</p></div>
      <button class="modal-close" data-action="close-modal">×</button>
    </div>
    <form id="recharge-plan-form">
      <input type="hidden" name="id" value="${item?.id || ""}">
      <div class="config-form">
        <div class="config-field"><label>档位名称</label><input class="admin-input" name="label" value="${esc(item?.label || "")}" required></div>
        <div class="config-field"><label>支付金额（元）</label><input class="admin-input" name="price" type="number" min="0.01" step="0.01" value="${item ? (item.price_cents / 100).toFixed(2) : "30"}" required></div>
        <div class="config-field"><label>基础到账（元）</label><input class="admin-input" name="amount" type="number" min="0.01" step="0.01" value="${item ? (item.amount_cents / 100).toFixed(2) : "30"}" required></div>
        <div class="config-field"><label>赠送余额（元）</label><input class="admin-input" name="bonus" type="number" min="0" step="0.01" value="${item ? (item.bonus_cents / 100).toFixed(2) : "3"}" required></div>
        <div class="config-field"><label>排序</label><input class="admin-input" name="sortOrder" type="number" value="${item?.sort_order || 99}"></div>
        <div class="config-field"><label>推荐</label><select class="admin-select" name="recommended"><option value="0" ${!item?.recommended ? "selected" : ""}>否</option><option value="1" ${item?.recommended ? "selected" : ""}>是</option></select></div>
        <div class="config-field"><label>状态</label><select class="admin-select" name="active"><option value="1" ${item?.active !== 0 ? "selected" : ""}>启用</option><option value="0" ${item?.active === 0 ? "selected" : ""}>停用</option></select></div>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:18px">
        <button class="admin-button" type="button" data-action="close-modal">取消</button>
        <button class="admin-button primary" type="submit">保存档位</button>
      </div>
    </form>
  `);
}

function openNoticeModal() {
  openModal(`
    <div class="admin-modal-head">
      <div><h2>发布平台公告</h2><p>手机端首页显示最新一条公告</p></div>
      <button class="modal-close" data-action="close-modal">×</button>
    </div>
    <form id="notice-form">
      <div class="config-field"><label>公告标题</label><input class="admin-input" name="title" maxlength="50" required></div>
      <div class="config-field"><label>公告内容</label><textarea class="admin-textarea" name="content" maxlength="1000" required></textarea></div>
      <div class="config-field"><label>公告类型</label><select class="admin-select" name="type"><option value="notice">系统通知</option><option value="event">活动公告</option><option value="author">作者通知</option></select></div>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:18px">
        <button class="admin-button" type="button" data-action="close-modal">取消</button>
        <button class="admin-button primary" type="submit">发布公告</button>
      </div>
    </form>
  `);
}

async function reviewBook(id, decision, note = "") {
  await api(`/api/admin/books/${id}/review`, { method: "POST", body: { decision, note } });
  toast(decision === "approved" ? "作品已通过并上架" : "作品已驳回");
  await loadData("review");
}

async function reviewChapter(id, decision, note = "") {
  await api(`/api/admin/chapters/${id}/review`, { method: "POST", body: { decision, note } });
  toast(decision === "approved" ? "章节已通过并发布" : "章节已驳回");
  await loadData("review");
}

async function reviewPost(id, decision, note = "") {
  await api(`/api/admin/forum/${id}/review`, { method: "POST", body: { decision, note } });
  toast(decision === "approved" ? "帖子已通过" : "帖子已驳回");
  await loadData(state.page === "community" ? "community" : "review");
}

async function handleAction(target) {
  const action = target.dataset.action;
  if (!action) return;
  if (action === "close-modal") closeModal();
  if (action === "logout") {
    await api("/api/auth/logout", { method: "POST" });
    state.user = null;
    renderLogin();
  }
  if (action === "nav-page") await loadData(target.dataset.page);
  if (action === "refresh") await loadData(state.page);
  if (action === "review-book") await reviewBook(Number(target.dataset.id), target.dataset.decision);
  if (action === "review-chapter") await reviewChapter(Number(target.dataset.id), target.dataset.decision);
  if (action === "review-post") await reviewPost(Number(target.dataset.id), target.dataset.decision);
  if (action === "reject-review") openRejectModal(target.dataset.kind, Number(target.dataset.id), target.dataset.title);
  if (action === "toggle-comment") {
    const next = target.dataset.status === "active" ? "hidden" : "active";
    await api(`/api/admin/comments/${target.dataset.id}/status`, { method: "POST", body: { status: next } });
    toast(next === "hidden" ? "评论已隐藏" : "评论已恢复");
    await loadData("users");
  }
  if (action === "toggle-user") {
    const result = await api(`/api/admin/users/${target.dataset.id}/status`, { method: "POST" });
    toast(result.status === "banned" ? "账号已停用" : "账号已恢复");
    await loadData("users");
  }
  if (action === "add-category") openCategoryModal();
  if (action === "edit-category") {
    const item = state.config.categories.find((entry) => entry.id === Number(target.dataset.id));
    openCategoryModal(item);
  }
  if (action === "add-member-plan") openMemberPlanModal();
  if (action === "edit-member-plan") {
    const item = state.config.membershipPlans.find((entry) => entry.id === Number(target.dataset.id));
    openMemberPlanModal(item);
  }
  if (action === "add-recharge-plan") openRechargePlanModal();
  if (action === "edit-recharge-plan") {
    const item = state.config.rechargePlans.find((entry) => entry.id === Number(target.dataset.id));
    openRechargePlanModal(item);
  }
  if (action === "add-notice") openNoticeModal();
}

async function handleSubmit(event) {
  const form = event.target;
  const id = form.id;
  if (!["admin-login-form", "reject-form", "category-form", "member-plan-form", "recharge-plan-form", "notice-form"].includes(id)) return;
  event.preventDefault();
  const formData = new FormData(form);
  try {
    if (id === "admin-login-form") {
      const data = await api("/api/auth/login", {
        method: "POST",
        body: { account: formData.get("account"), password: formData.get("password") },
      });
      if (data.user.role !== "admin") {
        await api("/api/auth/logout", { method: "POST" });
        throw new Error("该账号不是管理员");
      }
      state.user = data.user;
      state.overview = await api("/api/admin/overview");
      state.queue = await api("/api/admin/queue");
      state.page = "dashboard";
      renderShell();
      await loadData("dashboard");
      toast("已进入管理后台");
    }
    if (id === "reject-form") {
      const kind = form.dataset.kind;
      const targetId = Number(form.dataset.id);
      const note = String(formData.get("note") || "");
      if (kind === "book") await reviewBook(targetId, "rejected", note);
      if (kind === "chapter") await reviewChapter(targetId, "rejected", note);
      if (kind === "post") await reviewPost(targetId, "rejected", note);
      closeModal();
    }
    if (id === "category-form") {
      await api("/api/admin/categories", {
        method: "POST",
        body: {
          id: formData.get("id") || null,
          name: formData.get("name"),
          icon: formData.get("icon"),
          color: formData.get("color"),
          active: formData.get("active") === "1",
        },
      });
      closeModal();
      toast("分类配置已保存");
      await loadData("config");
    }
    if (id === "member-plan-form") {
      await api("/api/admin/membership-plans", {
        method: "POST",
        body: {
          id: formData.get("id") || null,
          name: formData.get("name"),
          days: Number(formData.get("days")),
          priceCents: Math.round(Number(formData.get("price")) * 100),
          originalPriceCents: Math.round(Number(formData.get("originalPrice")) * 100),
          benefits: formData.get("benefits"),
          discountPercent: Number(formData.get("discount")),
          recommended: formData.get("recommended") === "1",
          active: formData.get("active") === "1",
          sortOrder: Number(formData.get("sortOrder")),
        },
      });
      closeModal();
      toast("会员套餐已保存，手机端将同步");
      await loadData("config");
    }
    if (id === "recharge-plan-form") {
      await api("/api/admin/recharge-plans", {
        method: "POST",
        body: {
          id: formData.get("id") || null,
          label: formData.get("label"),
          amountCents: Math.round(Number(formData.get("amount")) * 100),
          bonusCents: Math.round(Number(formData.get("bonus")) * 100),
          priceCents: Math.round(Number(formData.get("price")) * 100),
          recommended: formData.get("recommended") === "1",
          active: formData.get("active") === "1",
          sortOrder: Number(formData.get("sortOrder")),
        },
      });
      closeModal();
      toast("充值档位已保存");
      await loadData("config");
    }
    if (id === "notice-form") {
      await api("/api/admin/notices", {
        method: "POST",
        body: {
          title: formData.get("title"),
          content: formData.get("content"),
          type: formData.get("type"),
        },
      });
      closeModal();
      toast("公告已发布");
      await loadData("config");
    }
  } catch (error) {
    toast(error.message, "error");
  }
}

document.addEventListener("click", async (event) => {
  const target = event.target.closest("[data-action]");
  if (!target) return;
  try {
    await handleAction(target);
  } catch (error) {
    toast(error.message || "操作失败", "error");
  }
});
document.addEventListener("submit", handleSubmit);

async function boot() {
  try {
    const session = await api("/api/session");
    if (!session.user || session.user.role !== "admin") {
      renderLogin();
      return;
    }
    state.user = session.user;
    state.overview = await api("/api/admin/overview");
    state.queue = await api("/api/admin/queue");
    renderShell();
    await loadData("dashboard");
  } catch {
    renderLogin();
  }
}

boot();
