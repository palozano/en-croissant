# Schaak identity

Schaak is maintained at https://github.com/palozano/schaak and derives from En Croissant.

The desktop application identifier is `io.github.palozano.schaak`; import links use
`schaak://import?url=...`. Desktop settings, engines and databases now use the
Schaak application data directory. Existing En Croissant data is left untouched;
copy it into the new application data directory to reuse it, or select the old
engine/database folders in settings. Lichess accounts need to be connected again.

For compatibility, browser studies still use the `en-croissant-web` IndexedDB
database and saved documents still default to the `EnCroissant` folder.
These names are storage contracts rather than visible application branding.

Engine and database catalog URLs remain on encroissant.org. Original authorship
and the chess joke “Forced En Croissant” are retained. Automatic updates from the
original project are disabled until Schaak has its own signing and release setup.
