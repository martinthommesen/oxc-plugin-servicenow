async function drain(items) {
  for await (const item of items) {
    gs.info(item);
  }
}
