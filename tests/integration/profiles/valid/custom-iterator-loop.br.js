var customIterator = {
  next: function () {
    return false;
  },
};

while (customIterator.next()) {
  var gr = new GlideRecord("task");
  gr.addQuery("active", true);
  gr.query();
}
