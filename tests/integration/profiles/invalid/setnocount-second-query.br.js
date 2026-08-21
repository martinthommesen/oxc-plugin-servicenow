var rec = new GlideRecord("incident");
rec.query();
gs.info(rec.getRowCount());
rec.chooseWindow(100, 200);
rec.query();
