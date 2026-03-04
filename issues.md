# Issues

See README.md for acronym definitions.

## Features

- Deep dive mcmahon pairings with the links https://en.wikipedia.org/wiki/McMahon_system_tournament, https://senseis.xmp.net/?McMahonPairing, https://www.gokgs.com/help/tournMcMahon.html, https://www.britgo.org/organisers/mcmahonpairing.html. Then evaluate the current mcmahon pairing logic in lib.
- Support slide and Fold pairing format. TD can change this after tournament creation.

## Done

- [x] Tournament settings - Handicap Type: None, Rank Difference, Handicap modifier (None, Minus 1, Minus 2). SOS, SOSOS, SDS - calculations of these have fixed outcomes and not specified by the user - go through player's opponents and add. No need to define custom weights to show a "total"
- [x] During tournament creation, TD defines how the system sorts players' standings. Up to 4 rules of decreasing importance can be selected. For example, TD selects number of wins, SOS, SDS, HTH (let this be the default configuration in the UI) - during standings calculations, if players have the same number of wins, then they are sorted by SOS, then by SODOS, finally tie-breakers are separated by HTH. The TD can change this after tournament creation
- [x] Rename pairing-api/src/nyig_td_api to pairing-api/src/pairing_api
- [x] Add VS code settings so that pairing-api and lib directories look for the python interpreters in their respective .venv folders
- [x] Don't close register player dialog on add player
- [x] Make AGA ID field required and unique
- [x] Player registration page should show individual checkboxes of each round and allow selection of participating in each round or not. Add a save changes to reduce API calls. Warn TD if they will navigate away with unsaved changes.
- [x] Players can be fetched all, small dataset, player search should not rerender on each key stroke, front end filter by player name or AGA ID
- [x] Support bulk player register: CSV format. Show confirmation screen of players that will be created, and count of players that will be added. Show players with different name than in DB.
- [x] Pairing disabled if previous round was not marked as completed
- [x] Show pairing page - public link to players. TD can publish/unpublish pairings.
- [ ] Scan QR code or visit link for players to checkin. Allow TD to checkin one player and bulk check-in multiple players. Only checked in players can be paired
