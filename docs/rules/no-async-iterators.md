# servicenow/no-async-iterators

`for await…of` and async generators are disallowed in every instance JavaScript mode, including ES2021.

- **Family:** engine
- **Preset:** recommended
- **Default severity:** error
- **Fixable:** no
- **Suggestions:** no

## Incorrect

### ❌ for await

```js
async function drain(items) {
  for await (var item of items) {
    gs.info(item);
  }
}
```

## Correct

### ✅ for of

```js
function drain(items) {
  for (var i = 0; i < items.length; i++) {
    gs.info(items[i]);
  }
}
```

## See also

- [ServiceNow Fluent overview](https://servicenow.github.io/sdk/guides/fluent-overview)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
