const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { randomBytes, randomUUID } = require("node:crypto");
const {
  addDays,
  createDb,
  hashPassword,
  iso,
  orderNo,
  tokenHash,
  transaction,
  verifyPassword,
} = require("./db");

const PUBLIC_DIR = path.join(__dirname, "..", "public");
const MAX_BODY_BYTES = 1024 * 1024;
const SESSION_DAYS = 7;

class HttpError extends Error {
  constructor(status, code, message, details = null) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function json(status, data, extraHeaders = {}) {
  return {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...extraHeaders,
    },
    data,
  };
}

function success(data, status = 200, extraHeaders = {}) {
  return json(status, { ok: true, data }, extraHeaders);
}

function fail(status, code, message, details = null) {
  return json(status, { ok: false, error: { code, message, details } });
}

function asNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value)));
}

function nowVip(vipExpiresAt) {
  return Boolean(vipExpiresAt && new Date(vipExpiresAt).getTime() > Date.now());
}

function vipDaysLeft(vipExpiresAt) {
  if (!nowVip(vipExpiresAt)) return 0;
  return Math.max(1, Math.ceil((new Date(vipExpiresAt).getTime() - Date.now()) / 86_400_000));
}

function publicUser(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    username: row.username,
    email: row.email,
    role: row.role,
    nickname: row.nickname,
    avatar: row.avatar,
    bio: row.bio,
    balanceCents: Number(row.balance_cents),
    isVip: nowVip(row.vip_expires_at),
    vipExpiresAt: row.vip_expires_at,
    vipDaysLeft: vipDaysLeft(row.vip_expires_at),
    status: row.status,
    createdAt: row.created_at,
  };
}

function parseCookies(header = "") {
  const output = {};
  for (const piece of header.split(";")) {
    const index = piece.indexOf("=");
    if (index < 1) continue;
    const key = piece.slice(0, index).trim();
    const value = piece.slice(index + 1).trim();
    try {
      output[key] = decodeURIComponent(value);
    } catch {
      output[key] = value;
    }
  }
  return output;
}

