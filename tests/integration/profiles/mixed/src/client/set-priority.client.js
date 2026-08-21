function onChange(control, oldValue, newValue) {
  if (newValue === "1") {
    g_form.showFieldMsg("priority", "Critical priority requires a work note", "info");
  }
}
