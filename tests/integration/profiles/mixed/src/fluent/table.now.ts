import { Table, StringColumn } from "@servicenow/sdk/core";

export const x_acme_ticket = Table({
  name: "x_acme_ticket",
  schema: {
    title: StringColumn({ label: "Title" }),
  },
});
