# Issues

See README.md for acronym definitions.

## Features

- Tournament settings - Handicap Type: None, Rank Difference, Handicap modifier (None, Minus 1, Minus 2). SOS, SOSOS, SDS - calculations of these have fixed outcomes and not specified by the user - go through player's opponents and add. No need to define custom weights to show a "total".
- During tournament creation, TD defines how the system sorts players' standings. Up to 4 rules of decreasing importance can be selected. For example, TD selects number of wins, SOS, SDS, HTH (let this be the default configuration in the UI) - during standings calculations, if players have the same number of wins, then they are sorted by SOS, then by SODOS, finally tie-breakers are separated by HTH. The TD can change this after tournament creation.
- Support bulk player upload: CSV format. Show confirmation screen of players that will be created, and count of players that will be added.
- Support slide and Fold pairing format. TD can change this after tournament creation.

## UI

- Players can be fetched all, small dataset, player search does not need to rerender on each key stroke, front end filter is sufficient
- Player registration page should show individual checkboxes of each round and allow selection of participating in each round or not. Add a save changes to reduce API calls. Warn use if they will navigate away with changes.
