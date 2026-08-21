var related = new GlideRecord("incident");
related.addQuery("active", true);
related.next();
