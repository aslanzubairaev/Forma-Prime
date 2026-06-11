module.exports = {
  apps: [
    {
      name: "forma-prime",
      script: "npm",
      args: "start",
      cwd: __dirname,
      env: {
        NODE_ENV: "production",
      },
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s",
      out_file: "./logs/forma-prime.out.log",
      error_file: "./logs/forma-prime.err.log",
      time: true,
    },
  ],
};
