# Command / Query Model

The Domain separates **commands** (which change state) from **queries** (which only read). Both are
named in registries and routed through the `Domain` facade; neither is dispatched anonymously
(Law VII).

## Registries

Both registries are `Object.freeze`d single sources of truth.

### `DOMAIN_COMMANDS` (`js/domain/commands.js`)
Each entry maps a command id to metadata:

```js
'employee.employment.update': Object.freeze({
  aggregate:  'Employee',
  boundary:   'EmployeeEmploymentAggregate',   // business authority (optional)
  handler:    'updateEmployeeEmployment',        // implementation authority
  transition: 'controlled update of Employee employment fields …'
})
```

- `handler` is a **function name**, resolved on demand from the shared global scope. The registry
  carries no load-order dependency on handlers and never invokes them itself.
- `boundary`, when present, names the aggregate that must approve the command before the handler
  runs.

### `DOMAIN_QUERIES` (`js/domain/queries.js`)
Each entry maps a query id to a read-only handler name and a description of its result shape.

Most entries in both registries are **descriptive**: they document an existing handler without yet
routing through the facade. Only the operational ids below are actually routed.

## Routing

### `Domain.query(name, ...args)`
Resolves the registered read-only handler and returns its result unchanged. Throws clearly on an
unknown query or a missing handler — never a silent no-op. No mutation, persistence, or audit occurs
on this path.

### `Domain.command(name, ...args)`
1. Look up the command; throw if unknown.
2. Resolve its handler by name; throw if missing.
3. If the command declares a `boundary`, call `aggregate.prepare(id, patch)`:
   - on `{ ok:false, error }` → return `{ success:false, error }`; **the handler is not called**;
   - on `{ ok:true, patch }` → replace the arguments with the sanitized patch.
4. Call the handler **exactly once** (a single `fn.apply`, no loop) and return its typed result.

The facade adds routing and the aggregate gate. It performs no mutation, persistence, or audit of its
own — those remain entirely with the handler.

## Operational surface today

| Kind | Id | Boundary | Handler |
|---|---|---|---|
| Query | `employee.filtered` | — | `employeesFiltered` |
| Command | `employee.contact.update` | `EmployeeContactAggregate` | `updateEmployeeContact` |
| Command | `employee.employment.update` | `EmployeeEmploymentAggregate` | `updateEmployeeEmployment` |

Counts are invariant and verifier-enforced: **two** operational aggregates, **two** operational
commands, **one** operational query. Changing these counts is a deliberate, Sprint-authorized step.

## Design rules

- **One id, one handler.** Command and query ids are unique within and across the registries; every
  registered handler name resolves to a real function present in the build.
- **Resolve, don't hard-wire.** Handlers are resolved by name at call time, so registries stay
  declarative and free of load-order coupling.
- **No hidden write path.** If a change is operational, it is a registered command routed through the
  facade; there is no `dispatch`/`ask` back door.
