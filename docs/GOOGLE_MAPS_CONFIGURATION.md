# Google Maps has been replaced

RoverOS now uses OpenStreetMap and Leaflet, with optional manual address search
through Photon. See [OpenStreetMap configuration](OPENSTREETMAP_CONFIGURATION.md).

No Google browser key is loaded, returned to clients, or used by the maps.
An old Google configuration record may still exist in the MiniPC database; it
remains hidden by the generic credential filter. Revoke any unused Google key in
Google Cloud separately. Existing records are not automatically deleted.
