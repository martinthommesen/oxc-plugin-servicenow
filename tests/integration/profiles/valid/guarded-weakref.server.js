if (typeof WeakRef === "function") {
  const reference = new WeakRef(target);
  gs.info(reference);
}
