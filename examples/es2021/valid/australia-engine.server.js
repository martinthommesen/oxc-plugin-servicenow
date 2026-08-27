const values = new BigInt64Array(4);
const ownsNumber = Object.hasOwn(current, "number");
const combined = new Set(["incident"]).union(new Set(["task"]));

gs.info(`${ownsNumber}:${values.length}:${combined.size}`);
