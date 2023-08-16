import * as Cesium from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import "../src/css/main.css";
import "../src/cesium-ui";
import "../src/lib/jquery-ui-1.12.1.custom/jquery-ui.min.js";
import "../src/lib/jquery-3.3.1.min.js";
import "../src/lib/jquery-ui-1.12.1.custom/jquery-ui.css";
import "../src/cesium-ui.css";
//import "../src/lib/proj4.js";
import proj4 from 'proj4';
//import "../src/lib/ol/ol.js";
import "../src/cesium-ui.js";
import $ from "jquery";

// 3Dtiles
var mesh3D_tileset;
var mesh3D_IGO_tileset;
var fortcarre_tileset;
var bati_tileset;
var tiles_parcelles;

// vector data sources
var monumentsDataSource;
var monumentClicked;
var contourDataSource;
var quartiersDataSource;
var nomruesDataSource;

var gltfEntity;

var TEST = {};



// Autres imageries
var antibes2017Provider = new Cesium.WebMapServiceImageryProvider({
  url: "//cesium-dev.ville-antibes.fr/geoserver/extranet/wms",
  layers: "extranet:Antibes_OrthoVraie_LB93_2017_withmask",
  parameters: {
    transparent: "true",
    format: "image/png",
  },
  enablePickFeatures: false,
});
var globeIGOProvider = new Cesium.WebMapServiceImageryProvider({
  url: "//igoprod.igo.fr/SG/Antibes/Imagery",
  layers: "Antibes_Globe.mpt",
  enablePickFeatures: false,
});
var parcellesWMSProvider = new Cesium.WebMapServiceImageryProvider({
  url: "//sig.ville-antibes.fr/geoserver/antibes/wms",
  layers: "antibes:dgi_cad_parcelles_sans_prop",
  parameters: {
    transparent: "true",
    format: "image/png",
  },
});

var quartiersWMSProvider = new Cesium.WebMapServiceImageryProvider({
  url: "https://extranet2.ville-antibes.fr/geoserver/extranet/wms",
  layers: "extranet:cesium_quartiers",
  parameters: {
    transparent: "true",
    format: "image/png",
  },
});

// Bati3D test
var maximumScreenSpaceError = 128;
var batiTest_tileset = null;
function showBati(show = true) {
  if (batiTest_tileset == null && show) {
    batiTest_tileset = new Cesium.Cesium3DTileset({
      url: data_path + "/bati/tileset.json",
      maximumScreenSpaceError: maximumScreenSpaceError,
    });
    batiTest_tileset.readyPromise
      .then(function (tileset) {
        viewer.scene.primitives.add(tileset);
      })
      .otherwise(function (error) {
        window.alert(error);
      });
  } else {
    batiTest_tileset.show = show;
  }
}

/* CONTOUR */
var contourDisplayDistance = new Cesium.DistanceDisplayCondition(0, 100000.0);
var contourLineMaterial = Cesium.Color.BLUE;

function showContour() {
  if (contourDataSource == null) {
    var promise = Cesium.GeoJsonDataSource.load(
      data_path + "/contour_antibes.geojson",
      {
        clampToGround: false,
      }
    );
    promise
      .then(function (dataSource) {
        contourDataSource = dataSource;
        viewer.dataSources.add(dataSource);

        var cartographic_array = [];
        var c_index = 0;

        var entities = dataSource.entities.values;
        for (var i = 0; i < entities.length; i++) {
          var entity = entities[i];
          entity.polyline.width = 5;
          entity.polyline.material = contourLineMaterial;
          entity.polyline.depthFailMaterial = contourLineMaterial;
          entity.polyline.distanceDisplayCondition = contourDisplayDistance;

          var c3_array = entity.polyline.positions.getValue();
          for (var j = 0; j < c3_array.length; j++) {
            cartographic_array[c_index] = Cesium.Cartographic.fromCartesian(
              c3_array[j]
            );
            c_index += 1;
          }
        }

        // /!\ Cesium.when n'existe plus à partir de la version 1.92
        // var prom = Cesium.sampleTerrain(viewer.terrainProvider, 14, cartographic_array);
        // Cesium.when(prom, function(updatedPositions) {
        //     var c_index = 0;
        //     for (var e_idx=0; e_idx<contourDataSource.entities.values.length; e_idx++) {
        //         var entity=contourDataSource.entities.values[e_idx];
        //         var pos_length = entity.polyline.positions.getValue().length;
        //         var c3_array=[];
        //         for (var i=0;i<pos_length;i++) {
        //             c3_array[i] = Cesium.Cartographic.toCartesian(updatedPositions[c_index]);
        //             c_index += 1;
        //         }
        //         entity.polyline.positions.setValue(c3_array);
        //     }
        //     scene.requestRender();
        // });

        var prom = Cesium.sampleTerrain(
          viewer.terrainProvider,
          14,
          cartographic_array
        );
        prom.then(function (updatedPositions) {
          var c_index = 0;
          for (
            var e_idx = 0;
            e_idx < contourDataSource.entities.values.length;
            e_idx++
          ) {
            var entity = contourDataSource.entities.values[e_idx];
            var pos_length = entity.polyline.positions.getValue().length;
            var c3_array = [];
            for (var i = 0; i < pos_length; i++) {
              c3_array[i] = Cesium.Cartographic.toCartesian(
                updatedPositions[c_index]
              );
              c_index += 1;
            }
            entity.polyline.positions.setValue(c3_array);
          }
          scene.requestRender();
        });
      })
      .otherwise(function (error) {
        window.alert(error);
      });
  } else {
    contourDataSource.show = true;
  }
}

