const values = new BigInt64Array(4);
const bytes = Uint8Array.of(1, 2, 3);
const ownsNumber = Object.hasOwn(current, "number");
const combined = new Set(["incident"]).union(new Set(["task"]));
const unsigned = BigInt.asUintN(64, -1n);

gs.info(`${ownsNumber}:${values.length}:${bytes.length}:${combined.size}:${unsigned}`);
