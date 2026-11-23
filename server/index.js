const { createApplication } = require("./app");

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "0.0.0.0";
const { server, db } = createApplication();

server.listen(port, host, () => {
  console.log("");
  console.log("  寻页 XUNYE 已启动");
  console.log(`  手机端: http://localhost:${port}`);
  console.log(`  管理端: http://localhost:${port}/admin`);
  console.log(`  局域网: http://<本机IP>:${port}`);
  console.log("");
});

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