$("#checkbox-contour").on('change',function () {
  if (this.checked) {
    showContour();
  } else {
    contourDataSource.show = false;
  }
  scene.requestRender();
});

var quartierDisplayDistance = new Cesium.DistanceDisplayCondition(0, 100000.0);
function showQuartiers(enable = true) {
  if (enable == true && quartiersDataSource == null) {
    var promise = Cesium.GeoJsonDataSource.load(
      data_path + "/quartiers.geojson",
      {
        strokeWidth: 1,
        clampToGround: false,
      }
    );
    promise
      .then(function (dataSource) {
        quartiersDataSource = dataSource;
        viewer.dataSources.add(dataSource);
        quartiersDataSource.show = false;
        var entities = dataSource.entities.values;

        var cartographic_array = [];
        var c_index = 0;

        for (var i = 0; i < entities.length; i++) {
          var entity = entities[i];
          //entity.polygon.classificationType = Cesium.ClassificationType.TERRAIN;
          //entity.polygon.outline = true;
          entity.polygon.height = null;
          entity.polygon.perPositionHeight = true;
          entity.polygon.outlineColor = Cesium.Color.WHITE;
          entity.polygon.distanceDisplayCondition = quartierDisplayDistance;

          var color;
          var quartier_id = entity.properties["ID"].getValue();
          switch (quartier_id) {
            case 1:
              color = Cesium.Color.fromCssColorString("#e07000");
              break;
            case 2:
              color = Cesium.Color.fromCssColorString("#ff2020");
              break;
            case 3:
              color = Cesium.Color.fromCssColorString("#00e000");
              break;
            case 4:
              color = Cesium.Color.fromCssColorString("#00abff");
              break;
            case 5:
              color = Cesium.Color.fromCssColorString("#9020ff");
              break;
          }
          entity.polygon.material = color.withAlpha(0.3);

          var c3_array = entity.polygon.hierarchy.getValue().positions;
          for (var j = 0; j < c3_array.length; j++) {
            cartographic_array[c_index] = Cesium.Cartographic.fromCartesian(
              c3_array[j]
            );
            c_index += 1;
          }
        }

        // /!\ Cesium.when n'existe plus à partir de la version 1.92
        // var prom = Cesium.sampleTerrain(
        //   viewer.terrainProvider,
        //   14,
        //   cartographic_array
        // );
        // Cesium.when(prom, function (updatedPositions) {
        //   var c_index = 0;
        //   for (
        //     var qi = 0;
        //     qi < quartiersDataSource.entities.values.length;
        //     qi++
        //   ) {
        //     var q_entity = quartiersDataSource.entities.values[qi];
        //     var pos_length =
        //       q_entity.polygon.hierarchy.getValue().positions.length;
        //     var c3_array = [];
        //     for (var i = 0; i < pos_length; i++) {
        //       c3_array[i] = Cesium.Cartesian3.fromRadians(
        //         updatedPositions[c_index].longitude,
        //         updatedPositions[c_index].latitude,
        //         updatedPositions[c_index].height + 1.0
        //       );
        //       c_index += 1;
        //     }
        //     q_entity.polygon.hierarchy.setValue(
        //       new Cesium.PolygonHierarchy(c3_array)
        //     );
        //   }

        //   quartiersDataSource.show = true;
        // });
        var prom = Cesium.sampleTerrain(
            viewer.terrainProvider,
            14,
            cartographic_array
          );
          prom.then(function (updatedPositions) {
            var c_index = 0;
            for (
              var qi = 0;
              qi < quartiersDataSource.entities.values.length;
              qi++
            ) {
              var q_entity = quartiersDataSource.entities.values[qi];
              var pos_length =
                q_entity.polygon.hierarchy.getValue().positions.length;
              var c3_array = [];
              for (var i = 0; i < pos_length; i++) {
                c3_array[i] = Cesium.Cartesian3.fromRadians(
                  updatedPositions[c_index].longitude,
                  updatedPositions[c_index].latitude,
                  updatedPositions[c_index].height + 1.0
                );
                c_index += 1;
              }
              q_entity.polygon.hierarchy.setValue(
                new Cesium.PolygonHierarchy(c3_array)
              );
            }
          
            quartiersDataSource.show = true;
          });

      })
      .otherwise(function (error) {
        window.alert(error);
      });
  } else {
    quartiersDataSource.show = enable;
    scene.requestRender();
  }
}

$("#checkbox-quartiers").on('change',function () {
  showQuartiers(this.checked);
});

