# servicenow/no-br-current-update

`current.update()` retriggers other Business Rules and can recurse. Set fields on `current` and let the platform save. UI Actions are exempt.

- **Family:** classic
- **Preset:** recommended
- **Default severity:** error
- **Fixable:** no
- **Suggestions:** no

## Incorrect

### ❌ current.update

```js
current.state = 2;
current.update();
```

## Correct

### ✅ assign and return

```js
current.state = 2;
current.work_notes = "Moved to In Progress";
```

## See also

- [ServiceNow Fluent overview](https://servicenow.github.io/sdk/guides/fluent-overview)
- [oxlint JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html)
