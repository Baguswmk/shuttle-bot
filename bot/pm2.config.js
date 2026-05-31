module.exports = {
  apps: [
    {
      name:           'shuttle-bot',
      script:         'dist/index.js',
      instances:      2,
      exec_mode:      'cluster',
      watch:          false,
      max_memory_restart: '400M',
      env_production: {
        NODE_ENV: 'production',
      },
      error_file:     './logs/error.log',
      out_file:       './logs/out.log',
      log_date_format:'YYYY-MM-DD HH:mm:ss Z',
      merge_logs:     true,
      restart_delay:  5000,
      max_restarts:   10,
    },
  ],
};
