function LocalBigInt(value) {
  return String(value);
}

BigInt = LocalBigInt;
const value = BigInt(10);