function cookieHeader(token, req, maxAge = SESSION_DAYS * 86_400) {
  const secure = process.env.COOKIE_SECURE === "1" || Boolean(req.socket.encrypted);
  return [
    `xunye_session=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
    secure ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

async function readJson(req) {
  let total = 0;
  const chunks = [];
  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_BODY_BYTES) {
      throw new HttpError(413, "BODY_TOO_LARGE", "请求内容超过 1 MB 限制");
    }
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  const raw = Buffer.concat(chunks).toString("utf8");
  try {
    return JSON.parse(raw);
  } catch {
    throw new HttpError(400, "INVALID_JSON", "请求内容不是有效的 JSON");
  }
}

function text(value, maxLength, field, { required = false } = {}) {
  const result = String(value ?? "").trim();
  if (required && !result) {
    throw new HttpError(400, "VALIDATION_ERROR", `${field}不能为空`);
  }
  if (result.length > maxLength) {
    throw new HttpError(400, "VALIDATION_ERROR", `${field}不能超过 ${maxLength} 个字符`);
  }
  return result;
}

function currentSession(db, req) {
  const token = parseCookies(req.headers.cookie).xunye_session;
  if (!token) return null;
  const row = db.prepare(`
    SELECT u.*, s.expires_at AS session_expires_at
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ?
  `).get(tokenHash(token));
  if (!row) return null;
  if (new Date(row.session_expires_at).getTime() <= Date.now() || row.status !== "active") {
    db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash(token));
    return null;
  }
  return row;
}

function requireUser(user) {
  if (!user) throw new HttpError(401, "UNAUTHORIZED", "请先登录后再继续");
  return user;
}

function requireAuthor(user) {
  requireUser(user);
  if (user.role !== "author" && user.role !== "admin") {
    throw new HttpError(403, "AUTHOR_REQUIRED", "请先申请成为作者");
  }
  return user;
}

function requireAdmin(user) {
  requireUser(user);
  if (user.role !== "admin") {
    throw new HttpError(403, "ADMIN_REQUIRED", "仅管理员可以访问此功能");
  }
  return user;
}

function getVipDiscount(db, user) {
  if (!user || !nowVip(user.vip_expires_at)) return 100;
  const row = db.prepare(`
    SELECT mp.discount_percent
    FROM orders o
    JOIN membership_plans mp ON mp.id = o.plan_id
    WHERE o.user_id = ? AND o.type = 'membership' AND o.status = 'paid'
    ORDER BY o.created_at DESC
    LIMIT 1
  `).get(user.id);
  return row ? Number(row.discount_percent) : 100;
}

function chapterPriceForUser(db, user, chapter) {
  const price = Number(chapter.price_cents);
  if (price <= 0) return 0;
  const discount = getVipDiscount(db, user);
  return Math.max(1, Math.round((price * discount) / 100));
}

function chapterAccess(db, user, chapter) {
  if (Number(chapter.price_cents) === 0) {
    return { allowed: true, reason: "free" };
  }
  if (!user) {
    return { allowed: false, reason: "login" };
  }
  if (user.role === "admin") {
    return { allowed: true, reason: "admin" };
  }
  const purchased = db.prepare(
    "SELECT 1 FROM purchases WHERE user_id = ? AND chapter_id = ?",
  ).get(user.id, chapter.id);
  if (purchased) return { allowed: true, reason: "purchased" };
  if (Number(chapter.vip_free) === 1 && nowVip(user.vip_expires_at)) {
    return { allowed: true, reason: "vip" };
  }
  return { allowed: false, reason: "purchase" };
}

function serializeBook(row) {
  return {
    id: Number(row.id),
    authorId: Number(row.author_id),
    authorName: row.author_name,
    authorAvatar: row.author_avatar,
    categoryId: Number(row.category_id),
    categoryName: row.category_name,
    categoryColor: row.category_color,
    title: row.title,
    summary: row.summary,
    cover: {
      start: row.cover_start,
      end: row.cover_end,
      symbol: row.cover_symbol,
    },
    status: row.status,
    serialStatus: row.serial_status,
    vipOnly: Boolean(row.vip_only),
    featured: Boolean(row.featured),
    reviewNote: row.review_note,
    readCount: Number(row.read_count),
    favoriteCount: Number(row.favorite_count),
    rating: Number(row.rating),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const BOOK_SELECT = `
  SELECT b.*, c.name AS category_name, c.color AS category_color,
         u.nickname AS author_name, u.avatar AS author_avatar
  FROM books b
  JOIN categories c ON c.id = b.category_id
  JOIN users u ON u.id = b.author_id
`;

function listBooks(db, { query = "", category = 0, sort = "hot", limit = 20 } = {}) {
  const orderMap = {
    hot: "b.featured DESC, b.read_count DESC",
    new: "b.created_at DESC",
    updated: "b.updated_at DESC",
    rating: "b.rating DESC, b.read_count DESC",
  };
  const where = ["b.status = 'published'"];
  const params = [];
  if (query) {
    where.push("(b.title LIKE ? OR b.summary LIKE ? OR u.nickname LIKE ?)");
    const needle = `%${query}%`;
    params.push(needle, needle, needle);
  }
  if (Number(category) > 0) {
    where.push("b.category_id = ?");
    params.push(Number(category));
  }
  params.push(clamp(limit, 1, 60));
  return db.prepare(`
    ${BOOK_SELECT}
    WHERE ${where.join(" AND ")}
    ORDER BY ${orderMap[sort] || orderMap.hot}
    LIMIT ?
  `).all(...params).map(serializeBook);
}

function getPublishedBook(db, id) {
  return db.prepare(`
    ${BOOK_SELECT}
    WHERE b.id = ? AND b.status = 'published'
  `).get(id);
}

function getBookForViewer(db, id, user) {
  const row = db.prepare(`${BOOK_SELECT} WHERE b.id = ?`).get(id);
  if (!row) throw new HttpError(404, "BOOK_NOT_FOUND", "没有找到这本书");
  const canPreview = row.status === "published" || user?.role === "admin" || user?.id === row.author_id;
  if (!canPreview) throw new HttpError(404, "BOOK_NOT_FOUND", "没有找到这本书");

  const favorite = user
    ? db.prepare("SELECT 1 FROM favorites WHERE user_id = ? AND book_id = ?").get(user.id, id)
    : null;
  const progress = user
    ? db.prepare("SELECT * FROM reading_progress WHERE user_id = ? AND book_id = ?").get(user.id, id)
    : null;
  const chapters = db.prepare(`
    SELECT c.*, EXISTS(
      SELECT 1 FROM purchases p WHERE p.user_id = ? AND p.chapter_id = c.id
    ) AS purchased
    FROM chapters c
    WHERE c.book_id = ? AND (c.status = 'published' OR ? = 1)
    ORDER BY c.sort_order, c.id
  `).all(user?.id || 0, id, user?.role === "admin" || user?.id === row.author_id ? 1 : 0);

  const serializedChapters = chapters.map((chapter) => {
    const access = chapterAccess(db, user, chapter);
    return {
      id: Number(chapter.id),
      title: chapter.title,
      wordCount: Number(chapter.word_count),
      priceCents: Number(chapter.price_cents),
      displayPriceCents: chapterPriceForUser(db, user, chapter),
      vipFree: Boolean(chapter.vip_free),
      status: chapter.status,
      sortOrder: Number(chapter.sort_order),
      publishedAt: chapter.published_at,
      purchased: Boolean(chapter.purchased),
      locked: !access.allowed,
      accessReason: access.reason,
    };
  });

  const comments = db.prepare(`
    SELECT c.*, u.nickname, u.avatar, u.role
           , u.vip_expires_at
    FROM comments c
    JOIN users u ON u.id = c.user_id
    WHERE c.book_id = ? AND c.status = 'active'
    ORDER BY c.created_at DESC
    LIMIT 30
  `).all(id).map((comment) => ({
    id: Number(comment.id),
    content: comment.content,
    likeCount: Number(comment.like_count),
    createdAt: comment.created_at,
    user: {
      nickname: comment.nickname,
      avatar: comment.avatar,
      role: comment.role,
      isVip: nowVip(comment.vip_expires_at),
    },
  }));

  return {
    ...serializeBook(row),
    isFavorite: Boolean(favorite),
    progress: progress
      ? {
          chapterId: Number(progress.chapter_id),
          percent: Number(progress.percent),
          updatedAt: progress.updated_at,
        }
      : null,
    chapters: serializedChapters,
    comments,
    vipDiscountPercent: getVipDiscount(db, user),
  };
}

function loginRateLimit(store, key) {
  const now = Date.now();
  const entry = store.get(key);
  if (!entry || now - entry.startedAt > 10 * 60_000) {
    store.set(key, { startedAt: now, count: 1 });
    return;
  }
  entry.count += 1;
  if (entry.count > 10) {
    throw new HttpError(429, "TOO_MANY_ATTEMPTS", "登录尝试过于频繁，请稍后再试");
  }
}

async function handleApi(req, res, db, pathname, url) {
  const user = currentSession(db, req);
  let match;

  if (req.method === "GET" && pathname === "/api/health") {
    return success({ service: "xunye", status: "ok", time: iso() });
  }

  if (req.method === "GET" && pathname === "/api/session") {
    return success({ user: publicUser(user) });
  }

  if (req.method === "POST" && pathname === "/api/auth/login") {
    loginRateLimit(handleApi.loginAttempts, req.socket.remoteAddress || "local");
    const body = await readJson(req);
    const account = text(body.account, 120, "账号", { required: true });
    const password = text(body.password, 120, "密码", { required: true });
    const row = db.prepare(
      "SELECT * FROM users WHERE username = ? OR email = ? LIMIT 1",
    ).get(account, account);
    if (!row || !verifyPassword(password, row.password_salt, row.password_hash)) {
      throw new HttpError(401, "INVALID_CREDENTIALS", "账号或密码错误");
    }
    if (row.status !== "active") {
      throw new HttpError(403, "ACCOUNT_BANNED", "该账号已被停用，请联系管理员");
    }
    const token = randomBytes(32).toString("base64url");
    db.prepare(`
      INSERT INTO sessions (token_hash, user_id, expires_at, created_at)
      VALUES (?, ?, ?, ?)
    `).run(tokenHash(token), row.id, addDays(SESSION_DAYS), iso());
    return success(
      { user: publicUser(row) },
      200,
      { "Set-Cookie": cookieHeader(token, req) },
    );
  }

  if (req.method === "POST" && pathname === "/api/auth/register") {
    const body = await readJson(req);
    const username = text(body.username, 24, "用户名", { required: true });
    const email = text(body.email, 120, "邮箱", { required: true }).toLowerCase();
    const password = String(body.password ?? "");
    const nickname = text(body.nickname || username, 16, "昵称", { required: true });
    if (!/^[a-zA-Z0-9_\u4e00-\u9fa5]{3,24}$/.test(username)) {
      throw new HttpError(400, "VALIDATION_ERROR", "用户名需为 3-24 位中文、字母、数字或下划线");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new HttpError(400, "VALIDATION_ERROR", "请输入有效邮箱");
    }
    if (password.length < 6 || password.length > 72) {
      throw new HttpError(400, "VALIDATION_ERROR", "密码长度需为 6-72 位");
    }
    const hashed = hashPassword(password);
    let userId;
    try {
      userId = transaction(db, () => {
        const created = db.prepare(`
          INSERT INTO users
          (username, email, password_hash, password_salt, role, nickname, avatar, bio,
           balance_cents, vip_expires_at, status, created_at)
          VALUES (?, ?, ?, ?, 'reader', ?, ?, '', 1000, NULL, 'active', ?)
        `).run(
          username,
          email,
          hashed.hash,
          hashed.salt,
          nickname,
          nickname.slice(0, 1),
          iso(),
        );
        const id = Number(created.lastInsertRowid);
        const now = iso();
        db.prepare(`
          INSERT INTO reader_preferences
          (user_id, font_size, font_family, text_color, background, theme, line_height, page_mode, updated_at)
          VALUES (?, 19, 'serif', '#e9dfcf', '#171613', 'night', 1.9, 'scroll', ?)
        `).run(id, now);
        db.prepare(`
          INSERT INTO wallet_transactions
          (user_id, type, amount_cents, balance_after_cents, description, order_no, created_at)
          VALUES (?, 'signup_bonus', 1000, 1000, '新用户阅读余额', NULL, ?)
        `).run(id, now);
        return id;
      });
    } catch (error) {
      if (String(error.message).includes("UNIQUE")) {
        throw new HttpError(409, "ACCOUNT_EXISTS", "用户名或邮箱已被使用");
      }
      throw error;
    }
    const row = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
    const token = randomBytes(32).toString("base64url");
    db.prepare(`
      INSERT INTO sessions (token_hash, user_id, expires_at, created_at)
      VALUES (?, ?, ?, ?)
    `).run(tokenHash(token), userId, addDays(SESSION_DAYS), iso());
    return success(
      { user: publicUser(row) },
      201,
      { "Set-Cookie": cookieHeader(token, req) },
    );
  }

  if (req.method === "POST" && pathname === "/api/auth/logout") {
    const token = parseCookies(req.headers.cookie).xunye_session;
    if (token) db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash(token));
    return success(
      { loggedOut: true },
      200,
      { "Set-Cookie": cookieHeader("", req, 0) },
    );
  }

  if (req.method === "GET" && pathname === "/api/home") {
    const notices = db.prepare(
      "SELECT id, title, content, type, created_at FROM notices WHERE active = 1 ORDER BY created_at DESC LIMIT 5",
    ).all();
    const categories = db.prepare(
      "SELECT id, name, color, icon FROM categories WHERE active = 1 ORDER BY sort_order, id",
    ).all();
    const highestDiscount = db.prepare(
      "SELECT MIN(discount_percent) AS discount FROM membership_plans WHERE active = 1",
    ).get().discount;
    return success({
      user: publicUser(user),
      notices,
      categories,
      featured: listBooks(db, { limit: 4 }),
      hot: listBooks(db, { sort: "hot", limit: 8 }),
      latest: listBooks(db, { sort: "new", limit: 6 }),
      membershipPlans: db.prepare(
        "SELECT * FROM membership_plans WHERE active = 1 ORDER BY sort_order, id",
      ).all(),
      vipDiscountPercent: Number(highestDiscount || 100),
    });
  }

  if (req.method === "GET" && pathname === "/api/categories") {
    return success(
      db.prepare(
        "SELECT id, name, color, icon FROM categories WHERE active = 1 ORDER BY sort_order, id",
      ).all(),
    );
  }

  if (req.method === "GET" && pathname === "/api/books") {
    const query = text(url.searchParams.get("q"), 80, "搜索词");
    const category = asNumber(url.searchParams.get("category"), 0);
    const sort = url.searchParams.get("sort") || "hot";
    const limit = asNumber(url.searchParams.get("limit"), 30);
    return success({ books: listBooks(db, { query, category, sort, limit }) });
  }

  if (req.method === "GET" && (match = pathname.match(/^\/api\/books\/(\d+)$/))) {
    return success({ book: getBookForViewer(db, Number(match[1]), user) });
  }

  if (req.method === "POST" && (match = pathname.match(/^\/api\/books\/(\d+)\/favorite$/))) {
    requireUser(user);
    const bookId = Number(match[1]);
    const book = getPublishedBook(db, bookId);
    if (!book) throw new HttpError(404, "BOOK_NOT_FOUND", "没有找到这本书");
    const existing = db.prepare(
      "SELECT 1 FROM favorites WHERE user_id = ? AND book_id = ?",
    ).get(user.id, bookId);
    transaction(db, () => {
      if (existing) {
        db.prepare("DELETE FROM favorites WHERE user_id = ? AND book_id = ?").run(user.id, bookId);
        db.prepare("UPDATE books SET favorite_count = MAX(0, favorite_count - 1) WHERE id = ?").run(bookId);
      } else {
        db.prepare(
          "INSERT INTO favorites (user_id, book_id, created_at) VALUES (?, ?, ?)",
        ).run(user.id, bookId, iso());
        db.prepare("UPDATE books SET favorite_count = favorite_count + 1 WHERE id = ?").run(bookId);
      }
    });
    return success({ isFavorite: !existing });
  }

  if (req.method === "POST" && (match = pathname.match(/^\/api\/books\/(\d+)\/comments$/))) {
    requireUser(user);
    const bookId = Number(match[1]);
    if (!getPublishedBook(db, bookId)) throw new HttpError(404, "BOOK_NOT_FOUND", "没有找到这本书");
    const body = await readJson(req);
    const content = text(body.content, 500, "书评", { required: true });
    const result = db.prepare(`
      INSERT INTO comments (user_id, book_id, parent_id, content, status, like_count, created_at)
      VALUES (?, ?, NULL, ?, 'active', 0, ?)
    `).run(user.id, bookId, content, iso());
    return success(
      {
        comment: {
          id: Number(result.lastInsertRowid),
          content,
          likeCount: 0,
          createdAt: iso(),
          user: { nickname: user.nickname, avatar: user.avatar, role: user.role },
        },
      },
      201,
    );
  }

  if (req.method === "POST" && (match = pathname.match(/^\/api\/books\/(\d+)\/tips$/))) {
    requireUser(user);
    const bookId = Number(match[1]);
    const book = getPublishedBook(db, bookId);
    if (!book) throw new HttpError(404, "BOOK_NOT_FOUND", "没有找到这本书");
    const body = await readJson(req);
    const amountCents = Math.round(asNumber(body.amountCents, 0));
    if (amountCents < 100 || amountCents > 100_000) {
      throw new HttpError(400, "INVALID_AMOUNT", "打赏金额需在 1 至 1000 元之间");
    }
    if (Number(user.balance_cents) < amountCents) {
      throw new HttpError(402, "INSUFFICIENT_BALANCE", "余额不足，请先充值");
    }
    const message = text(body.message, 80, "打赏留言");
    const authorIncome = Math.floor(amountCents * 0.7);
    const reference = orderNo("TIP");
    transaction(db, () => {
      db.prepare("UPDATE users SET balance_cents = balance_cents - ? WHERE id = ?").run(
        amountCents,
        user.id,
      );
      db.prepare("UPDATE users SET balance_cents = balance_cents + ? WHERE id = ?").run(
        authorIncome,
        book.author_id,
      );
      const balanceAfter = Number(
        db.prepare("SELECT balance_cents FROM users WHERE id = ?").get(user.id).balance_cents,
      );
      db.prepare(`
        INSERT INTO tips
        (user_id, author_id, book_id, amount_cents, author_income_cents, message, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(user.id, book.author_id, bookId, amountCents, authorIncome, message, iso());
      db.prepare(`
        INSERT INTO wallet_transactions
        (user_id, type, amount_cents, balance_after_cents, description, order_no, created_at)
        VALUES (?, 'tip_out', ?, ?, ?, ?, ?)
      `).run(user.id, -amountCents, balanceAfter, `打赏《${book.title}》`, reference, iso());
      db.prepare(`
        INSERT INTO wallet_transactions
        (user_id, type, amount_cents, balance_after_cents, description, order_no, created_at)
        VALUES (?, 'tip_in', ?, ?, ?, ?, ?)
      `).run(
        book.author_id,
        authorIncome,
        Number(db.prepare("SELECT balance_cents FROM users WHERE id = ?").get(book.author_id).balance_cents),
        `收到《${book.title}》打赏分成`,
        reference,
        iso(),
      );
    });
    return success({ tipped: true, amountCents, authorIncomeCents: authorIncome });
  }

  if (req.method === "GET" && (match = pathname.match(/^\/api\/chapters\/(\d+)$/))) {
    const chapterId = Number(match[1]);
    const chapter = db.prepare(`
      SELECT c.*, b.title AS book_title, b.author_id, b.status AS book_status
      FROM chapters c
      JOIN books b ON b.id = c.book_id
      WHERE c.id = ?
    `).get(chapterId);
    if (!chapter) throw new HttpError(404, "CHAPTER_NOT_FOUND", "没有找到这一章");
    const ownerPreview = user?.role === "admin" || user?.id === chapter.author_id;
    if (chapter.status !== "published" && !ownerPreview) {
      throw new HttpError(404, "CHAPTER_NOT_FOUND", "没有找到这一章");
    }
    if (chapter.book_status !== "published" && !ownerPreview) {
      throw new HttpError(404, "CHAPTER_NOT_FOUND", "没有找到这一章");
    }
    const access = chapterAccess(db, user, chapter);
    if (!access.allowed) {
      return json(402, {
        ok: false,
        error: {
          code: "CHAPTER_LOCKED",
          message: access.reason === "login" ? "登录后可购买或使用会员权益阅读" : "本章需要购买或开通会员",
          details: {
            chapterId,
            preview: chapter.content.slice(0, 160),
            priceCents: Number(chapter.price_cents),
            displayPriceCents: chapterPriceForUser(db, user, chapter),
            vipFree: Boolean(chapter.vip_free),
            accessReason: access.reason,
          },
        },
      });
    }

    const neighbors = db.prepare(`
      SELECT id, title, sort_order
      FROM chapters
      WHERE book_id = ? AND status = 'published'
      ORDER BY sort_order, id
    `).all(chapter.book_id);
    const index = neighbors.findIndex((item) => Number(item.id) === chapterId);
    const previous = index > 0 ? neighbors[index - 1] : null;
    const next = index >= 0 && index < neighbors.length - 1 ? neighbors[index + 1] : null;
    db.prepare("UPDATE books SET read_count = read_count + 1 WHERE id = ?").run(chapter.book_id);
    if (user && chapter.status === "published") {
      db.prepare(`
        INSERT INTO reading_progress (user_id, book_id, chapter_id, percent, updated_at)
        VALUES (?, ?, ?, 1, ?)
        ON CONFLICT(user_id, book_id) DO UPDATE SET
          chapter_id = excluded.chapter_id,
          percent = excluded.percent,
          updated_at = excluded.updated_at
      `).run(user.id, chapter.book_id, chapterId, iso());
    }
    return success({
      chapter: {
        id: Number(chapter.id),
        bookId: Number(chapter.book_id),
        bookTitle: chapter.book_title,
        title: chapter.title,
        content: chapter.content,
        wordCount: Number(chapter.word_count),
        priceCents: Number(chapter.price_cents),
        vipFree: Boolean(chapter.vip_free),
        status: chapter.status,
        accessReason: access.reason,
        previous: previous ? { id: Number(previous.id), title: previous.title } : null,
        next: next ? { id: Number(next.id), title: next.title } : null,
      },
    });
  }

  if (req.method === "POST" && (match = pathname.match(/^\/api\/chapters\/(\d+)\/unlock$/))) {
    requireUser(user);
    const chapterId = Number(match[1]);
    const chapter = db.prepare(`
      SELECT c.*, b.title AS book_title
      FROM chapters c JOIN books b ON b.id = c.book_id
      WHERE c.id = ? AND c.status = 'published' AND b.status = 'published'
    `).get(chapterId);
    if (!chapter) throw new HttpError(404, "CHAPTER_NOT_FOUND", "没有找到这一章");
    const access = chapterAccess(db, user, chapter);
    if (access.allowed) {
      return success({
        unlocked: true,
        chargedCents: 0,
        reason: access.reason,
        balanceCents: Number(user.balance_cents),
      });
    }
    const price = chapterPriceForUser(db, user, chapter);
    if (Number(user.balance_cents) < price) {
      throw new HttpError(402, "INSUFFICIENT_BALANCE", "余额不足，请先充值");
    }
    let balanceAfter;
    transaction(db, () => {
      db.prepare("UPDATE users SET balance_cents = balance_cents - ? WHERE id = ?").run(price, user.id);
      db.prepare(
        "INSERT INTO purchases (user_id, chapter_id, amount_cents, created_at) VALUES (?, ?, ?, ?)",
      ).run(user.id, chapterId, price, iso());
      balanceAfter = Number(
        db.prepare("SELECT balance_cents FROM users WHERE id = ?").get(user.id).balance_cents,
      );
      db.prepare(`
        INSERT INTO wallet_transactions
        (user_id, type, amount_cents, balance_after_cents, description, order_no, created_at)
        VALUES (?, 'chapter_purchase', ?, ?, ?, ?, ?)
      `).run(
        user.id,
        -price,
        balanceAfter,
        `购买《${chapter.book_title}》·${chapter.title}`,
        orderNo("CH"),
        iso(),
      );
    });
    return success({ unlocked: true, chargedCents: price, balanceCents: balanceAfter });
  }

  if (req.method === "POST" && pathname === "/api/reading/progress") {
    requireUser(user);
    const body = await readJson(req);
    const bookId = asNumber(body.bookId);
    const chapterId = asNumber(body.chapterId);
    const chapter = db.prepare(
      "SELECT 1 FROM chapters WHERE id = ? AND book_id = ? AND status = 'published'",
    ).get(chapterId, bookId);
    if (!chapter) throw new HttpError(404, "CHAPTER_NOT_FOUND", "阅读进度对应的章节不存在");
    const percent = clamp(asNumber(body.percent, 0), 0, 100);
    db.prepare(`
      INSERT INTO reading_progress (user_id, book_id, chapter_id, percent, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(user_id, book_id) DO UPDATE SET
        chapter_id = excluded.chapter_id,
        percent = excluded.percent,
        updated_at = excluded.updated_at
    `).run(user.id, bookId, chapterId, percent, iso());
    return success({ saved: true, percent });
  }

  if (req.method === "GET" && pathname === "/api/shelf") {
    requireUser(user);
    const rows = db.prepare(`
      SELECT b.*, c.name AS category_name, c.color AS category_color,
             u.nickname AS author_name, u.avatar AS author_avatar,
             rp.chapter_id AS progress_chapter_id,
             rp.percent AS progress_percent,
             rp.updated_at AS progress_updated_at,
             rpc.title AS progress_chapter_title
      FROM books b
      JOIN categories c ON c.id = b.category_id
      JOIN users u ON u.id = b.author_id
      JOIN favorites f ON f.book_id = b.id
      LEFT JOIN reading_progress rp ON rp.book_id = b.id AND rp.user_id = f.user_id
      LEFT JOIN chapters rpc ON rpc.id = rp.chapter_id
      WHERE f.user_id = ?
      ORDER BY f.created_at DESC
    `).all(user.id);
    return success({
      books: rows.map((row) => ({
        ...serializeBook(row),
        progress: row.progress_chapter_id
          ? {
              chapterId: Number(row.progress_chapter_id),
              chapterTitle: row.progress_chapter_title,
              percent: Number(row.progress_percent),
              updatedAt: row.progress_updated_at,
            }
          : null,
      })),
    });
  }

  if (req.method === "GET" && pathname === "/api/preferences") {
    requireUser(user);
    const preferences = db.prepare("SELECT * FROM reader_preferences WHERE user_id = ?").get(user.id);
    return success({ preferences });
  }

  if (req.method === "PUT" && pathname === "/api/preferences") {
    requireUser(user);
    const body = await readJson(req);
    const fontSizes = [16, 17, 18, 19, 20, 22, 24, 26];
    const fonts = ["serif", "sans"];
    const themes = ["night", "paper", "green", "blue", "rose"];
    const pageModes = ["scroll", "paged"];
    const fontSize = Number(body.fontSize);
    const fontFamily = String(body.fontFamily);
    const theme = String(body.theme);
    const pageMode = String(body.pageMode);
    const lineHeight = clamp(asNumber(body.lineHeight, 1.9), 1.4, 2.4);
    const vipThemes = new Set(["blue", "rose"]);
    if (vipThemes.has(theme) && !nowVip(user.vip_expires_at) && user.role !== "admin") {
      throw new HttpError(403, "VIP_THEME_REQUIRED", "该阅读主题为会员专属权益");
    }
    if (!fontSizes.includes(fontSize) || !fonts.includes(fontFamily) ||
        !themes.includes(theme) || !pageModes.includes(pageMode)) {
      throw new HttpError(400, "VALIDATION_ERROR", "阅读偏好参数无效");
    }
    const palette = {
      night: { text: "#e9dfcf", background: "#171613" },
      paper: { text: "#3d352b", background: "#f3ead8" },
      green: { text: "#344538", background: "#dfe8d9" },
      blue: { text: "#304657", background: "#dfe9ec" },
      rose: { text: "#513b3d", background: "#f1e1df" },
    }[theme];
    const textColor = /^#[0-9a-fA-F]{6}$/.test(body.textColor || "")
      ? body.textColor
      : palette.text;
    const background = /^#[0-9a-fA-F]{6}$/.test(body.background || "")
      ? body.background
      : palette.background;
    db.prepare(`
      UPDATE reader_preferences SET
        font_size = ?, font_family = ?, text_color = ?, background = ?,
        theme = ?, line_height = ?, page_mode = ?, updated_at = ?
      WHERE user_id = ?
    `).run(
      fontSize,
      fontFamily,
      textColor,
      background,
      theme,
      lineHeight,
      pageMode,
      iso(),
      user.id,
    );
    return success({
      preferences: db.prepare("SELECT * FROM reader_preferences WHERE user_id = ?").get(user.id),
    });
  }

  if (req.method === "GET" && pathname === "/api/wallet") {
    requireUser(user);
    const balanceRow = db.prepare("SELECT balance_cents, vip_expires_at FROM users WHERE id = ?").get(user.id);
    const transactions = db.prepare(`
      SELECT id, type, amount_cents, balance_after_cents, description, order_no, created_at
      FROM wallet_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 30
    `).all(user.id);
    const orders = db.prepare(`
      SELECT id, order_no, type, plan_id, amount_cents, status, paid_at, created_at
      FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 20
    `).all(user.id);
    const plans = db.prepare(
      "SELECT * FROM recharge_plans WHERE active = 1 ORDER BY sort_order, id",
    ).all();
    const membershipPlans = db.prepare(
      "SELECT * FROM membership_plans WHERE active = 1 ORDER BY sort_order, id",
    ).all();
    return success({
      balanceCents: Number(balanceRow.balance_cents),
      isVip: nowVip(balanceRow.vip_expires_at),
      vipExpiresAt: balanceRow.vip_expires_at,
      vipDaysLeft: vipDaysLeft(balanceRow.vip_expires_at),
      transactions,
      orders,
      rechargePlans: plans,
      membershipPlans,
    });
  }

  if (req.method === "POST" && pathname === "/api/wallet/recharge") {
    requireUser(user);
    const body = await readJson(req);
    const plan = db.prepare(
      "SELECT * FROM recharge_plans WHERE id = ? AND active = 1",
    ).get(asNumber(body.planId));
    if (!plan) throw new HttpError(404, "PLAN_NOT_FOUND", "充值档位不存在或已下架");
    const credited = Number(plan.amount_cents) + Number(plan.bonus_cents);
    const reference = orderNo("RC");
    let balanceAfter;
    transaction(db, () => {
      db.prepare("UPDATE users SET balance_cents = balance_cents + ? WHERE id = ?").run(
        credited,
        user.id,
      );
      balanceAfter = Number(
        db.prepare("SELECT balance_cents FROM users WHERE id = ?").get(user.id).balance_cents,
      );
      db.prepare(`
        INSERT INTO orders
        (order_no, user_id, type, plan_id, amount_cents, status, paid_at, created_at)
        VALUES (?, ?, 'recharge', ?, ?, 'paid', ?, ?)
      `).run(reference, user.id, plan.id, Number(plan.price_cents), iso(), iso());
      db.prepare(`
        INSERT INTO wallet_transactions
        (user_id, type, amount_cents, balance_after_cents, description, order_no, created_at)
        VALUES (?, 'recharge', ?, ?, ?, ?, ?)
      `).run(
        user.id,
        credited,
        balanceAfter,
        `充值 ${plan.label}${Number(plan.bonus_cents) > 0 ? "，含赠送余额" : ""}`,
        reference,
        iso(),
      );
    });
    return success({ paid: true, creditedCents: credited, balanceCents: balanceAfter, orderNo: reference });
  }

  if (req.method === "POST" && pathname === "/api/memberships/subscribe") {
    requireUser(user);
    const body = await readJson(req);
    const plan = db.prepare(
      "SELECT * FROM membership_plans WHERE id = ? AND active = 1",
    ).get(asNumber(body.planId));
    if (!plan) throw new HttpError(404, "PLAN_NOT_FOUND", "会员套餐不存在或已下架");
    const base = user.vip_expires_at && new Date(user.vip_expires_at).getTime() > Date.now()
      ? new Date(user.vip_expires_at)
      : new Date();
    const expiresAt = addDays(Number(plan.days), base);
    const reference = orderNo("VIP");
    transaction(db, () => {
      db.prepare("UPDATE users SET vip_expires_at = ? WHERE id = ?").run(expiresAt, user.id);
      db.prepare(`
        INSERT INTO orders
        (order_no, user_id, type, plan_id, amount_cents, status, paid_at, created_at)
        VALUES (?, ?, 'membership', ?, ?, 'paid', ?, ?)
      `).run(reference, user.id, plan.id, Number(plan.price_cents), iso(), iso());
    });
    return success({
      subscribed: true,
      planName: plan.name,
      expiresAt,
      vipDaysLeft: vipDaysLeft(expiresAt),
      orderNo: reference,
    });
  }

  if (req.method === "GET" && pathname === "/api/forum") {
    const filter = url.searchParams.get("type") || "all";
    const params = [];
    let where = "p.status = 'active'";
    if (["find", "discuss", "author"].includes(filter)) {
      where += " AND p.type = ?";
      params.push(filter);
    }
    const posts = db.prepare(`
      SELECT p.*, u.nickname, u.avatar, u.role,
        (SELECT COUNT(*) FROM forum_replies r WHERE r.post_id = p.id AND r.status = 'active') AS reply_count
      FROM forum_posts p JOIN users u ON u.id = p.user_id
      WHERE ${where}
      ORDER BY p.created_at DESC LIMIT 30
    `).all(...params);
    const replies = db.prepare(`
      SELECT r.*, u.nickname, u.avatar
      FROM forum_replies r JOIN users u ON u.id = r.user_id
      WHERE r.status = 'active'
      ORDER BY r.created_at ASC
    `).all();
    return success({
      posts: posts.map((post) => ({
        id: Number(post.id),
        title: post.title,
        content: post.content,
        type: post.type,
        views: Number(post.views),
        likes: Number(post.likes),
        replyCount: Number(post.reply_count),
        createdAt: post.created_at,
        user: { nickname: post.nickname, avatar: post.avatar, role: post.role },
        replies: replies
          .filter((reply) => Number(reply.post_id) === Number(post.id))
          .map((reply) => ({
            id: Number(reply.id),
            content: reply.content,
            createdAt: reply.created_at,
            user: { nickname: reply.nickname, avatar: reply.avatar },
          })),
      })),
    });
  }

  if (req.method === "POST" && pathname === "/api/forum/posts") {
    requireUser(user);
    const body = await readJson(req);
    const title = text(body.title, 80, "帖子标题", { required: true });
    const content = text(body.content, 2000, "帖子正文", { required: true });
    const type = ["find", "discuss", "author"].includes(body.type) ? body.type : "discuss";
    const result = db.prepare(`
      INSERT INTO forum_posts
      (user_id, title, content, type, status, views, likes, created_at)
      VALUES (?, ?, ?, ?, 'pending', 0, 0, ?)
    `).run(user.id, title, content, type, iso());
    return success({ id: Number(result.lastInsertRowid), message: "帖子已提交，管理员审核后公开" }, 201);
  }

  if (req.method === "POST" && (match = pathname.match(/^\/api\/forum\/posts\/(\d+)\/replies$/))) {
    requireUser(user);
    const post = db.prepare(
      "SELECT id FROM forum_posts WHERE id = ? AND status = 'active'",
    ).get(Number(match[1]));
    if (!post) throw new HttpError(404, "POST_NOT_FOUND", "帖子不存在或尚未通过审核");
    const body = await readJson(req);
    const content = text(body.content, 500, "回复", { required: true });
    const result = db.prepare(`
      INSERT INTO forum_replies (post_id, user_id, content, status, created_at)
      VALUES (?, ?, ?, 'active', ?)
    `).run(post.id, user.id, content, iso());
    return success({ id: Number(result.lastInsertRowid), content }, 201);
  }

  if (req.method === "POST" && pathname === "/api/author/apply") {
    requireUser(user);
    if (user.role === "reader") {
      db.prepare("UPDATE users SET role = 'author' WHERE id = ?").run(user.id);
    }
    return success({ role: user.role === "reader" ? "author" : user.role });
  }

  if (req.method === "GET" && pathname === "/api/author/overview") {
    requireAuthor(user);
    const books = db.prepare(`
      ${BOOK_SELECT}
      WHERE b.author_id = ?
      ORDER BY b.updated_at DESC
    `).all(user.id).map((row) => {
      const chapters = db.prepare(`
        SELECT id, title, status, price_cents, vip_free, word_count, sort_order, review_note, updated_at
        FROM chapters WHERE book_id = ? ORDER BY sort_order DESC, id DESC
      `).all(row.id);
      return {
        ...serializeBook(row),
        chapters: chapters.map((chapter) => ({
          id: Number(chapter.id),
          title: chapter.title,
          status: chapter.status,
          priceCents: Number(chapter.price_cents),
          vipFree: Boolean(chapter.vip_free),
          wordCount: Number(chapter.word_count),
          sortOrder: Number(chapter.sort_order),
          reviewNote: chapter.review_note,
          updatedAt: chapter.updated_at,
        })),
      };
    });
    const receivedTips = Number(db.prepare(
      "SELECT COALESCE(SUM(author_income_cents), 0) AS total FROM tips WHERE author_id = ?",
    ).get(user.id).total);
    return success({
      user: publicUser(user),
      categories: db.prepare(
        "SELECT id, name, color, icon FROM categories WHERE active = 1 ORDER BY sort_order",
      ).all(),
      books,
      stats: {
        bookCount: books.length,
        publishedCount: books.filter((book) => book.status === "published").length,
        totalReads: books.reduce((sum, book) => sum + book.readCount, 0),
        totalFavorites: books.reduce((sum, book) => sum + book.favoriteCount, 0),
        authorIncomeCents: receivedTips,
      },
    });
  }

  if (req.method === "POST" && pathname === "/api/author/books") {
    requireAuthor(user);
    const body = await readJson(req);
    const title = text(body.title, 40, "书名", { required: true });
    const summary = text(body.summary, 300, "作品简介", { required: true });
    const categoryId = asNumber(body.categoryId);
    const category = db.prepare(
      "SELECT * FROM categories WHERE id = ? AND active = 1",
    ).get(categoryId);
    if (!category) throw new HttpError(400, "VALIDATION_ERROR", "请选择有效分类");
    const palettes = [
      ["#202c49", "#7357ff"],
      ["#3d2922", "#ef7c57"],
      ["#113b43", "#25a9a2"],
      ["#35204c", "#ba76e8"],
      ["#67502e", "#f2b35e"],
    ];
    const [start, end] = palettes[Math.floor(Math.random() * palettes.length)];
    const result = db.prepare(`
      INSERT INTO books
      (author_id, category_id, title, summary, cover_start, cover_end, cover_symbol, status,
       serial_status, vip_only, featured, review_note, read_count, favorite_count, rating, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', 'serial', ?, 0, '', 0, 0, 0, ?, ?)
    `).run(
      user.id,
      category.id,
      title,
      summary,
      start,
      end,
      title.slice(0, 1),
      body.vipOnly ? 1 : 0,
      iso(),
      iso(),
    );
    return success({ bookId: Number(result.lastInsertRowid), status: "draft" }, 201);
  }

  if (req.method === "POST" && (match = pathname.match(/^\/api\/author\/books\/(\d+)\/chapters$/))) {
    requireAuthor(user);
    const book = db.prepare(
      "SELECT * FROM books WHERE id = ? AND author_id = ?",
    ).get(Number(match[1]), user.id);
    if (!book) throw new HttpError(404, "BOOK_NOT_FOUND", "作品不存在或不属于当前作者");
    const body = await readJson(req);
    const title = text(body.title, 60, "章节标题", { required: true });
    const content = text(body.content, 100_000, "章节正文", { required: true });
    const priceCents = clamp(Math.round(asNumber(body.priceCents, 0)), 0, 5000);
    const submit = Boolean(body.submit);
    const maxSort = Number(db.prepare(
      "SELECT COALESCE(MAX(sort_order), 0) AS value FROM chapters WHERE book_id = ?",
    ).get(book.id).value);
    const result = db.prepare(`
      INSERT INTO chapters
      (book_id, title, content, word_count, price_cents, vip_free, status, review_note,
       sort_order, published_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, '', ?, NULL, ?, ?)
    `).run(
      book.id,
      title,
      content,
      content.length,
      priceCents,
      body.vipFree ? 1 : 0,
      submit ? "pending" : "draft",
      maxSort + 1,
      iso(),
      iso(),
    );
    if (submit) {
      db.prepare(`
        UPDATE books SET status = CASE WHEN status = 'published' THEN status ELSE 'pending' END,
        updated_at = ? WHERE id = ?
      `).run(iso(), book.id);
    }
    return success({ chapterId: Number(result.lastInsertRowid), status: submit ? "pending" : "draft" }, 201);
  }

  if (req.method === "POST" && (match = pathname.match(/^\/api\/author\/books\/(\d+)\/submit$/))) {
    requireAuthor(user);
    const book = db.prepare(
      "SELECT * FROM books WHERE id = ? AND author_id = ?",
    ).get(Number(match[1]), user.id);
    if (!book) throw new HttpError(404, "BOOK_NOT_FOUND", "作品不存在或不属于当前作者");
    const chapterCount = Number(db.prepare(
      "SELECT COUNT(*) AS count FROM chapters WHERE book_id = ? AND status != 'draft'",
    ).get(book.id).count);
    if (chapterCount === 0) {
      throw new HttpError(400, "NO_CHAPTER", "请至少提交一章后再申请作品审核");
    }
    db.prepare("UPDATE books SET status = 'pending', updated_at = ? WHERE id = ?").run(iso(), book.id);
    return success({ status: "pending" });
  }

  if (req.method === "GET" && pathname === "/api/admin/overview") {
    requireAdmin(user);
    const today = iso().slice(0, 10);
    const metrics = {
      totalUsers: Number(db.prepare("SELECT COUNT(*) AS n FROM users WHERE role != 'admin'").get().n),
      totalBooks: Number(db.prepare("SELECT COUNT(*) AS n FROM books WHERE status = 'published'").get().n),
      pendingReviews: Number(db.prepare(
        "SELECT (SELECT COUNT(*) FROM books WHERE status = 'pending') + (SELECT COUNT(*) FROM chapters WHERE status = 'pending') + (SELECT COUNT(*) FROM forum_posts WHERE status = 'pending') AS n",
      ).get().n),
      revenueCents: Number(db.prepare(
        "SELECT COALESCE(SUM(amount_cents), 0) AS n FROM orders WHERE status = 'paid'",
      ).get().n),
      tipsCents: Number(db.prepare("SELECT COALESCE(SUM(amount_cents), 0) AS n FROM tips").get().n),
      todayOrders: Number(db.prepare(
        "SELECT COUNT(*) AS n FROM orders WHERE status = 'paid' AND substr(paid_at, 1, 10) = ?",
      ).get(today).n),
    };
    const dailyRevenue = [];
    for (let offset = 6; offset >= 0; offset -= 1) {
      const day = new Date(Date.now() - offset * 86_400_000).toISOString().slice(0, 10);
      const amount = Number(db.prepare(`
        SELECT COALESCE(SUM(amount_cents), 0) AS n FROM orders
        WHERE status = 'paid' AND substr(paid_at, 1, 10) = ?
      `).get(day).n);
      dailyRevenue.push({ day, amountCents: amount });
    }
    const categoryStats = db.prepare(`
      SELECT c.name, c.color, COUNT(b.id) AS book_count, COALESCE(SUM(b.read_count), 0) AS reads
      FROM categories c LEFT JOIN books b ON b.category_id = c.id AND b.status = 'published'
      GROUP BY c.id ORDER BY book_count DESC, reads DESC
    `).all();
    const recentOrders = db.prepare(`
      SELECT o.*, u.nickname FROM orders o JOIN users u ON u.id = o.user_id
      ORDER BY o.created_at DESC LIMIT 8
    `).all();
    return success({ metrics, dailyRevenue, categoryStats, recentOrders });
  }

  if (req.method === "GET" && pathname === "/api/admin/queue") {
    requireAdmin(user);
    const pendingBooks = db.prepare(`
      ${BOOK_SELECT} WHERE b.status = 'pending' ORDER BY b.updated_at DESC
    `).all().map(serializeBook);
    const pendingChapters = db.prepare(`
      SELECT c.*, b.title AS book_title, u.nickname AS author_name
      FROM chapters c JOIN books b ON b.id = c.book_id JOIN users u ON u.id = b.author_id
      WHERE c.status = 'pending' ORDER BY c.updated_at DESC
    `).all();
    const pendingPosts = db.prepare(`
      SELECT p.*, u.nickname FROM forum_posts p JOIN users u ON u.id = p.user_id
      WHERE p.status = 'pending' ORDER BY p.created_at DESC
    `).all();
    const users = db.prepare(`
      SELECT id, username, email, role, nickname, avatar, balance_cents, vip_expires_at, status, created_at
      FROM users ORDER BY created_at DESC LIMIT 80
    `).all();
    const comments = db.prepare(`
      SELECT c.*, u.nickname, b.title AS book_title
      FROM comments c JOIN users u ON u.id = c.user_id JOIN books b ON b.id = c.book_id
      ORDER BY c.created_at DESC LIMIT 80
    `).all();
    return success({ pendingBooks, pendingChapters, pendingPosts, users, comments });
  }

  if (req.method === "GET" && pathname === "/api/admin/content") {
    requireAdmin(user);
    const books = db.prepare(`
      ${BOOK_SELECT}
      ORDER BY b.updated_at DESC
    `).all().map(serializeBook);
    const chapters = db.prepare(`
      SELECT c.*, b.title AS book_title, u.nickname AS author_name
      FROM chapters c
      JOIN books b ON b.id = c.book_id
      JOIN users u ON u.id = b.author_id
      ORDER BY c.updated_at DESC
    `).all();
    return success({ books, chapters });
  }

  if (req.method === "POST" && (match = pathname.match(/^\/api\/admin\/books\/(\d+)\/review$/))) {
    requireAdmin(user);
    const body = await readJson(req);
    const decision = body.decision === "approved" ? "published" : "rejected";
    const note = text(body.note, 200, "审核意见");
    const book = db.prepare("SELECT * FROM books WHERE id = ?").get(Number(match[1]));
    if (!book) throw new HttpError(404, "BOOK_NOT_FOUND", "作品不存在");
    transaction(db, () => {
      db.prepare("UPDATE books SET status = ?, review_note = ?, updated_at = ? WHERE id = ?").run(
        decision,
        note,
        iso(),
        book.id,
      );
      if (decision === "published") {
        db.prepare(
          "UPDATE chapters SET status = 'published', published_at = COALESCE(published_at, ?) WHERE book_id = ? AND status = 'pending'",
        ).run(iso(), book.id);
      }
      db.prepare(`
        INSERT INTO admin_actions
        (admin_id, action, target_type, target_id, note, created_at)
        VALUES (?, ?, 'book', ?, ?, ?)
      `).run(user.id, `book_${decision}`, book.id, note, iso());
    });
    return success({ status: decision });
  }

  if (req.method === "POST" && (match = pathname.match(/^\/api\/admin\/chapters\/(\d+)\/review$/))) {
    requireAdmin(user);
    const body = await readJson(req);
    const decision = body.decision === "approved" ? "published" : "rejected";
    const note = text(body.note, 200, "审核意见");
    const chapter = db.prepare("SELECT * FROM chapters WHERE id = ?").get(Number(match[1]));
    if (!chapter) throw new HttpError(404, "CHAPTER_NOT_FOUND", "章节不存在");
    transaction(db, () => {
      db.prepare(
        "UPDATE chapters SET status = ?, review_note = ?, published_at = COALESCE(published_at, ?), updated_at = ? WHERE id = ?",
      ).run(decision, note, iso(), iso(), chapter.id);
      if (decision === "published") {
        db.prepare(
          "UPDATE books SET status = 'published', updated_at = ? WHERE id = ? AND status = 'pending'",
        ).run(iso(), chapter.book_id);
      }
      db.prepare(`
        INSERT INTO admin_actions
        (admin_id, action, target_type, target_id, note, created_at)
        VALUES (?, ?, 'chapter', ?, ?, ?)
      `).run(user.id, `chapter_${decision}`, chapter.id, note, iso());
    });
    return success({ status: decision });
  }

  if (req.method === "POST" && (match = pathname.match(/^\/api\/admin\/forum\/(\d+)\/review$/))) {
    requireAdmin(user);
    const body = await readJson(req);
    const status = body.decision === "approved" ? "active" : "rejected";
    const post = db.prepare("SELECT * FROM forum_posts WHERE id = ?").get(Number(match[1]));
    if (!post) throw new HttpError(404, "POST_NOT_FOUND", "帖子不存在");
    db.prepare("UPDATE forum_posts SET status = ? WHERE id = ?").run(status, post.id);
    db.prepare(`
      INSERT INTO admin_actions
      (admin_id, action, target_type, target_id, note, created_at)
      VALUES (?, ?, 'forum_post', ?, ?, ?)
    `).run(user.id, `forum_${status}`, post.id, text(body.note, 200, "审核意见"), iso());
    return success({ status });
  }

  if (req.method === "POST" && (match = pathname.match(/^\/api\/admin\/comments\/(\d+)\/status$/))) {
    requireAdmin(user);
    const body = await readJson(req);
    const status = body.status === "hidden" ? "hidden" : "active";
    const comment = db.prepare("SELECT id FROM comments WHERE id = ?").get(Number(match[1]));
    if (!comment) throw new HttpError(404, "COMMENT_NOT_FOUND", "评论不存在");
    db.prepare("UPDATE comments SET status = ? WHERE id = ?").run(status, comment.id);
    return success({ status });
  }

  if (req.method === "POST" && (match = pathname.match(/^\/api\/admin\/users\/(\d+)\/status$/))) {
    requireAdmin(user);
    const targetId = Number(match[1]);
    if (targetId === Number(user.id)) {
      throw new HttpError(400, "INVALID_ACTION", "不能停用当前管理员账号");
    }
    const target = db.prepare("SELECT * FROM users WHERE id = ?").get(targetId);
    if (!target) throw new HttpError(404, "USER_NOT_FOUND", "用户不存在");
    if (target.role === "admin") {
      throw new HttpError(400, "INVALID_ACTION", "不能在此停用管理员账号");
    }
    const status = target.status === "active" ? "banned" : "active";
    db.prepare("UPDATE users SET status = ? WHERE id = ?").run(status, target.id);
    if (status === "banned") db.prepare("DELETE FROM sessions WHERE user_id = ?").run(target.id);
    return success({ status });
  }

  if (req.method === "GET" && pathname === "/api/admin/config") {
    requireAdmin(user);
    return success({
      categories: db.prepare("SELECT * FROM categories ORDER BY sort_order, id").all(),
      membershipPlans: db.prepare("SELECT * FROM membership_plans ORDER BY sort_order, id").all(),
      rechargePlans: db.prepare("SELECT * FROM recharge_plans ORDER BY sort_order, id").all(),
      notices: db.prepare("SELECT * FROM notices ORDER BY created_at DESC").all(),
    });
  }

  if (req.method === "POST" && pathname === "/api/admin/categories") {
    requireAdmin(user);
    const body = await readJson(req);
    const name = text(body.name, 12, "分类名称", { required: true });
    const color = /^#[0-9a-fA-F]{6}$/.test(body.color) ? body.color : "#7357ff";
    const icon = text(body.icon, 2, "分类图标", { required: true });
    const active = body.active === false ? 0 : 1;
    if (body.id) {
      db.prepare(
        "UPDATE categories SET name = ?, color = ?, icon = ?, active = ? WHERE id = ?",
      ).run(name, color, icon, active, asNumber(body.id));
      return success({ updated: true });
    }
    const result = db.prepare(
      "INSERT INTO categories (name, color, icon, sort_order, active) VALUES (?, ?, ?, 99, ?)",
    ).run(name, color, icon, active);
    return success({ id: Number(result.lastInsertRowid) }, 201);
  }

  if (req.method === "POST" && pathname === "/api/admin/membership-plans") {
    requireAdmin(user);
    const body = await readJson(req);
    const values = [
      text(body.name, 24, "套餐名称", { required: true }),
      clamp(asNumber(body.days), 1, 3650),
      Math.max(1, Math.round(asNumber(body.priceCents))),
      Math.max(1, Math.round(asNumber(body.originalPriceCents))),
      text(body.benefits, 300, "会员权益", { required: true }),
      clamp(asNumber(body.discountPercent, 100), 50, 100),
      body.recommended ? 1 : 0,
      body.active === false ? 0 : 1,
      clamp(asNumber(body.sortOrder, 99), 0, 999),
    ];
    if (body.id) {
      db.prepare(`
        UPDATE membership_plans SET
        name = ?, days = ?, price_cents = ?, original_price_cents = ?, benefits = ?,
        discount_percent = ?, recommended = ?, active = ?, sort_order = ? WHERE id = ?
      `).run(...values, asNumber(body.id));
      return success({ updated: true });
    }
    const result = db.prepare(`
      INSERT INTO membership_plans
      (name, days, price_cents, original_price_cents, benefits, discount_percent, recommended, active, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(...values);
    return success({ id: Number(result.lastInsertRowid) }, 201);
  }

  if (req.method === "POST" && pathname === "/api/admin/recharge-plans") {
    requireAdmin(user);
    const body = await readJson(req);
    const values = [
      text(body.label, 24, "档位名称", { required: true }),
      Math.max(1, Math.round(asNumber(body.amountCents))),
      Math.max(0, Math.round(asNumber(body.bonusCents))),
      Math.max(1, Math.round(asNumber(body.priceCents))),
      body.recommended ? 1 : 0,
      body.active === false ? 0 : 1,
      clamp(asNumber(body.sortOrder, 99), 0, 999),
    ];
    if (body.id) {
      db.prepare(`
        UPDATE recharge_plans SET
        label = ?, amount_cents = ?, bonus_cents = ?, price_cents = ?,
        recommended = ?, active = ?, sort_order = ? WHERE id = ?
      `).run(...values, asNumber(body.id));
      return success({ updated: true });
    }
    const result = db.prepare(`
      INSERT INTO recharge_plans
      (label, amount_cents, bonus_cents, price_cents, recommended, active, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(...values);
    return success({ id: Number(result.lastInsertRowid) }, 201);
  }

  if (req.method === "POST" && pathname === "/api/admin/notices") {
    requireAdmin(user);
    const body = await readJson(req);
    const result = db.prepare(`
      INSERT INTO notices (title, content, type, active, created_at)
      VALUES (?, ?, ?, 1, ?)
    `).run(
      text(body.title, 50, "公告标题", { required: true }),
      text(body.content, 1000, "公告内容", { required: true }),
      ["notice", "event", "author"].includes(body.type) ? body.type : "notice",
      iso(),
    );
    return success({ id: Number(result.lastInsertRowid) }, 201);
  }

  if (req.method === "GET" && pathname === "/api/admin/orders") {
    requireAdmin(user);
    const type = url.searchParams.get("type");
    const where = type === "membership" || type === "recharge" ? "WHERE o.type = ?" : "";
    const params = where ? [type] : [];
    const orders = db.prepare(`
      SELECT o.*, u.nickname, u.username
      FROM orders o JOIN users u ON u.id = o.user_id
      ${where}
      ORDER BY o.created_at DESC LIMIT 100
    `).all(...params);
    const tips = db.prepare(`
      SELECT t.*, u.nickname AS reader_name, a.nickname AS author_name, b.title AS book_title
      FROM tips t
      JOIN users u ON u.id = t.user_id
      JOIN users a ON a.id = t.author_id
      JOIN books b ON b.id = t.book_id
      ORDER BY t.created_at DESC LIMIT 50
    `).all();
    return success({ orders, tips });
  }

  throw new HttpError(404, "API_NOT_FOUND", "接口不存在");
}

handleApi.loginAttempts = new Map();

function serveStatic(req, res, pathname) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return fail(405, "METHOD_NOT_ALLOWED", "此地址不支持当前请求方法");
  }
  let relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  if (pathname === "/admin" || pathname === "/admin/") relative = "admin.html";
  const filePath = path.resolve(PUBLIC_DIR, relative);
  if (!filePath.startsWith(`${path.resolve(PUBLIC_DIR)}${path.sep}`) && filePath !== path.resolve(PUBLIC_DIR)) {
    return fail(403, "FORBIDDEN", "禁止访问此路径");
  }
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return fail(404, "NOT_FOUND", "页面不存在");
  }
  const extension = path.extname(filePath).toLowerCase();
  const mime = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".webmanifest": "application/manifest+json; charset=utf-8",
    ".svg": "image/svg+xml; charset=utf-8",
    ".png": "image/png",
    ".ico": "image/x-icon",
  }[extension] || "application/octet-stream";
  const content = fs.readFileSync(filePath);
  return {
    status: 200,
    headers: {
      "Content-Type": mime,
      "Content-Length": content.length,
      "Cache-Control": [".html", ".js", ".css", ".webmanifest"].includes(extension)
        ? "no-cache"
        : "public, max-age=3600",
    },
    data: content,
  };
}

