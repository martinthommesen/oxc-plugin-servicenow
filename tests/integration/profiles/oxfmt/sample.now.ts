import { Table, StringColumn } from '@servicenow/sdk/core';

export const x_acme_sample = Table({
  name: 'x_acme_sample',
  schema: {
    title: StringColumn({ label: 'Title' }),
  },
});