var randoxygeneDataSource;
var randoxygeneLineMaterial = new Cesium.PolylineOutlineMaterialProperty({
  color: Cesium.Color.LIGHTGREEN,
  outlineWidth: 3,
  outlineColor: Cesium.Color.DARKGREEN,
});
var randoxygeneLineMaterial2 = new Cesium.PolylineDashMaterialProperty({
  color: Cesium.Color.LIGHTGREEN,
  dashPattern: parseInt("1010101010101010", 2),
});
var randoxygeneDisplayDistance = new Cesium.DistanceDisplayCondition(
  0,
  20000.0
);

function showRandoxygen() {
  if (randoxygeneDataSource == null) {
    var promise = Cesium.GeoJsonDataSource.load(
      data_path + "/randoxygene_circuit2.geojson",
      {
        clampToGround: false,
      }
    );
    promise
      .then(function (dataSource) {
        randoxygeneDataSource = dataSource;
        viewer.dataSources.add(dataSource);

        var cartographic_array = [];
        var c_index = 0;

        var entities = dataSource.entities.values;
        for (var i = 0; i < entities.length; i++) {
          var entity = entities[i];
          entity.polyline.width = 10;
          entity.polyline.material = randoxygeneLineMaterial;
          entity.polyline.depthFailMaterial = randoxygeneLineMaterial2;
          entity.polyline.distanceDisplayCondition = randoxygeneDisplayDistance;

          var c3_array = entity.polyline.positions.getValue();
          for (var j = 0; j < c3_array.length; j++) {
            cartographic_array[c_index] = Cesium.Cartographic.fromCartesian(
              c3_array[j]
            );
            c_index += 1;
          }
        }
        var prom = Cesium.sampleTerrain(
          viewer.terrainProvider,
          14,
          cartographic_array
        );
        // /!\ Cesium.when n'existe plus à partir de la version 1.92
        //Cesium.when(prom, function (updatedPositions) {
            prom.then(function(updatedPositions){
          var c_index = 0;
          for (
            var e_idx = 0;
            e_idx < randoxygeneDataSource.entities.values.length;
            e_idx++
          ) {
            var entity = randoxygeneDataSource.entities.values[e_idx];
            var pos_length = entity.polyline.positions.getValue().length;
            var c3_array = [];
            for (var i = 0; i < pos_length; i++) {
              c3_array[i] = Cesium.Cartesian3.fromRadians(
                updatedPositions[c_index].longitude,
                updatedPositions[c_index].latitude,
                updatedPositions[c_index].height + 4.0
              );
              c_index += 1;
            }
            entity.polyline.positions.setValue(c3_array);
          }
          scene.requestRender();
          viewer.flyTo(randoxygeneDataSource);
        });
      })
      .otherwise(function (error) {
        window.alert(error);
      });
  } else {
    randoxygeneDataSource.show = true;
  }
}

$("#checkbox-randoxygene").on('change',function () {
  if (this.checked) {
    showRandoxygen();
  } else {
    randoxygeneDataSource.show = false;
  }
  scene.requestRender();
});

var dallesDataSource;
$("#checkbox-dalles").on('change',function () {
  if (this.checked) {
    if (dallesDataSource == null) {
      var promise = Cesium.GeoJsonDataSource.load(
        data_path + "/antibes_tiles.geojson",
        {
          clampToGround: false,
        }
      );
      promise
        .then(function (dataSource) {
          dallesDataSource = dataSource;
          viewer.dataSources.add(dataSource);
        })
        .otherwise(function (error) {
          window.alert(error);
        });
    } else {
      dallesDataSource.show = true;
    }
  } else {
    dallesDataSource.show = false;
  }
});

/* MONUMENTS */
var monumentDisplayDistance = new Cesium.DistanceDisplayCondition(1.0, 20000.0);
function showMonuments() {
  if (monumentsDataSource == null) {
    var promise = Cesium.GeoJsonDataSource.load(
      data_path + "/monuments.geojson",
      {
        markerSize: 50,
        markerSymbol: "museum",
        clampToGround: true,
      }
    );
    promise
      .then(function (dataSource) {
        monumentsDataSource = dataSource;
        viewer.dataSources.add(dataSource);
        var entities = dataSource.entities.values;
        for (var i = 0; i < entities.length; i++) {
          var entity = entities[i];
          var urlProp = entity.properties.url.getValue();
          entity.billboard.image = data_path + "/monuments/" + urlProp + ".png";
          entity.billboard.width = 45;
          entity.billboard.height = 45;
          entity.billboard.disableDepthTestDistance = Number.POSITIVE_INFINITY;
          entity.billboard.distanceDisplayCondition = monumentDisplayDistance;
          entity.label = new Cesium.LabelGraphics({
            text: entity.properties.Site,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -65),
            font: "14pt sans-serif",
            fillColor: Cesium.Color.WHITE,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 4,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
            distanceDisplayCondition: monumentDisplayDistance,
            show: false,
          });
        }
      })
      .otherwise(function (error) {
        window.alert(error);
      });
  } else {
    monumentsDataSource.show = true;
  }
}

