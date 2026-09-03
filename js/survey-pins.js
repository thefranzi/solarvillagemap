// Register survey symbols independently of user-created pins and photos.
function createSurveyPinLayer(map, data, name, symbolStyle) {
    var paneName = 'pane_survey_pins';
    if (!map.getPane(paneName)) {
        // Existing engineering panes extend to 4352.
        map.createPane(paneName).style.zIndex = 4500;
        map.createPane('pane_survey_pin_popups').style.zIndex = 4502;
    }

    return L.geoJson(data, {
        layerName: 'layer_' + name,
        pane: paneName,
        pointToLayer: function (feature, latlng) {
            return L.circleMarker(latlng, {
                pane: paneName,
                radius: symbolStyle.radius,
                color: '#000000',
                weight: 1,
                opacity: 1,
                fill: true,
                fillColor: symbolStyle.fillColor,
                fillOpacity: symbolStyle.fillOpacity
            });
        },
        onEachFeature: function (feature, layer) {
            var properties = feature.properties;
            var content = document.createElement('div');
            var heading = document.createElement('strong');
            heading.textContent = name;
            content.appendChild(heading);
            [properties.description, 'Plan ' + properties.source_plan].forEach(function (text) {
                var row = document.createElement('div');
                row.textContent = text;
                content.appendChild(row);
            });
            layer.bindPopup(content, {pane: 'pane_survey_pin_popups'});
        }
    });
}
