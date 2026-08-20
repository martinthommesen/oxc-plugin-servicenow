var rec = flag ? new GlideRecord("incident") : new GlideRecord("problem");
rec.query();
rec.next();
