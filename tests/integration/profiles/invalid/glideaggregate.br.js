var count = new GlideAggregate("incident");
count.addAggregate("COUNT");
if (count.next()) {
  gs.info(count.getAggregate("COUNT"));
}