function safeSend(res, response) {
  if (res.headersSent) return;
  res.writeHead(response.status, response.headers);
  if (response.data === undefined || response.data === null) {
    res.end();
  } else if (Buffer.isBuffer(response.data) || typeof response.data === "string") {
    res.end(response.data);
  } else {
    res.end(JSON.stringify(response.data));
  }
}

function createApplication({ dbPath } = {}) {
  const db = createDb(dbPath);
  const server = http.createServer(async (req, res) => {
    const requestUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const pathname = decodeURIComponent(requestUrl.pathname);
    try {
      let response;
      if (pathname.startsWith("/api/")) {
        response = await handleApi(req, res, db, pathname, requestUrl);
      } else {
        response = serveStatic(req, res, pathname);
      }
      response.headers = {
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "X-Frame-Options": "DENY",
        "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
        "Content-Security-Policy":
          "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; manifest-src 'self'; worker-src 'self'",
        ...response.headers,
      };
      safeSend(res, response);
    } catch (error) {
      if (process.env.NODE_ENV !== "test") {
        console.error(`[${new Date().toISOString()}] ${req.method} ${pathname}`, error);
      }
      const status = error instanceof HttpError ? error.status : 500;
      const code = error instanceof HttpError ? error.code : "INTERNAL_ERROR";
      const message = error instanceof HttpError ? error.message : "服务器开小差了，请稍后再试";
      safeSend(res, fail(status, code, message, error.details));
    }
  });
  return { server, db };
}

module.exports = {
  createApplication,
  handleApi,
};
