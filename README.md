# Michael Vanden Heuvel's Personal Site

## Run locally

```bash
$ docker compose pull
$ docker compose up
```

## Run Prettifier

```bash
$ npx prettier . --check
$ npx prettier . --write
```

Use the below if making drastic changes

```bash
$ docker compose up --build
```
