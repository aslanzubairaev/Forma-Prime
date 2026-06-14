module.exports = {
  apps: [
    {
      name: "nordwolf",
      script: "npm",
      args: "start",
      cwd: __dirname,
      env: {
        NODE_ENV: "production",
      },
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s",
      out_file: "./logs/nordwolf.out.log",
      error_file: "./logs/nordwolf.err.log",
      time: true,
    },
  ],
};
