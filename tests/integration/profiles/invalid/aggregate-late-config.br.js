var totals = new GlideAggregate("x_acme_order");
totals.addAggregate("COUNT");
totals.query();
totals.addAggregate("SUM", "amount");
if (totals.next()) {
  gs.info(totals.getAggregate("SUM", "amount"));
}
