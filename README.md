# NYIG TD

Monorepo for NYIG Tournament Directing.

## Development

Run setup to install packages

```sh
./setup.sh
```

Run dev server with Test DB connection defined in td-api/.env

```sh
./dev.sh
```

Run front end locally with test data

```sh
cd web && npm run local
```

## Acronyms

TD = Tournament Director

### Tie breaking

Wins - sum of number of games the player has won

SOS - sum of opponent's scores: sum of the wins of all player's 

SOSOS - sum of sum of opponent's scores: sum of the SOS all player's opponents

SDS - sum of defeated opponent's scores: sum of the wins of all opponents the player has won against

HTH - head to head: if players played each other, the winner is placed higher
