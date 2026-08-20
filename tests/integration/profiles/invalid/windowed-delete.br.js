var stale = new GlideRecord("x_acme_staging");
stale.addQuery("state", "expired");
stale.setLimit(100);
stale.deleteMultiple();