$("#checkbox-monuments").on('change',function () {
  if (this.checked) {
    showMonuments();
  } else {
    monumentsDataSource.show = false;
  }
  scene.requestRender();
});

function setTileOffset(tileset, tile_heightOffset) {
  var boundingSphere = tileset.boundingSphere;
  var cartographic = Cesium.Cartographic.fromCartesian(boundingSphere.center);
  var surface = Cesium.Cartesian3.fromRadians(
    cartographic.longitude,
    cartographic.latitude,
    0.0
  );
  var offset = Cesium.Cartesian3.fromRadians(
    cartographic.longitude,
    cartographic.latitude,
    tile_heightOffset
  );
  var translation = Cesium.Cartesian3.subtract(
    offset,
    surface,
    new Cesium.Cartesian3()
  );
  tileset.modelMatrix = Cesium.Matrix4.fromTranslation(translation);
}

var onView = function () {
  addBaseLayerOption("Globe (IGO)", globeIGOProvider);
  addAdditionalLayerOption("Antibes 2017", antibes2017Provider, 1.0, true);
  addAdditionalLayerOption("Parcelles", parcellesWMSProvider, 0.5, false);
  addAdditionalLayerOption("Quartiers", quartiersWMSProvider, 0.5, false);
  updateLayerList();

  // Outil Coordonnées
  var pickCoords = false;
  function enableCoordTool(enable) {
    pickCoords = enable;
    if (!pickCoords) pickAddressEntity.show = false;
    if ($("#checkbox-tool-coords").prop("checked") != enable)
      $("#checkbox-tool-coords").prop("checked", enable);
  }
  $("#checkbox-tool-coords").on('change',function () {
    enableAdresseTool(false);
    enableCoordTool(this.checked);
    scene.requestRender();
  });

  // Outil Adresse
  var pickAddress = false;
  var pickAddressEntity = viewer.entities.add({
    billboard: {
      image: pinBuilder.fromColor(Cesium.Color.ROYALBLUE, 48).toDataURL(),
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
      show: true,
    },
    label: {
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
      verticalOrigin: Cesium.VerticalOrigin.BASELINE,
      pixelOffset: new Cesium.Cartesian2(20, -30),
      font: "14pt sans-serif",
      fillColor: Cesium.Color.WHITE,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 5,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
    show: false,
  });
  function enableAdresseTool(enable) {
    pickAddress = enable;
    if (!pickAddress) pickAddressEntity.show = false;
    if ($("#checkbox-adresse-click").prop("checked") != enable)
      $("#checkbox-adresse-click").prop("checked", enable);
  }
  $("#checkbox-adresse-click").on('change',function () {
    enableCoordTool(false);
    enableAdresseTool(this.checked);
    scene.requestRender();
  });
  $("#form-adresse").submit(function (e) {
    e.preventDefault();
    var queryURL =
      adresseURL + "search/?citycode=06004&q=" + $("#text-address").val();
    $.getJSON({
      url: queryURL,
    })
      .done(function (data) {
        if (data.features.length > 0) {
          var adLon = data.features[0].geometry.coordinates[0];
          var adLat = data.features[0].geometry.coordinates[1];
          pickAddressEntity.position = Cesium.Cartesian3.fromDegrees(
            adLon,
            adLat
          );
          pickAddressEntity.show = true;
          viewer.flyTo(pickAddressEntity);
          pickAddressEntity.label.text = data.features[0].properties.name;
          scene.requestRender();
        }
      })
      .fail(function (data) {
        console.log("ADDRESS FAIL");
      });
  });

  // Information about the currently highlighted feature
  var highlighted = {
    feature: undefined,
    originalColor: new Cesium.Color(),
  };

  // LEFT CLICK HANDLER
  viewer.screenSpaceEventHandler.setInputAction(function (movement) {
    var ray = viewer.camera.getPickRay(movement.position);
    var cartesian = scene.globe.pick(ray, scene);
    var pickedObject = scene.pick(movement.position);

    // If a feature was previously highlighted, undo the highlight
    if (Cesium.defined(highlighted.feature)) {
      highlighted.feature.color = highlighted.originalColor;
      highlighted.feature = undefined;
    }

    if (cartesian) {
      var cartographic = Cesium.Cartographic.fromCartesian(cartesian);
      var lon = Cesium.Math.toDegrees(cartographic.longitude);
      var lat = Cesium.Math.toDegrees(cartographic.latitude);
      if (pickAddress) {
        var queryURL = adresseURL + "reverse/?lon=" + lon + "&lat=" + lat;
        $.getJSON({
          url: queryURL,
        })
          .done(function (data) {
            if (data.features.length > 0) {
              var adLon = data.features[0].geometry.coordinates[0];
              var adLat = data.features[0].geometry.coordinates[1];
              pickAddressEntity.position = Cesium.Cartesian3.fromDegrees(
                adLon,
                adLat
              );
              pickAddressEntity.show = true;
              pickAddressEntity.label.text = data.features[0].properties.name;
              scene.requestRender();
            }
          })
          .fail(function (data) {
            console.log("ADDRESS FAIL");
          });
      } else if (pickCoords) {
        //log(cartesian);
        pickAddressEntity.position = Cesium.Cartesian3.fromDegrees(lon, lat);
        pickAddressEntity.show = true;
        pickAddressEntity.label.text = "";
        $("#dialogCoordinates").dialog({
          width: 300,
          height: 180,
          position: { my: "center top", at: "center top", of: window },
        });
        $("#dialog-coords-lon").html(lon.toFixed(7));
        $("#dialog-coords-lat").html(lat.toFixed(7));
        $("#dialog-coords-lon-rad").html(cartographic.longitude.toFixed(7));
        $("#dialog-coords-lat-rad").html(cartographic.latitude.toFixed(7));
        $("#dialog-coords-height").html(cartographic.height.toFixed(2));
        var coords_lambert93 = proj4("EPSG:4326", "EPSG:2154", [lon, lat]);
        $("#dialog-coords-L93-x").html(coords_lambert93[0].toFixed(2));
        $("#dialog-coords-L93-y").html(coords_lambert93[1].toFixed(2));
      } else {
        removeSelection();
        var featuresPromise = viewer.imageryLayers.pickImageryLayerFeatures(
          ray,
          viewer.scene
        );
        if (Cesium.defined(featuresPromise)) {
            // /!\ Cesium.when n'existe plus à partir de la version 1.92
          //Cesium.when(featuresPromise, function (features) {
            featuresPromise.then(function (features){
            var global_description = "";
            var parcellePolygon = viewer.entities.add(new Cesium.Entity());
            for (var i = 0; i < features.length; i++) {
              if (features[i].imageryLayer && features[i].imageryLayer.name)
                global_description +=
                  "<h4>" + features[i].imageryLayer.name + "</h4>";
              global_description += features[i].description;
              //console.log(features[i]);
              if (features[i].data && features[i].data.geometry) {
                var geometry = features[i].data.geometry;
                if (geometry.type == "Polygon") {
                  var entityCoordinates = [];
                  var entityCIndex = 0;
                  for (var j = 0; j < geometry.coordinates[0].length; j++) {
                    entityCoordinates[entityCIndex] =
                      geometry.coordinates[0][j][0];
                    entityCIndex++;
                    entityCoordinates[entityCIndex] =
                      geometry.coordinates[0][j][1];
                    entityCIndex++;
                  }
                  var selection = viewer.entities.add({
                    name: features[i].imageryLayer.name,
                    position: cartesian,
                    polygon: {
                      hierarchy:
                        Cesium.Cartesian3.fromDegreesArray(entityCoordinates),
                      material: Cesium.Color.BLUE.withAlpha(0.3),
                    },
                    polyline: {
                      positions:
                        Cesium.Cartesian3.fromDegreesArray(entityCoordinates),
                      material: Cesium.Color.BLUE,
                      width: 10,
                      clampToGround: true,
                      classificationType: Cesium.ClassificationType.BOTH,
                    },
                  });
                  if (selection) selectionEntities.push(selection);
                } else if (geometry.type == "MultiPolygon") {
                  for (
                    var coordinates_idx = 0;
                    coordinates_idx < geometry.coordinates.length;
                    coordinates_idx++
                  ) {
                    var entityCoordinates = [];
                    var entityCIndex = 0;
                    for (
                      var j = 0;
                      j < geometry.coordinates[coordinates_idx][0].length;
                      j++
                    ) {
                      entityCoordinates[entityCIndex] =
                        geometry.coordinates[coordinates_idx][0][j][0];
                      entityCIndex++;
                      entityCoordinates[entityCIndex] =
                        geometry.coordinates[coordinates_idx][0][j][1];
                      entityCIndex++;
                    }
                    var selection = viewer.entities.add({
                      name: features[i].imageryLayer.name,
                      position: cartesian,
                      polygon: {
                        hierarchy:
                          Cesium.Cartesian3.fromDegreesArray(entityCoordinates),
                        material: Cesium.Color.BLUE.withAlpha(0.3),
                      },
                      polyline: {
                        positions:
                          Cesium.Cartesian3.fromDegreesArray(entityCoordinates),
                        material: Cesium.Color.BLUE.withAlpha(0.3),
                        width: 15,
                        clampToGround: true,
                        classificationType: Cesium.ClassificationType.BOTH,
                      },
                    });
                    if (selection) selectionEntities.push(selection);
                  }
                } else if (geometry.type == "LineString") {
                  var entityCoordinates = [];
                  var entityCIndex = 0;
                  for (var j = 0; j < geometry.coordinates.length; j++) {
                    entityCoordinates[entityCIndex] =
                      geometry.coordinates[j][0];
                    entityCIndex++;
                    entityCoordinates[entityCIndex] =
                      geometry.coordinates[j][1];
                    entityCIndex++;
                  }
                  var selection = viewer.entities.add({
                    name: features[i].imageryLayer.name,
                    position: cartesian,
                    polyline: {
                      positions:
                        Cesium.Cartesian3.fromDegreesArray(entityCoordinates),
                      material: Cesium.Color.BLUE.withAlpha(0.3),
                      width: 15,
                      clampToGround: true,
                      classificationType: Cesium.ClassificationType.BOTH,
                    },
                  });
                  if (selection) selectionEntities.push(selection);
                } else if (geometry.type == "MultiLineString") {
                  for (
                    var coordinates_idx = 0;
                    coordinates_idx < geometry.coordinates.length;
                    coordinates_idx++
                  ) {
                    var entityCoordinates = [];
                    var entityCIndex = 0;
                    for (
                      var j = 0;
                      j < geometry.coordinates[coordinates_idx].length;
                      j++
                    ) {
                      entityCoordinates[entityCIndex] =
                        geometry.coordinates[coordinates_idx][j][0];
                      entityCIndex++;
                      entityCoordinates[entityCIndex] =
                        geometry.coordinates[coordinates_idx][j][1];
                      entityCIndex++;
                    }
                    var selection = viewer.entities.add({
                      name: features[i].imageryLayer.name,
                      position: cartesian,
                      polyline: {
                        positions:
                          Cesium.Cartesian3.fromDegreesArray(entityCoordinates),
                        material: Cesium.Color.BLUE.withAlpha(0.3),
                        width: 15,
                        clampToGround: true,
                        classificationType: Cesium.ClassificationType.BOTH,
                      },
                    });
                    if (selection) selectionEntities.push(selection);
                  }
                } else if (geometry.type == "Point") {
                  var entityCoordinates = [
                    geometry.coordinates[0],
                    geometry.coordinates[1],
                  ];
                  var selection = viewer.entities.add({
                    name: features[i].imageryLayer.name,
                    position: Cesium.Cartesian3.fromDegrees(
                      entityCoordinates[0],
                      entityCoordinates[1]
                    ),
                    billboard: {
                      image: pinBuilder
                        .fromColor(Cesium.Color.ROYALBLUE, 48)
                        .toDataURL(),
                      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                      disableDepthTestDistance: Number.POSITIVE_INFINITY,
                      show: true,
                    },
                  });
                  if (selection) selectionEntities.push(selection);
                } else if (geometry.type == "MultiPoint") {
                  for (
                    var coordinates_idx = 0;
                    coordinates_idx < geometry.coordinates.length;
                    coordinates_idx++
                  ) {
                    var entityCoordinates = [
                      geometry.coordinates[coordinates_idx][0],
                      geometry.coordinates[coordinates_idx][1],
                    ];
                    var selection = viewer.entities.add({
                      name: features[i].imageryLayer.name,
                      position: Cesium.Cartesian3.fromDegrees(
                        entityCoordinates[0],
                        entityCoordinates[1]
                      ),
                      billboard: {
                        image: pinBuilder
                          .fromColor(Cesium.Color.ROYALBLUE, 48)
                          .toDataURL(),
                        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                        disableDepthTestDistance: Number.POSITIVE_INFINITY,
                        show: true,
                      },
                    });
                    if (selection) selectionEntities.push(selection);
                  }
                } else {
                  console.log(geometry);
                  console.log(geometry.type);
                }
              }
            }
            if (global_description) {
              $("#wms-result-dialog").dialog({
                width: 400,
                height: 350,
                position: { my: "right top", at: "right top", of: window },
              });
              $("#wms-result").html(global_description);
            }
          });
        }
      }
    }
    if (!Cesium.defined(pickedObject)) {
      //clickHandler(movement);
      return;
    }
    if (pickedObject instanceof Cesium.Cesium3DTileFeature) {
      //console.log(pickedObject);
      var propertyNames = pickedObject.getPropertyNames();
      var length = propertyNames.length;
      for (var i = 0; i < length; ++i) {
        var propertyName = propertyNames[i];
        console.log(
          propertyName + ": " + pickedObject.getProperty(propertyName)
        );
      }
      // Highlight the feature
      highlighted.feature = pickedObject;
      Cesium.Color.clone(pickedObject.color, highlighted.originalColor);
      pickedObject.color = Cesium.Color.YELLOW;
      tooltip.setText(pickedObject.getProperty("REF_PAR"));
    } else if (Cesium.defined(pickedObject.id)) {
      if (
        monumentsDataSource &&
        monumentsDataSource.entities.contains(pickedObject.id)
      ) {
        if (monumentClicked) {
          monumentClicked.label.show = false;
          monumentClicked.billboard.scale = 1.0;
        }
        monumentClicked = pickedObject.id;
        monumentClicked.billboard.scale = 1.2;
        monumentClicked.label.show = true;
        var url_prop = monumentClicked.properties.url.getValue();
        var url =
          "https://www.antibes-juanlespins.com/3D/" + url_prop + ".html";
        $(function () {
          $("#infos-dialog").html(
            '<iframe src="' + url + '" width="100%" height="100%"></iframe>'
          );
          $("#infos-dialog").dialog({
            width: 400,
            height: 600,
            title: "Monument " + monumentClicked.properties.Site.getValue(),
            position: { my: "right center", at: "right center", of: window },
          });
        });
        scene.requestRender();
      } else if (
        quartiersDataSource &&
        quartiersDataSource.entities.contains(pickedObject.id)
      ) {
        var q_id = pickedObject.id.properties.ID.getValue();
        var url =
          "https://igoglobe.igo.fr/Maquette/Antibes/html/quartiers/" +
          q_id +
          ".html";
        $("#infos-dialog").html(
          '<iframe src="' + url + '" width="100%" height="100%"></iframe>'
        );
        $("#infos-dialog").dialog({
          width: 400,
          height: 600,
          title: "Quartier " + pickedObject.id.properties.NOM.getValue(),
          position: { my: "right center", at: "right center", of: window },
        });
      } else if (
        dallesDataSource &&
        dallesDataSource.entities.contains(pickedObject.id)
      ) {
        console.log(pickedObject.id.properties.Name.getValue());
      }
    }
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

  // DOUBLE CLICK HANDLER
  viewer.screenSpaceEventHandler.setInputAction(function (movement) {
    var pickedObject = scene.pick(movement.position);
    if (Cesium.defined(pickedObject) && Cesium.defined(pickedObject.id)) {
      if (
        monumentsDataSource &&
        monumentsDataSource.entities.contains(pickedObject.id)
      ) {
        viewer.flyTo(pickedObject.id, {
          offset: new Cesium.HeadingPitchRange(
            0,
            -Cesium.Math.PI_OVER_FOUR,
            200
          ),
        });
      }
      scene.requestRender();
    }
  }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

  // MOUSE MOVE HANDLER
  viewer.screenSpaceEventHandler.setInputAction(function (movement) {
    // If a feature was previously highlighted, undo the highlight
    if (Cesium.defined(highlighted.feature)) {
      highlighted.feature.color = highlighted.originalColor;
      highlighted.feature = undefined;
    }
    var pickedObject = scene.pick(movement.endPosition);
    if (Cesium.defined(pickedObject) && Cesium.defined(pickedObject.id)) {
      var cartesian = viewer.camera.pickEllipsoid(
        movement.endPosition,
        scene.globe.ellipsoid
      );
      if (cartesian) {
        if (
          quartiersDataSource &&
          quartiersDataSource.entities.contains(pickedObject.id)
        ) {
          tooltip.setText(pickedObject.id.properties.NOM.getValue());
        } else if (
          monumentsDataSource &&
          monumentsDataSource.entities.contains(pickedObject.id)
        ) {
          tooltip.setText(pickedObject.id.properties.Site.getValue());
        } else {
          tooltip.setText("");
        }
      }
    } else if (
      pickedObject instanceof Cesium.Cesium3DTileFeature &&
      pickedObject.tileset == tiles_parcelles
    ) {
      // Highlight the feature
      highlighted.feature = pickedObject;
      Cesium.Color.clone(pickedObject.color, highlighted.originalColor);
      pickedObject.color = Cesium.Color.YELLOW;
      tooltip.setText(pickedObject.getProperty("REF_PAR"));
    } else {
      tooltip.setText("");
    }
  }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

  /* Modeles 3D */

  var meshClipping = new Cesium.ClippingPlaneCollection({
    enabled: false,
  });

  $("#checkbox-mesh").on('change',function () {
    $("#checkbox-bati").prop("checked", false);
    if (bati_tileset) bati_tileset.show = false;
    if (mesh3D_tileset) mesh3D_tileset.show = this.checked;
    else if (this.checked)
      mesh3D_tileset = scene.primitives.add(
        new Cesium.Cesium3DTileset({
          url: data2_path + "/3dtiles/mesh/tileset.json",
          //url : 'https://igoprod.igo.fr/SG/antibes/b3dm/AntibesMesh3D/tileset.json',
          show: true,
          clippingPlanes: meshClipping,
        })
      );
    scene.requestRender();
  });
  $("#checkbox-mesh-igo").on('change',function () {
    if (mesh3D_IGO_tileset) mesh3D_IGO_tileset.show = this.checked;
    else if (this.checked)
      mesh3D_IGO_tileset = scene.primitives.add(
        new Cesium.Cesium3DTileset({
          url: "https://igoprod.igo.fr/SG/antibes/b3dm/AntibesMesh3D/tileset.json",
          show: true,
          clippingPlanes: meshClipping,
        })
      );
    scene.requestRender();
  });
  $("#checkbox-bati").change(function () {
    $("#checkbox-mesh").prop("checked", false);
    if (mesh3D_tileset) mesh3D_tileset.show = false;
    if (bati_tileset) bati_tileset.show = this.checked;
    else if (this.checked)
      bati_tileset = scene.primitives.add(
        new Cesium.Cesium3DTileset({
          url: "https://igoprod.igo.fr/SG/antibes/b3dm/Antibes_BatiGlobal.410970/tileset.json",
          show: true,
        })
      );
    scene.requestRender();
  });

  $("#checkbox-bati-test").on('change',function () {
    showBati(this.checked);
  });

  var fortCarreClippingPlanes = [
    new Cesium.ClippingPlane(new Cesium.Cartesian3(-1.0, -1.0, 0.0), 1285),
    new Cesium.ClippingPlane(new Cesium.Cartesian3(-1.0, 1.0, 0.0), 499),
    new Cesium.ClippingPlane(new Cesium.Cartesian3(1.0, 1.0, 0.0), -1369),
    new Cesium.ClippingPlane(new Cesium.Cartesian3(1.0, -1.0, 0.0), -589),
  ];

  $("#checkbox-fort").on('change',function () {
    if (fortcarre_tileset) fortcarre_tileset.show = this.checked;
    else if (this.checked)
      fortcarre_tileset = viewer.scene.primitives.add(
        new Cesium.Cesium3DTileset({
          url: data2_path + "/3dtiles/fortcarre/tileset2.json",
          maximumScreenSpaceError: 8,
        })
      );
    if (this.checked) {
      meshClipping.enabled = true;
      for (var i = 0; i < fortCarreClippingPlanes.length; i++) {
        meshClipping.add(fortCarreClippingPlanes[i]);
      }
    } else {
      meshClipping.enabled = false;
      for (var i = 0; i < fortCarreClippingPlanes.length; i++) {
        meshClipping.remove(fortCarreClippingPlanes[i]);
      }
    }
    scene.requestRender();
  });

  /* Vectoriel */

  function showNomRues() {
    if (nomruesDataSource == null) {
      var promise = Cesium.GeoJsonDataSource.load(
        data_path + "/nom_rues.geojson",
        {
          //markerSize: 0,
          //markerSymbol: 'museum',
          //clampToGround: true
        }
      );
      promise
        .then(function (dataSource) {
          nomruesDataSource = dataSource;
          viewer.dataSources.add(dataSource);
          var entities = dataSource.entities.values;
          for (var i = 0; i < entities.length; i++) {
            var entity = entities[i];
            entity.billboard = null;
            entity.label = new Cesium.LabelGraphics({
              text: entity.properties.ETIQ_TEXTE,
              horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
              verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
              //font : '12pt sans-serif',
              fillColor: Cesium.Color.WHITE,
              outlineColor: Cesium.Color.BLACK,
              outlineWidth: 4,
              style: Cesium.LabelStyle.FILL_AND_OUTLINE,
              translucencyByDistance: new Cesium.NearFarScalar(
                3.0e2,
                1.0,
                1.5e3,
                0.0
              ),
              scaleByDistance: new Cesium.NearFarScalar(0.5e2, 1.0, 1.1e3, 0.0),
              //disableDepthTestDistance : 1000,
              show: true,
            });
          }
        })
        .otherwise(function (error) {
          window.alert(error);
        });
    } else {
      nomruesDataSource.show = true;
    }
  }

  $("#checkbox-rues").on('change',function () {
    if (this.checked) {
      showNomRues();
    } else {
      nomruesDataSource.show = false;
    }
    scene.requestRender();
  });

  // Meteo
  $("#button-meteo").on( "click",function () {
    $("#infos-dialog").html(
      '<iframe seamless width="888" height="336" frameborder="0" src="https://www.infoclimat.fr/public-api/mixed/iframeSLIDE?_ll=43.598,7.108&_inc=WyJBbnRpYmVzIC0gTGEgR2Fyb3VwZSIsIjgyIiwiMDc2ODgiLCJTVEEiXQ==&_auth=BhxTRFMtAyEHKlNkAHZReABoADVcKlRzC3dRMl0zBHkDZVI%2FUjkEeVIiUTQDLVBlWGtQOF19AyRTMAdnC2BTOAZtUyhTLwN8B2lTLgAvUW0AMgB%2BXGFUaQtoUShdMQRuA2JSKFIwBGVSPlEsAyxQZVhuUDZdZgM9UzYHZQtnUzMGZVMoUy8DZAc8UzUAMlEwADYAYlwyVG8LblE0XTMEZQNmUihSNARiUj9RNwM7UGZYaFAzXX0DJFNJBxMLe1NwBidTYlN2A3wHPVNvAGQ%3D&_c=95b0962dbcb0ceef8305094d8e01b863"></iframe>'
    );
    $("#infos-dialog").dialog({
      width: 890,
      height: 390,
      title: "Meteo Antibes",
      position: { my: "right center", at: "right center", of: window },
    });
  });

  // Parcelles 3Dtiles
  tiles_parcelles = new Cesium.Cesium3DTileset({
    url: data_path + "/cadastre/cadastre/tileset.json",
    maximumScreenSpaceError: 128,
    show: false,
  });
  tiles_parcelles.readyPromise
    .then(function (tileset) {
      setTileOffset(tileset, 1.0);
      $("#checkbox-tiles-parcelles-offset").val(1.0);

      viewer.scene.primitives.add(tileset);
      tileset.style = new Cesium.Cesium3DTileStyle({
        color: "rgba(255, 255, 255, 0.5)",
      });
    })
    .otherwise(function (error) {
      window.alert(error);
    });

  $("#checkbox-tiles-parcelles").on('change',function () {
    tiles_parcelles.show = this.checked;
  });
  $("#checkbox-tiles-parcelles-offset").on("input", function () {
    setTileOffset(tiles_parcelles, $(this).val());
  });
}; //onView
