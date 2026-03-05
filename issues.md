# Issues

See README.md for acronym definitions.

## Features

- Create rank enums ranges 1d-9d and 1k-25k, rank uses search select, CSV upload validates rank
- Support slide and fold pairing format (swiss only?). TD can change this after tournament creation

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
- [x] Scan QR code or visit link for players to checkin. Allow TD to checkin one player and bulk check-in multiple players. Only checked in players can be paired
- [x] Deep dive mcmahon pairings with the links https://en.wikipedia.org/wiki/McMahon_system_tournament, https://senseis.xmp.net/?McMahonPairing, https://www.gokgs.com/help/tournMcMahon.html, https://www.britgo.org/organisers/mcmahonpairing.html. Then evaluate the current mcmahon pairing logic in lib.
- [x] Fix round checkbox and save feature only working for the first player checked, the second and thereafter are not being persisted
- [x] Make check in and withdraw in tournament registration page similar to round checkin: persist via bulk updates and only call the API after TD presses save
- [x] Disable withdraw in API and button if player has already been paired; If tournament is not in "registration" phase, checkin checkboxes are disabled
- [x] Show warning icon for high handicap >= 4; show warning if TD paired and tournament status is "setup" or "registration"
- [x] Near copy tournament link, move tournament status change here

## Bugs

- [x] SOS and SODOS calculations are wrong. After round 1, all SDS and SOS should both be 0 since players' opponents did not win any games. Root cause the problem. Tournament object:
