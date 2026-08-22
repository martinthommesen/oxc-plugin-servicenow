import { BusinessRule, StringColumn, Table } from '@servicenow/sdk/core';

export const x_acme_widget = Table({
  name: 'x_acme_widget',
  schema: {
    title: StringColumn({ label: 'Title', mandatory: true, maxLength: 160 }),
  },
});

BusinessRule({
  $id: Now.ID['log-widget-update'],
  table: 'x_acme_widget',
  name: 'Log widget update',
  when: 'after',
  action: ['update'],
  script: Now.include('../server/log-widget-update.server.js'),
});
