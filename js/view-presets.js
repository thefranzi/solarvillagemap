(function () {
    var params = new URLSearchParams(window.location.search);
    var viewName = (params.get('view') || '').trim().toLowerCase();

    if (viewName !== 'fencing') return;

    var baseLayers = [
        layer_WorldImagery_3,
        layer_OSM_1,
        layerBlank4,
        layer_GoogleSatellite_2,
        layer_GoogleMaps_0
    ];

    var overlayLayers = [
        pinsLayer,
        photosLayer,
        layer_LOTS_5,
        layer_EX_FENCE_21,
        layer_FENCE_20,
        layer_LOTLINE_FLAGGING_9,
        layer_EX_BLD_10,
        layer_SBE_9,
        layer_CE_14,
        layer_WELL_PTS_8,
        layer_SEPTIC_18,
        layer_ALR_16,
        layer_ENV_RST_12,
        layer_AOI_17,
        layer_CRK_COV_11,
        layer_DWY_ASBUILT_2,
        layer_CE_COV_PIN,
        layer_BA_15,
        layer_DWAY_IFC_1,
        layer_BNDRY_4,
        layer_SIERRA1_3,
        layer_SIERRA2_2,
        layer_FUT_LGL_P2A_5,
        layer_EX_LGL_6,
        layer_DWY_L4_PVMT_8,
        layer_DWY_L4_GRVL_7,
        layer_RD_EOA_11,
        layer_SRW_MOTI_13,
        layer_FUT_RD_3,
        layer_FUT_LGL_EXT_4,
        layer_CONT_6,
        layer_ESA_7
    ];

    var fencingLayers = [
        photosLayer,
        layer_LOTS_5,
        layer_EX_FENCE_21,
        layer_FENCE_20,
        layer_LOTLINE_FLAGGING_9,
        layer_CE_14,
        layer_CE_COV_PIN
    ];

    baseLayers.forEach(function (layer) {
        if (map.hasLayer(layer)) map.removeLayer(layer);
    });
    map.addLayer(layer_WorldImagery_3);

    overlayLayers.forEach(function (layer) {
        if (map.hasLayer(layer)) map.removeLayer(layer);
    });
    fencingLayers.forEach(function (layer) {
        map.addLayer(layer);
    });
})();
