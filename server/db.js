const { DatabaseSync } = require("node:sqlite");
const {
  createHash,
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const DAY_MS = 24 * 60 * 60 * 1000;

function iso(date = new Date()) {
  return date.toISOString();
}

function addDays(days, from = new Date()) {
  return new Date(from.getTime() + Number(days) * DAY_MS).toISOString();
}

function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  const hash = scryptSync(String(password), salt, 64).toString("hex");
  return { salt, hash };
}

function verifyPassword(password, salt, expectedHash) {
  const actual = Buffer.from(scryptSync(String(password), salt, 64).toString("hex"));
  const expected = Buffer.from(expectedHash);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function tokenHash(token) {
  return createHash("sha256").update(token).digest("hex");
}

function orderNo(prefix) {
  const stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  return `${prefix}${stamp}${randomBytes(3).toString("hex").toUpperCase()}`;
}

function transaction(db, callback) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = callback();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function applySchema(db) {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'reader' CHECK (role IN ('reader', 'author', 'admin')),
      nickname TEXT NOT NULL,
      avatar TEXT NOT NULL DEFAULT '页',
      bio TEXT NOT NULL DEFAULT '',
      balance_cents INTEGER NOT NULL DEFAULT 0 CHECK (balance_cents >= 0),
      vip_expires_at TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'banned')),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL,
      icon TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      author_id INTEGER NOT NULL REFERENCES users(id),
      category_id INTEGER NOT NULL REFERENCES categories(id),
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      cover_start TEXT NOT NULL,
      cover_end TEXT NOT NULL,
      cover_symbol TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'pending', 'published', 'rejected')),
      serial_status TEXT NOT NULL DEFAULT 'serial'
        CHECK (serial_status IN ('serial', 'finished')),
      vip_only INTEGER NOT NULL DEFAULT 0,
      featured INTEGER NOT NULL DEFAULT 0,
      review_note TEXT NOT NULL DEFAULT '',
      read_count INTEGER NOT NULL DEFAULT 0,
      favorite_count INTEGER NOT NULL DEFAULT 0,
      rating REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chapters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      word_count INTEGER NOT NULL DEFAULT 0,
      price_cents INTEGER NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
      vip_free INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'pending', 'published', 'rejected')),
      review_note TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      published_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS favorites (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      PRIMARY KEY (user_id, book_id)
    );

    CREATE TABLE IF NOT EXISTS purchases (
      user_id INTEGER NOT NULL REFERENCES users(id),
      chapter_id INTEGER NOT NULL REFERENCES chapters(id),
      amount_cents INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (user_id, chapter_id)
    );

    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      parent_id INTEGER REFERENCES comments(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'hidden')),
      like_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS forum_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'discuss',
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'active', 'rejected')),
      views INTEGER NOT NULL DEFAULT 0,
      likes INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS forum_replies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL REFERENCES forum_posts(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id),
      content TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'hidden')),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tips (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      author_id INTEGER NOT NULL REFERENCES users(id),
      book_id INTEGER NOT NULL REFERENCES books(id),
      amount_cents INTEGER NOT NULL,
      author_income_cents INTEGER NOT NULL,
      message TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS wallet_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      type TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      balance_after_cents INTEGER NOT NULL,
      description TEXT NOT NULL,
      order_no TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_no TEXT NOT NULL UNIQUE,
      user_id INTEGER NOT NULL REFERENCES users(id),
      type TEXT NOT NULL CHECK (type IN ('membership', 'recharge')),
      plan_id INTEGER NOT NULL,
      amount_cents INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'paid' CHECK (status IN ('pending', 'paid', 'refunded')),
      paid_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS membership_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      days INTEGER NOT NULL,
      price_cents INTEGER NOT NULL,
      original_price_cents INTEGER NOT NULL,
      benefits TEXT NOT NULL,
      discount_percent INTEGER NOT NULL DEFAULT 90,
      recommended INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS recharge_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      label TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      bonus_cents INTEGER NOT NULL DEFAULT 0,
      price_cents INTEGER NOT NULL,
      recommended INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS reader_preferences (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      font_size INTEGER NOT NULL DEFAULT 19,
      font_family TEXT NOT NULL DEFAULT 'serif',
      text_color TEXT NOT NULL DEFAULT '#e9dfcf',
      background TEXT NOT NULL DEFAULT '#171613',
      theme TEXT NOT NULL DEFAULT 'night',
      line_height REAL NOT NULL DEFAULT 1.9,
      page_mode TEXT NOT NULL DEFAULT 'scroll',
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reading_progress (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      chapter_id INTEGER NOT NULL REFERENCES chapters(id),
      percent INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (user_id, book_id)
    );

    CREATE TABLE IF NOT EXISTS notices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'notice',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS admin_actions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id INTEGER NOT NULL REFERENCES users(id),
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id INTEGER NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_books_status ON books(status, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_books_category ON books(category_id, status);
    CREATE INDEX IF NOT EXISTS idx_chapters_book ON chapters(book_id, sort_order);
    CREATE INDEX IF NOT EXISTS idx_comments_book ON comments(book_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_wallet_user ON wallet_transactions(user_id, created_at DESC);
  `);
}

function prose(title, chapterTitle, author, volume) {
  const scenes = [
    `风从旧城的屋脊上掠过，把最后一点暮色吹进巷口。林知夏停在拐角处，指尖捏着那张已经泛黄的车票。票面上印着一个从未听过的站名，背面却写着她的名字，墨迹像是刚刚才干。`,
    `远处的钟楼敲了七下。每一声都沉进潮湿的石板路里，又被路过的脚步轻轻带走。她抬头看见街灯次第亮起，像有人沿着长街，替她点了一条看不见的路。`,
    `“你也在等那封信吗？”身后的人问。声音不高，却让四周忽然安静下来。林知夏没有回头，只把车票收进掌心。她知道，从这一刻起，${title} 的故事不会再停留在纸页上。`,
    `夜色更深了。城北的河面浮着细碎的光，像无数没有说出口的答案。她终于迈出第一步，而那座沉默许久的城市，也像在暗处缓慢睁开了眼睛。`,
  ];
  const intro = `第${volume}章 · ${chapterTitle}\n\n作者：${author}\n\n`;
  return `${intro}${scenes[0]}\n\n${scenes[1]}\n\n${scenes[2]}\n\n${scenes[3]}\n\n` +
    `这一夜并没有给出答案，只留下更多值得追问的线索。林知夏回到住处，把车票压在台灯下。灯影里，纸背的名字似乎比方才更清晰了一些。\n\n` +
    `她翻开随身带着的旧书。扉页上只有一句话：所有抵达，都是另一种出发。\n\n` +
    `窗外，一辆末班车从雾里驶过，没有停站。`;
}

function seed(db) {
  const count = Number(db.prepare("SELECT COUNT(*) AS count FROM users").get().count);
  if (count > 0) return;

  transaction(db, () => {
    const now = new Date();
    const nowText = iso(now);
    const insertUser = db.prepare(`
      INSERT INTO users
      (username, email, password_hash, password_salt, role, nickname, avatar, bio, balance_cents, vip_expires_at, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
    `);
    const users = [
      ["admin", "admin@xunye.local", "123456", "admin", "寻页管理员", "管", "维护内容与平台运营", 0, null],
      ["author", "author@xunye.local", "123456", "author", "迟岸", "岸", "写城市，也写城市里没有寄出的信。", 32600, addDays(180, now)],
      ["reader", "reader@xunye.local", "123456", "reader", "林间读者", "读", "在故事里寻找第二人生。", 12880, null],
      ["momo", "momo@xunye.local", "123456", "reader", "默默", "默", "悬疑和科幻爱好者", 5800, addDays(23, now)],
    ];
    for (const [username, email, password, role, nickname, avatar, bio, balance, vipExpires] of users) {
      const hashed = hashPassword(password);
      insertUser.run(username, email, hashed.hash, hashed.salt, role, nickname, avatar, bio, balance, vipExpires, nowText);
    }

    const categoryRows = [
      ["悬疑", "#7357ff", "谜", 1],
      ["都市", "#ef7c57", "城", 2],
      ["科幻", "#25a9a2", "星", 3],
      ["青春", "#f4a6a7", "夏", 4],
      ["幻想", "#ba76e8", "幻", 5],
      ["轻小说", "#f2b35e", "云", 6],
      ["历史", "#9d835d", "卷", 7],
      ["治愈", "#80a57c", "暖", 8],
    ];
    const insertCategory = db.prepare(
      "INSERT INTO categories (name, color, icon, sort_order, active) VALUES (?, ?, ?, ?, 1)",
    );
    for (const row of categoryRows) insertCategory.run(...row);

    const insertPlan = db.prepare(`
      INSERT INTO membership_plans
      (name, days, price_cents, original_price_cents, benefits, discount_percent, recommended, active, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
    `);
    insertPlan.run("月卡会员", 30, 1800, 2500, "会员书库|付费章节 9 折|免广告|专属标识", 90, 0, 1);
    insertPlan.run("季卡会员", 90, 4800, 6800, "会员书库|付费章节 85 折|免广告|专属标识|限定主题", 85, 1, 2);
    insertPlan.run("年卡会员", 365, 15800, 25800, "会员书库|付费章节 8 折|免广告|限定主题|年度纪念章", 80, 0, 3);

    const insertRecharge = db.prepare(`
      INSERT INTO recharge_plans
      (label, amount_cents, bonus_cents, price_cents, recommended, active, sort_order)
      VALUES (?, ?, ?, ?, ?, 1, ?)
    `);
    insertRecharge.run("轻量阅读", 1000, 0, 1000, 0, 1);
    insertRecharge.run("常读常新", 3000, 300, 3000, 1, 2);
    insertRecharge.run("沉浸书海", 5000, 800, 5000, 0, 3);
    insertRecharge.run("年度书袋", 10000, 2000, 10000, 0, 4);

    const insertNotice = db.prepare(
      "INSERT INTO notices (title, content, type, active, created_at) VALUES (?, ?, ?, 1, ?)",
    );
    insertNotice.run("寻页公测开启", "新用户注册即赠 10 元阅读余额，完成第一条书评还可获得 7 天会员体验。", "event", nowText);
    insertNotice.run("创作激励计划", "本月审核通过并更新三章以上的新作品，将进入首页新书推荐位。", "author", nowText);
    insertNotice.run("文明互动公约", "请尊重原创与彼此的表达边界，共同维护友好的阅读社区。", "notice", nowText);

    const authorId = 2;
    const bookSeeds = [
      {
        title: "雾港来信", category: 1, summary: "一封寄自七年前的信，把城市边缘的旧港重新拉回林知夏的生活。",
        colors: ["#202c49", "#7357ff"], symbol: "雾", price: 30, featured: 1, vip: 0, reads: 18420, rating: 9.3,
      },
      {
        title: "长夜有灯", category: 2, summary: "凌晨两点仍亮着灯的便利店，收留了三个无处可去的人。",
        colors: ["#3d2922", "#ef7c57"], symbol: "灯", price: 25, featured: 1, vip: 0, reads: 15690, rating: 9.1,
      },
      {
        title: "星海拾遗", category: 3, summary: "人类离开地球后的第一百零七年，一名拾荒者在废弃空间站捡到一段求救录音。",
        colors: ["#113b43", "#25a9a2"], symbol: "星", price: 35, featured: 1, vip: 1, reads: 23870, rating: 9.5,
      },
      {
        title: "山茶巷的夏天", category: 4, summary: "十七岁的夏天，旧照相馆、山茶花和一场没有说出口的告别。",
        colors: ["#5e2e3d", "#f4a6a7"], symbol: "夏", price: 20, featured: 0, vip: 0, reads: 9340, rating: 8.9,
      },
      {
        title: "逆光航线", category: 5, summary: "云海之上的浮空列车上，失踪十年的乘务员再次出现。",
        colors: ["#35204c", "#ba76e8"], symbol: "航", price: 28, featured: 0, vip: 1, reads: 12780, rating: 9.0,
      },
      {
        title: "第七码头", category: 1, summary: "整座城市只有六座码头，但每个雨夜，都有人从第七码头登岸。",
        colors: ["#1e3337", "#56858c"], symbol: "七", price: 32, featured: 0, vip: 0, reads: 20120, rating: 9.2,
      },
      {
        title: "云上厨房", category: 6, summary: "一家开在云层里的小餐馆，只接待带着遗憾而来的客人。",
        colors: ["#67502e", "#f2b35e"], symbol: "味", price: 19, featured: 0, vip: 0, reads: 6830, rating: 8.7,
      },
      {
        title: "旧城风物志", category: 7, summary: "以十二件旧物为线索，写给一座正在消失的城。",
        colors: ["#44382b", "#9d835d"], symbol: "城", price: 22, featured: 0, vip: 0, reads: 7460, rating: 8.8,
      },
    ];

    const insertBook = db.prepare(`
      INSERT INTO books
      (author_id, category_id, title, summary, cover_start, cover_end, cover_symbol, status,
       serial_status, vip_only, featured, review_note, read_count, favorite_count, rating, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'published', ?, ?, ?, '', ?, ?, ?, ?, ?)
    `);
    const insertChapter = db.prepare(`
      INSERT INTO chapters
      (book_id, title, content, word_count, price_cents, vip_free, status, review_note,
       sort_order, published_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'published', '', ?, ?, ?, ?)
    `);
    const titles = ["雾中的车票", "钟楼七响", "没有名字的站台", "灯火与归途"];
    for (let index = 0; index < bookSeeds.length; index += 1) {
      const book = bookSeeds[index];
      const result = insertBook.run(
        authorId,
        book.category,
        book.title,
        book.summary,
        book.colors[0],
        book.colors[1],
        book.symbol,
        index % 3 === 0 ? "serial" : "finished",
        book.vip,
        book.featured,
        book.reads,
        120 + index * 67,
        book.rating,
        new Date(now.getTime() - (30 - index) * DAY_MS).toISOString(),
        new Date(now.getTime() - index * 3600_000).toISOString(),
      );
      const bookId = Number(result.lastInsertRowid);
      for (let chapter = 1; chapter <= 4; chapter += 1) {
        const chapterTitle = titles[chapter - 1];
        const content = prose(book.title, chapterTitle, "迟岸", chapter);
        const price = chapter <= 2 ? 0 : book.price;
        insertChapter.run(
          bookId,
          chapterTitle,
          content,
          content.length,
          price,
          chapter === 4 ? 1 : 0,
          chapter,
          nowText,
          nowText,
          nowText,
        );
      }
    }

    const pendingBook = insertBook.run(
      authorId,
      1,
      "潮汐以北",
      "海岸线每天后退一米，而灯塔里的人坚持记录每一封漂流瓶。",
      "#172f3b",
      "#4e8e97",
      "潮",
      "serial",
      0,
      0,
      0,
      0,
      0,
      nowText,
      nowText,
    );
    const pendingBookId = Number(pendingBook.lastInsertRowid);
    db.prepare(`
      UPDATE books SET status = 'pending', review_note = '等待审核'
      WHERE id = ?
    `).run(pendingBookId);
    insertChapter.run(
      pendingBookId,
      "退潮之后",
      "审核中的章节正文。",
      7,
      0,
      0,
      1,
      nowText,
      nowText,
      nowText,
    );
    db.prepare("UPDATE chapters SET status = 'pending' WHERE book_id = ?").run(pendingBookId);

    const firstBookChapter = db.prepare("SELECT id FROM chapters WHERE book_id = 1 ORDER BY sort_order LIMIT 1").get();
    db.prepare(
      "INSERT INTO favorites (user_id, book_id, created_at) VALUES (3, 1, ?)",
    ).run(nowText);
    db.prepare(
      "INSERT INTO favorites (user_id, book_id, created_at) VALUES (3, 3, ?)",
    ).run(nowText);
    db.prepare(`
      INSERT INTO reading_progress (user_id, book_id, chapter_id, percent, updated_at)
      VALUES (3, 1, ?, 38, ?)
    `).run(firstBookChapter.id, nowText);

    const insertComment = db.prepare(`
      INSERT INTO comments (user_id, book_id, parent_id, content, status, like_count, created_at)
      VALUES (?, ?, NULL, ?, 'active', ?, ?)
    `);
    insertComment.run(4, 1, "雾港的氛围写得很有画面感，看到车票那一幕就停不下来了。", 12, nowText);
    insertComment.run(3, 3, "星海拾遗的世界观很克制，但每一个细节都值得反复看。", 8, nowText);
    insertComment.run(4, 2, "深夜便利店这个设定太治愈了。", 5, nowText);

    const insertPost = db.prepare(`
      INSERT INTO forum_posts (user_id, title, content, type, status, views, likes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const post1 = insertPost.run(
      4,
      "想找一本像《雾港来信》一样有潮湿氛围的悬疑文",
      "最近很喜欢这种旧城、雨夜和慢线索的故事，有没有类似推荐？",
      "find",
      "active",
      264,
      31,
      nowText,
    );
    insertPost.run(
      3,
      "你最近读到最想分享的一句话是什么？",
      "不限题材，欢迎把喜欢的句子留在这里。",
      "discuss",
      "active",
      186,
      22,
      nowText,
    );
    insertPost.run(
      authorId,
      "新书《潮汐以北》设定讨论",
      "想听听大家对于“每天后退一米的海岸线”有什么想象。",
      "author",
      "pending",
      0,
      0,
      nowText,
    );
    const reply = db.prepare(`
      INSERT INTO forum_replies (post_id, user_id, content, status, created_at)
      VALUES (?, ?, ?, 'active', ?)
    `);
    reply.run(post1.lastInsertRowid, 3, "可以试试《第七码头》，雨夜氛围也很浓。", nowText);

    const insertOrder = db.prepare(`
      INSERT INTO orders (order_no, user_id, type, plan_id, amount_cents, status, paid_at, created_at)
      VALUES (?, ?, ?, ?, ?, 'paid', ?, ?)
    `);
    const insertWallet = db.prepare(`
      INSERT INTO wallet_transactions
      (user_id, type, amount_cents, balance_after_cents, description, order_no, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const demoOrder = orderNo("RC");
    insertOrder.run(demoOrder, 2, "recharge", 2, 3000, nowText, nowText);
    insertWallet.run(2, "recharge", 3300, 32600, "充值 30 元，赠送 3 元", demoOrder, nowText);
    const memberOrder = orderNo("VIP");
    insertOrder.run(memberOrder, 2, "membership", 3, 15800, nowText, nowText);
    insertWallet.run(2, "membership", -15800, 32600, "开通年卡会员（在线支付）", memberOrder, nowText);
    const tipOrder = orderNo("TIP");
    db.prepare(`
      INSERT INTO tips
      (user_id, author_id, book_id, amount_cents, author_income_cents, message, created_at)
      VALUES (4, 2, 1, 500, 350, ?, ?)
    `).run("期待下一次更新！", nowText);
    insertWallet.run(4, "tip_out", -500, 5800, "打赏《雾港来信》", tipOrder, nowText);
    insertWallet.run(2, "tip_in", 350, 32600, "收到《雾港来信》打赏分成", tipOrder, nowText);

    const preferences = db.prepare(`
      INSERT INTO reader_preferences
      (user_id, font_size, font_family, text_color, background, theme, line_height, page_mode, updated_at)
      VALUES (?, 19, 'serif', '#e9dfcf', '#171613', 'night', 1.9, 'scroll', ?)
    `);
    for (let userId = 1; userId <= 4; userId += 1) preferences.run(userId, nowText);
  });
}

function createDb(dbPath = path.join(__dirname, "..", "data", "xunye.db")) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  applySchema(db);
  seed(db);
  return db;
}

module.exports = {
  DAY_MS,
  addDays,
  createDb,
  hashPassword,
  iso,
  orderNo,
  tokenHash,
  transaction,
  verifyPassword,
};
