var totals = new GlideAggregate("incident");
totals.addAggregate("COUNT");
totals.query();
if (totals.next()) {
  gs.info(totals.getAggregate("COUNT", "priority"));
}
